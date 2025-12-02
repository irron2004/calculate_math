from __future__ import annotations

import json
import logging
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field

from ..bipartite_loader import (
    BipartiteSpecError,
    get_atomic_skills,
    get_bipartite_graph,
    get_course_steps,
)
from ..dependencies.auth import get_optional_user
from ..feature_flags import assign_skill_tree_variant
from ..progress_store import (
    NodeProgress,
    ProgressSnapshot,
    ProgressStore,
    SkillProgress,
    get_progress_store,
)
from ..repositories import UserRecord
from ..services import SkillProgressService
from ..services.skill_tree_projection import build_skill_tree_projection
from ..services.skill_ui_layout import build_ui_layout_from_projection
from ..skills_loader import SkillSpecError

router = APIRouter(prefix="/api/v1", tags=["skills"])
logger = logging.getLogger("calculate_service.api.skills")

_SKILL_UI_PATH = Path(__file__).resolve().parent.parent / "data" / "skills.ui.json"
_LEGACY_SKILL_UI_PATH = _SKILL_UI_PATH.parent / ".old" / _SKILL_UI_PATH.name


def _resolve_skill_ui_path() -> Path | None:
    if _SKILL_UI_PATH.exists():
        return _SKILL_UI_PATH
    if _LEGACY_SKILL_UI_PATH.exists():
        return _LEGACY_SKILL_UI_PATH
    return None


