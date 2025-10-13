from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field

from ..feature_flags import assign_skill_tree_variant
from ..skills_loader import SkillSpecError, get_skill_graph
from ..bipartite_loader import (
    BipartiteSpecError,
    get_bipartite_graph,
    get_course_steps,
    get_atomic_skills,
)
from ..progress_store import (
    ProgressStore,
    ProgressSnapshot,
    NodeProgress,
    SkillProgress,
    get_progress_store,
    ProgressDataError,
)
from ..dependencies.auth import get_optional_user
from ..repositories import UserRecord
from ..services import SkillProgressService

router = APIRouter(prefix="/api/v1", tags=["skills"])


logger = logging.getLogger("calculate_service.api.skills")


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
) -> ProgressSnapshot | None:
    effective = user_id
    if effective is None:
        user_ids = list(store.list_user_ids())
        if not user_ids:
            return None
        effective = user_ids[0]
    try:
        return store.get_snapshot(effective)
    except Exception:
        return None


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
    assignment = assign_skill_tree_variant(request, response)
    try:
        skill_graph = get_skill_graph()
        bipartite_graph = get_bipartite_graph()
        course_steps = get_course_steps()
        atomic_skills = get_atomic_skills()
        store = _resolve_progress_store(request)

        effective_user_id = user.id if user is not None else user_id
        snapshot = _select_snapshot(store, effective_user_id)

        node_progress = _serialise_node_progress(course_steps, snapshot)
        skill_progress = _serialise_skill_progress(atomic_skills, snapshot)

        unlocked: Dict[str, bool] = {
            **{
                node_id: data.get("unlocked", False)
                for node_id, data in node_progress.items()
            },
            **{skill_id: data.get("level", 0) > 0 for skill_id, data in skill_progress.items()},
        }

        progress_payload: Dict[str, Any] = {
            "user_id": snapshot.user_id if snapshot else effective_user_id,
            "updated_at": snapshot.updated_at.isoformat() if snapshot else None,
            "total_xp": snapshot.total_xp if snapshot else 0,
            "nodes": node_progress,
            "skills": skill_progress,
        }

        payload: Dict[str, Any] = {
            "graph": skill_graph.model_dump(by_alias=True),
            "bipartite_graph": bipartite_graph.model_dump(by_alias=True),
            "progress": progress_payload,
            "unlocked": unlocked,
            "experiment": assignment.to_payload(),
        }
        return payload
    except (SkillSpecError, BipartiteSpecError, ProgressDataError) as exc:
        logger.exception("Failed to load skill tree payload")
        fallback_progress: Dict[str, Any] = {
            "user_id": None,
            "updated_at": None,
            "total_xp": 0,
            "nodes": {},
            "skills": {},
        }
        return {
            "graph": {"nodes": [], "edges": [], "meta": {}},
            "bipartite_graph": {"nodes": [], "edges": [], "palette": {}},
            "progress": fallback_progress,
            "unlocked": {},
            "experiment": assignment.to_payload(),
            "error": {
                "message": "스킬 트리 데이터를 불러오는 중 문제가 발생했습니다.",
                "kind": exc.__class__.__name__,
            },
        }
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.exception("Unexpected error while building skill tree payload")
        fallback_progress = {
            "user_id": None,
            "updated_at": None,
            "total_xp": 0,
            "nodes": {},
            "skills": {},
        }
        return {
            "graph": {"nodes": [], "edges": [], "meta": {}},
            "bipartite_graph": {"nodes": [], "edges": [], "palette": {}},
            "progress": fallback_progress,
            "unlocked": {},
            "experiment": assignment.to_payload(),
            "error": {
                "message": "스킬 트리를 불러오는 중 예기치 못한 오류가 발생했습니다.",
                "kind": "UnexpectedError",
            },
        }


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
