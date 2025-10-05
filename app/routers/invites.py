from __future__ import annotations

from datetime import datetime

from typing import Callable

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, model_validator

from ..category_service import (
    resolve_allowed_categories,
    resolve_primary_category,
)
from ..invite_service import InviteSession, InviteSummary, invite_store


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


def _allowed_categories() -> set[str]:
    return set(resolve_allowed_categories())


class InviteSummaryPayload(BaseModel):
    total: int = Field(ge=0)
    correct: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_correct(cls, values: "InviteSummaryPayload") -> "InviteSummaryPayload":  # type: ignore[override]
        if values.correct > values.total:
            raise ValueError("correct answers cannot exceed total problems")
        return values


class InviteCreatePayload(BaseModel):
    category: str = Field(..., description="공유할 문제 카테고리")
    summary: InviteSummaryPayload | None = None


class InviteResponse(BaseModel):
    token: str
    category: str
    share_url: str
    expires_at: datetime
    created_at: datetime
    summary: dict[str, int] | None = None


def _serialize(session: InviteSession, request: Request) -> InviteResponse:
    share_url = str(request.url_for("share_invite", token=session.token))
    summary = session.summary.to_dict() if session.summary else None
    return InviteResponse(
        token=session.token,
        category=session.category,
        share_url=share_url,
        expires_at=session.expires_at,
        created_at=session.created_at,
        summary=summary,
    )


def _build_router(templates: Jinja2Templates | None = None) -> APIRouter:
    router = APIRouter(tags=["invites"])
    resolve_templates = _templates_resolver(templates)

    @router.post(
        "/api/invites",
        response_model=InviteResponse,
        status_code=status.HTTP_201_CREATED,
    )
    async def create_invite(
        payload: InviteCreatePayload, request: Request
    ) -> InviteResponse:
        if payload.category not in _allowed_categories():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="unknown category"
            )

        summary_model = None
        if payload.summary is not None:
            summary_model = InviteSummary(
                total=payload.summary.total,
                correct=payload.summary.correct,
            )

        session = invite_store.create(
            category=payload.category, summary=summary_model
        )
        return _serialize(session, request)

    @router.get("/api/invites/{token}", response_model=InviteResponse)
    async def get_invite(token: str, request: Request) -> InviteResponse:
        session = invite_store.get(token)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="invite not found or expired",
            )
        return _serialize(session, request)

    @router.delete("/api/invites/{token}", status_code=status.HTTP_204_NO_CONTENT)
    async def expire_invite(token: str) -> Response:
        removed = invite_store.expire(token)
        if removed is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="invite not found"
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.get(
        "/share/{token}",
        response_class=HTMLResponse,
        name="share_invite",
    )
    async def share_page(token: str, request: Request) -> HTMLResponse:
        session = invite_store.get(token)
        categories = resolve_allowed_categories()
        context = {
            "request": request,
            "invite": session.to_dict() if session else None,
            "expired": session is None,
            "categories": categories,
            "primary_category": resolve_primary_category(categories),
        }
        status_code = status.HTTP_200_OK if session else status.HTTP_410_GONE
        active_templates = resolve_templates(request)
        response = active_templates.TemplateResponse(
            "share.html", context, status_code=status_code
        )
        response.headers["X-Robots-Tag"] = "noindex"
        response.headers["Cache-Control"] = "no-store"
        return response

    return router


router = _build_router()


def get_router(templates: Jinja2Templates) -> APIRouter:
    return _build_router(templates)


__all__ = ["router", "get_router"]