@lru_cache(maxsize=1)
def _load_skill_ui_graph() -> Dict[str, Any]:
    source_path = _resolve_skill_ui_path()
    if source_path is None:
        raise SkillSpecError(
            f"Skill UI graph not found (searched {_SKILL_UI_PATH} and {_LEGACY_SKILL_UI_PATH})"
        )
    try:
        payload = json.loads(source_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive guard
        raise SkillSpecError(f"Invalid skill UI graph specification at {source_path}") from exc
    return payload


class SkillProgressRequest(BaseModel):
    course_step_id: str = Field(..., description="Completed course step identifier")
    correct: bool = True
    attempts: int = Field(default=1, ge=1, le=20)
    user_id: Optional[str] = Field(
        default=None,
        description="Optional target user id (defaults to authenticated user)",
    )


def _resolve_progress_store(request: Request) -> ProgressStore:
    store = getattr(request.app.state, "dag_progress_store", None)
    if isinstance(store, ProgressStore):
        return store
    store = get_progress_store()
    request.app.state.dag_progress_store = store
    return store


def _select_snapshot(
    store: ProgressStore,
    user_id: Optional[str],
) -> tuple[ProgressSnapshot | None, Exception | None]:
    effective = user_id
    if effective is None:
        user_ids = list(store.list_user_ids())
        if not user_ids:
            return None, None
        effective = user_ids[0]
    try:
        return store.get_snapshot(effective), None
    except Exception as exc:  # pragma: no cover - defensive guard
        return None, exc


def _serialise_node_progress(
    course_steps,
    snapshot: ProgressSnapshot | None,
) -> Dict[str, Dict[str, Any]]:
    progress: Dict[str, Dict[str, Any]] = {}
    existing = snapshot.nodes if snapshot else {}
    for course in course_steps:
        node_progress = existing.get(course.id)
        if node_progress is None:
            node_progress = NodeProgress()
        if not isinstance(node_progress, NodeProgress):
            node_progress = NodeProgress.parse_obj(node_progress)
        progress[course.id] = node_progress.dict()
    if snapshot:
        for node_id, node_progress in snapshot.nodes.items():
            if node_id in progress:
                continue
            if not isinstance(node_progress, NodeProgress):
                node_progress = NodeProgress.parse_obj(node_progress)
            progress[node_id] = node_progress.dict()
    return progress


def _serialise_skill_progress(
    atomic_skills,
    snapshot: ProgressSnapshot | None,
) -> Dict[str, Dict[str, Any]]:
    progress: Dict[str, Dict[str, Any]] = {}
    existing = snapshot.skills if snapshot else {}
    for skill in atomic_skills:
        skill_progress = existing.get(skill.id)
        if skill_progress is None:
            skill_progress = SkillProgress()
        if not isinstance(skill_progress, SkillProgress):
            skill_progress = SkillProgress.parse_obj(skill_progress)
        progress[skill.id] = skill_progress.dict()
    if snapshot:
        for skill_id, skill_progress in snapshot.skills.items():
            if skill_id in progress:
                continue
            if not isinstance(skill_progress, SkillProgress):
                skill_progress = SkillProgress.parse_obj(skill_progress)
            progress[skill_id] = skill_progress.dict()
    return progress


@router.get("/skills/tree")
async def api_get_skill_tree(
    request: Request,
    response: Response,
    user_id: Optional[str] = Query(None, description="Optional user id override"),
    user: UserRecord | None = Depends(get_optional_user),
) -> Dict[str, Any]:
    try:
        bipartite_graph = get_bipartite_graph()
        course_steps = get_course_steps()
        atomic_skills = get_atomic_skills()
    except BipartiteSpecError as exc:  # pragma: no cover - validated via tests
        logger.exception("Failed to load bipartite graph")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": "스킬 그래프를 불러오는 중 문제가 발생했습니다."},
        ) from exc

    store = _resolve_progress_store(request)
    effective_user_id = user.id if user is not None else user_id
    snapshot, progress_error = _select_snapshot(store, effective_user_id)
    node_progress = _serialise_node_progress(course_steps, snapshot)
    skill_progress = _serialise_skill_progress(atomic_skills, snapshot)

    unlocked_map: Dict[str, bool] = {
        **{node_id: data.get("unlocked", False) for node_id, data in node_progress.items()},
        **{skill_id: data.get("level", 0) > 0 for skill_id, data in skill_progress.items()},
    }

    progress_payload: Dict[str, Any] = {
        "user_id": snapshot.user_id if snapshot else effective_user_id,
        "updated_at": snapshot.updated_at.isoformat() if snapshot else None,
        "total_xp": snapshot.total_xp if snapshot else 0,
        "nodes": node_progress,
        "skills": skill_progress,
    }

    projection = build_skill_tree_projection(
        graph=bipartite_graph,
        node_progress=node_progress,
        skill_progress=skill_progress,
    )

    ui_graph_source = _resolve_skill_ui_path()
    graph_error: SkillSpecError | None = None
    fallback_reason: Optional[str] = None
    ui_graph: Dict[str, Any] | None = None

    if ui_graph_source is None:
        graph_error = SkillSpecError(
            f"Skill UI graph not found (searched {_SKILL_UI_PATH} and {_LEGACY_SKILL_UI_PATH})"
        )
    else:
        try:
            ui_graph = deepcopy(_load_skill_ui_graph())
        except SkillSpecError as exc:  # pragma: no cover - tested via router tests
            graph_error = exc

    if ui_graph is None:
        fallback_reason = "missing_ui_spec" if ui_graph_source is None else "invalid_ui_spec"
        ui_graph = build_ui_layout_from_projection(
            projection,
            fallback_reason=fallback_reason,
        )
        logger.warning(
            "Skill UI graph unavailable (%s); delivering derived layout",
            fallback_reason,
        )

    assignment = assign_skill_tree_variant(request, response)
    payload: Dict[str, Any] = {
        "version": projection.get("version"),
        "palette": projection.get("palette"),
        "groups": projection.get("groups"),
        "nodes": projection.get("nodes"),
        "edges": projection.get("edges"),
        "skills": projection.get("skills"),
        "graph": deepcopy(ui_graph) if ui_graph else None,
        "bipartite_graph": bipartite_graph.model_dump(by_alias=True),
        "progress": progress_payload,
        "unlocked": unlocked_map,
        "experiment": assignment.to_payload(),
    }

    issues: list[dict[str, Any]] = []
    if progress_error is not None:
        issues.append(
            {
                "message": "진행도 데이터를 불러오는 중 문제가 발생하여 기본 값을 표시합니다.",
                "kind": progress_error.__class__.__name__,
            }
        )
    if graph_error is not None:
        graph_issue: dict[str, Any] = {
            "message": "UI 레이아웃 데이터를 불러오지 못해 기본 레이아웃을 사용합니다.",
            "kind": graph_error.__class__.__name__,
            "detail": str(graph_error),
        }
        if fallback_reason is not None:
            graph_issue["meta"] = {"fallback_reason": fallback_reason}
        issues.append(graph_issue)
    if issues:
        combined_issue = issues[0]
        if len(issues) > 1:
            combined_issue["causes"] = issues[1:]
        payload["error"] = combined_issue

    return payload


@router.post("/skills/progress")
async def api_update_skill_progress(
    request: Request,
    payload: SkillProgressRequest,
    user: UserRecord | None = Depends(get_optional_user),
) -> Dict[str, Any]:
    bipartite_graph = get_bipartite_graph()
    course_steps = get_course_steps()
    atomic_skills = get_atomic_skills()
    service = SkillProgressService(course_steps, atomic_skills, bipartite_graph.edges)
    store = _resolve_progress_store(request)

    effective_user_id = payload.user_id or (user.id if user else None)
    if effective_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "사용자 정보를 찾을 수 없습니다."},
        )

    def mutator(snapshot: ProgressSnapshot) -> None:
        for _ in range(payload.attempts):
            service.apply_course_attempt(snapshot, payload.course_step_id, correct=payload.correct)

    snapshot = store.update_snapshot(effective_user_id, mutator)
    return {
        "user_id": snapshot.user_id,
        "updated_at": snapshot.updated_at.isoformat(),
        "total_xp": snapshot.total_xp,
        "nodes": {node_id: progress.dict() for node_id, progress in snapshot.nodes.items()},
        "skills": {skill_id: progress.dict() for skill_id, progress in snapshot.skills.items()},
    }


__all__ = ["router"]
