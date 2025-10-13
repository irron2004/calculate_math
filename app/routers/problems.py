from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..category_service import resolve_allowed_categories
from ..config import get_settings
from ..problem_bank import ProblemDataError, ProblemRepository, get_repository as get_problem_repository
from ..dependencies.auth import get_optional_user
from ..repositories import AttemptRepository, UserRecord
from ..services.problem_generation import (
    CATEGORY_LABEL_BY_OPERATION,
    CATEGORY_OPERATION_DEFAULTS,
    generate_problem_set,
    resolve_generated_problem,
)

CATEGORY_OPERATION_MAP: dict[str, tuple[str, int]] = dict(CATEGORY_OPERATION_DEFAULTS)

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
    op: str | None = Query(
        default=None,
        description="사용할 연산 (add|sub|mul|div)",
    ),
    digits: int | None = Query(
        default=None,
        ge=1,
        le=4,
        description="문제에 사용할 자릿수",
    ),
    count: int | None = Query(
        default=None,
        ge=1,
        le=50,
        description="생성할 문제 개수",
    ),
    seed_value: int | None = Query(
        default=None,
        alias="seed",
        description="난수 시드 (재현 가능하게 유지)",
    ),
    reveal_answers: bool = Query(
        default=False,
        description="정답 포함 여부 (QA/디버깅 전용)",
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

    operation, default_digits = CATEGORY_OPERATION_MAP.get(selected, (op or "add", 2))
    if op:
        candidate = op.lower()
        if candidate not in CATEGORY_LABEL_BY_OPERATION:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "type": "https://360me.app/problems/invalid-operation",
                    "title": "지원하지 않는 연산",
                    "status": status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "detail": f"연산 '{op}' 는 지원하지 않습니다.",
                },
            )
        operation = candidate
    effective_digits = digits or default_digits
    effective_count = count or 20

    try:
        result = generate_problem_set(
            operation=operation,
            digits=effective_digits,
            count=effective_count,
            seed=seed_value,
            include_answers=reveal_answers,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "type": "https://360me.app/problems/invalid-parameters",
                "title": "문제를 생성할 수 없습니다",
                "status": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "detail": str(exc),
            },
        ) from exc

    category_label = selected or CATEGORY_LABEL_BY_OPERATION.get(
        result["operation"], "문제"
    )
    return {
        "category": category_label,
        "operation": result["operation"],
        "digits": result["digits"],
        "seed": result["seed"],
        "items": result["items"],
        "total": result["count"],
    }


@router.get("/problems/generate", summary="규칙 기반 문제 생성")
async def generate_rules_based_problems(
    op: str = Query("add", description="연산 (add|sub|mul|div)"),
    digits: int = Query(2, ge=1, le=4, description="자릿수"),
    count: int = Query(20, ge=1, le=50, description="생성할 문제 수"),
    seed_value: int | None = Query(None, alias="seed", description="난수 시드"),
    reveal_answers: bool = Query(
        default=False,
        description="정답 포함 여부 (QA/디버깅 전용)",
    ),
) -> dict[str, object]:
    operation = op.lower()
    if operation not in CATEGORY_LABEL_BY_OPERATION:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "type": "https://360me.app/problems/invalid-operation",
                "title": "지원하지 않는 연산",
                "status": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "detail": f"연산 '{op}' 는 지원하지 않습니다.",
            },
        )
    try:
        result = generate_problem_set(
            operation=operation,
            digits=digits,
            count=count,
            seed=seed_value,
            include_answers=reveal_answers,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "type": "https://360me.app/problems/invalid-parameters",
                "title": "문제를 생성할 수 없습니다",
                "status": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "detail": str(exc),
            },
        ) from exc

    return {
        "category": CATEGORY_LABEL_BY_OPERATION.get(result["operation"], "문제"),
        "operation": result["operation"],
        "digits": result["digits"],
        "seed": result["seed"],
        "items": result["items"],
        "total": result["count"],
    }


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
    category_label: str
    correct_answer: int
    try:
        problem = problem_repository.get_problem(problem_id)
        category_label = problem.category
        correct_answer = problem.answer
    except ProblemDataError:
        generated = resolve_generated_problem(problem_id)
        if generated is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "type": "https://360me.app/problems/not-found",
                    "title": "문제를 찾을 수 없습니다",
                    "status": status.HTTP_404_NOT_FOUND,
                    "detail": f"요청한 문제 '{problem_id}'가 존재하지 않습니다.",
                },
            ) from None
        category_label = generated["category"]
        correct_answer = generated["answer"]

    is_correct = int(payload.answer) == int(correct_answer)
    record = attempt_repository.record_attempt(
        problem_id=problem_id,
        submitted_answer=payload.answer,
        is_correct=is_correct,
        user_id=user.id if user is not None else None,
    )

    return ProblemAttemptResponse(
        attempt_id=record.id,
        problem_id=record.problem_id,
        category=category_label,
        is_correct=record.is_correct,
        submitted_answer=record.submitted_answer,
        correct_answer=correct_answer,
        attempted_at=record.attempted_at,
    )


__all__ = ["router"]
