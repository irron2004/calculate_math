from dataclasses import asdict

from typing import Callable

from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from ..category_service import (
    build_category_cards,
    resolve_allowed_categories,
    resolve_primary_category,
)
from ..problem_bank import get_problems


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
        if not selected_category:
            problems_payload: list[dict[str, object]] = []
        else:
            problems_payload = [
                asdict(problem) for problem in get_problems(selected_category)
            ]
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
            },
        )

    return router


router = _build_router()


def get_router(templates: Jinja2Templates) -> APIRouter:
    return _build_router(templates)


__all__ = ["router", "get_router"]
