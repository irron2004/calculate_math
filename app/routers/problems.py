from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..category_service import resolve_allowed_categories
from ..config import get_settings
from ..problem_bank import (
    Problem,
    ProblemDataError,
    ProblemRepository,
    get_problems,
    get_repository as get_problem_repository,
)
from ..dependencies.auth import get_optional_user
from ..repositories import AttemptRepository, UserRecord

router = APIRouter(prefix="/api", tags=["problems"])


class ProblemAttemptRequest(BaseModel):
    """Payload for submitting an answer to a problem."""

    answer: int = Field(..., description="사용자가 제출한 정답", examples=[42])


class ProblemAttemptResponse(BaseModel):
    """Response body returned after recording a problem attempt."""

    attempt_id: int
    problem_id: str
    category: str
    is_correct: bool
    submitted_answer: int
    correct_answer: int
    attempted_at: datetime


@router.get("/categories", summary="사용 가능한 문제 카테고리 나열")
async def categories() -> dict[str, object]:
    available = resolve_allowed_categories()
    return {"categories": available, "count": len(available)}


@router.get("/problems", summary="카테고리별 문제 반환")
async def problems(
    category: str | None = Query(
        default=None,
        description="요청할 문제 유형 (기본값: 첫 번째 카테고리)",
    ),
) -> dict[str, object]:
    available = resolve_allowed_categories()
    selected = category or (available[0] if available else None)

    if not selected:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "type": "https://360me.app/problems/not-found",
                "title": "문제 데이터를 찾을 수 없습니다",
                "status": 404,
                "detail": "등록된 문제 카테고리가 없습니다.",
            },
        )

    if selected not in available:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "type": "https://360me.app/problems/invalid-category",
                "title": "지원하지 않는 카테고리",
                "status": 404,
                "detail": f"요청한 카테고리 '{selected}'를 찾을 수 없습니다.",
                "instance": f"/api/problems?category={selected}",
                "available": available,
            },
        )

    items = [problem.to_dict(include_answer=True) for problem in get_problems(selected)]
    return {"category": selected, "items": items, "total": len(items)}


def _get_problem_repository() -> ProblemRepository:
    return get_problem_repository()


def _get_attempt_repository(request: Request) -> AttemptRepository:
    repository = getattr(request.app.state, "attempt_repository", None)
    if isinstance(repository, AttemptRepository):
        return repository

    # Fallback to creating a repository on demand for contexts that bypass
    # the FastAPI lifespan (e.g. direct router instantiation in tests).
    settings = getattr(request.app.state, "settings", None) or get_settings()
    database_path = Path(settings.attempts_database_path)
    repository = AttemptRepository(database_path)
    request.app.state.attempt_repository = repository
    return repository


@router.post(
    "/problems/{problem_id}/attempts",
    status_code=status.HTTP_201_CREATED,
    summary="문제 풀이 제출",
    response_model=ProblemAttemptResponse,
)
async def submit_attempt(
    problem_id: str,
    payload: ProblemAttemptRequest,
    problem_repository: ProblemRepository = Depends(_get_problem_repository),
    attempt_repository: AttemptRepository = Depends(_get_attempt_repository),
    user: UserRecord | None = Depends(get_optional_user),
) -> ProblemAttemptResponse:
    try:
        problem = problem_repository.get_problem(problem_id)
    except ProblemDataError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "type": "https://360me.app/problems/not-found",
                "title": "문제를 찾을 수 없습니다",
                "status": status.HTTP_404_NOT_FOUND,
                "detail": f"요청한 문제 '{problem_id}'가 존재하지 않습니다.",
            },
        ) from None

    is_correct = int(payload.answer) == problem.answer
    record = attempt_repository.record_attempt(
        problem_id=problem.id,
        submitted_answer=payload.answer,
        is_correct=is_correct,
        user_id=user.id if user is not None else None,
    )

    return ProblemAttemptResponse(
        attempt_id=record.id,
        problem_id=record.problem_id,
        category=problem.category,
        is_correct=record.is_correct,
        submitted_answer=record.submitted_answer,
        correct_answer=problem.answer,
        attempted_at=record.attempted_at,
    )


__all__ = ["router"]
