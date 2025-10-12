from collections import defaultdict
from dataclasses import asdict
from typing import Callable

from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from ..config import get_settings
from ..category_service import (
    build_category_cards,
    resolve_allowed_categories,
    resolve_primary_category,
)
from ..bridge_bank import BridgeDataError, list_bridge_units
from ..problem_bank import get_problems
from ..curriculum_graph import get_curriculum_graph
from ..template_engine import list_concepts
from ..dependencies.auth import resolve_optional_user
from ..progress_store import ProgressStore, refresh_progress_store
from ..repositories import AttemptRepository
from ..services.progress_metrics import ProgressMetricsService


def _templates_resolver(
    override: Jinja2Templates | None,
) -> Callable[[Request], Jinja2Templates]:
    def _resolve(request: Request) -> Jinja2Templates:
        if override is not None:
            return override
        templates = getattr(request.app.state, "templates", None)
        if not isinstance(templates, Jinja2Templates):
            raise RuntimeError("Templates are not configured on the application state.")
        return templates

    return _resolve


def _is_truthy_flag(value: str | None) -> bool:
    if value is None:
        return False
    normalized = value.strip().lower()
    return normalized in {"1", "true", "yes", "on"}


def _should_show_compliance(request: Request) -> bool:
    if _is_truthy_flag(request.query_params.get("staff")):
        return True
    if _is_truthy_flag(request.query_params.get("preview")):
        return True
    if _is_truthy_flag(request.headers.get("X-Staff-Preview")):
        return True
    return False


def _build_router(templates: Jinja2Templates | None = None) -> APIRouter:
    router = APIRouter(tags=["pages"])
    resolve_templates = _templates_resolver(templates)

    @router.get("/", response_class=HTMLResponse)
    async def home(request: Request) -> HTMLResponse:
        active_templates = resolve_templates(request)
        categories = resolve_allowed_categories()
        cards = build_category_cards(categories)
        primary_category = resolve_primary_category(categories)
        secondary_category = None
        if categories:
            for label in categories:
                if primary_category and label == primary_category:
                    continue
                secondary_category = label
                break
            if secondary_category is None:
                secondary_category = primary_category
        graph_payload = get_curriculum_graph()
        concept_nodes = list_concepts()
        concept_lookup = {node.id: node for node in concept_nodes}

        progress_metrics_data = None
        user = resolve_optional_user(request)
        if user is not None:
            attempt_repository = getattr(request.app.state, "attempt_repository", None)
            if not isinstance(attempt_repository, AttemptRepository):
                settings = getattr(request.app.state, "settings", None) or get_settings()
                attempt_repository = AttemptRepository(settings.attempts_database_path)
                request.app.state.attempt_repository = attempt_repository
            progress_store = getattr(request.app.state, "dag_progress_store", None)
            if not isinstance(progress_store, ProgressStore):
                progress_store = refresh_progress_store(force=True)
                request.app.state.dag_progress_store = progress_store
            metrics_service = ProgressMetricsService(
                attempt_repository=attempt_repository,
                progress_store=progress_store,
            )
            progress_metrics_data = metrics_service.get_metrics_for_user(user.id).dict()

        sequence_order: list[str] = []
        for node in graph_payload.get("nodes", []):
            concept_id = node.get("concept")
            if concept_id and concept_id not in sequence_order:
                sequence_order.append(concept_id)

        step_priority = {"S1": 0, "S2": 1, "S3": 2}
        grouped_nodes: dict[str, dict[str, object]] = defaultdict(lambda: {"steps": []})
        for node in graph_payload.get("nodes", []):
            step_value = str(node.get("step", "")).upper()
            if step_value not in step_priority:
                continue
            concept_id = node.get("concept")
            if not concept_id:
                continue
            group = grouped_nodes[concept_id]
            group.setdefault("concept_id", concept_id)
            concept_meta = concept_lookup.get(concept_id)
            if concept_meta is not None:
                group.setdefault("name", concept_meta.name)
                group.setdefault("lens", list(concept_meta.lens))
                group.setdefault("summary", concept_meta.summary)
            steps_list = group.setdefault("steps", [])
            if isinstance(steps_list, list):
                steps_list.append(
                    {
                        "id": node.get("id"),
                        "label": node.get("label", f"{concept_id} · {step_value}"),
                        "step": step_value,
                        "lens": node.get("lens", []),
                        "grade_band": node.get("grade_band"),
                    }
                )
        skill_tree = []
        for concept_id, group in grouped_nodes.items():
            steps = group.get("steps", [])
            if isinstance(steps, list):
                steps.sort(key=lambda item: step_priority.get(item.get("step", ""), 99))
            group.setdefault("name", concept_id)
            group.setdefault("lens", [])
            group.setdefault("summary", "")
            skill_tree.append(group)
        skill_tree.sort(
            key=lambda item: sequence_order.index(item["concept_id"])  # type: ignore[index]
            if item["concept_id"] in sequence_order  # type: ignore[operator]
            else len(sequence_order)
        )
        palette = graph_payload.get("meta", {}).get("palette", {})

        return active_templates.TemplateResponse(
            "index.html",
            {
                "request": request,
                "categories": categories,
                "category_cards": cards,
                "primary_category": primary_category,
                "secondary_category": secondary_category,
                "cta_primary_category": primary_category
                or (categories[0] if categories else None),
                "category_count": len(cards),
                "skill_tree": skill_tree,
                "skill_palette": palette,
                "show_compliance_details": _should_show_compliance(request),
                "progress_metrics": progress_metrics_data,
            },
        )

    @router.get("/problems", response_class=HTMLResponse)
    async def problems(
        request: Request,
        category: str = Query(default=None, description="문제 유형"),
    ) -> HTMLResponse:
        active_templates = resolve_templates(request)
        categories = resolve_allowed_categories()
        selected_category = (
            category if category in categories else resolve_primary_category(categories)
        )
        bridge_unit = None
        try:
            bridge_units = list_bridge_units()
        except BridgeDataError:
            bridge_units = []

        node_by_category = {
            "덧셈": "ALG-AP",
            "뺄셈": "ALG-AP",
        }

        if not selected_category:
            problems_payload: list[dict[str, object]] = []
        else:
            problems_payload = [
                asdict(problem) for problem in get_problems(selected_category)
            ]
            target_node = node_by_category.get(selected_category)
            if target_node:
                for unit in bridge_units:
                    if unit.node == target_node:
                        bridge_unit = unit.to_dict()
                        break
        return active_templates.TemplateResponse(
            "problems.html",
            {
                "request": request,
                "category": selected_category,
                "category_display": (selected_category or "문제"),
                "problems": problems_payload,
                "categories": categories,
                "primary_category": resolve_primary_category(categories),
                "category_available": bool(selected_category),
                "bridge_unit": bridge_unit,
                "show_compliance_details": _should_show_compliance(request),
            },
        )

    return router


router = _build_router()


def get_router(templates: Jinja2Templates) -> APIRouter:
    return _build_router(templates)


__all__ = ["router", "get_router"]
