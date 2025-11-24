from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ..problem_bank import (
    ProblemDataError,
    ProblemRepository,
    get_repository as get_problem_repository,
)
from ..services.problem_generation import resolve_generated_problem
from ..skills_loader import get_skill_graph

router = APIRouter(prefix="/api/v1", tags=["skill-problems"])


class SkillProblemSummary(BaseModel):
    id: str
    skill_id: str
    category: str
    question: str
    hint: str | None = None


class SkillProblemListResponse(BaseModel):
    skill_id: str
    category: str
    total: int
    items: list[SkillProblemSummary]


class ProblemDetailResponse(SkillProblemSummary):
    answer: int | None = Field(
        default=None,
        description="정답(디버깅/QA용). 기본 응답에는 포함되지 않습니다.",
    )


def _infer_category(skill_id: str) -> str:
    lowered = skill_id.lower()
    if "mul" in lowered or "x" in lowered or "곱" in skill_id:
        return "곱셈"
    if "div" in lowered or "나눗" in skill_id or "분수" in skill_id:
        return "나눗셈"
    if "sub" in lowered or "minus" in lowered or "뺄" in skill_id:
        return "뺄셈"
    return "덧셈"


def _skill_exists(skill_id: str) -> bool:
    try:
        graph = get_skill_graph()
    except Exception:
        return True
    return any(node.id == skill_id for node in graph.nodes)


@router.get(
    "/skills/{skill_id}/problems",
    response_model=SkillProblemListResponse,
    summary="스킬에 연결된 문제 목록 반환 (시드 기반)",
)
async def list_skill_problems(
    skill_id: str,
    limit: int = Query(5, ge=1, le=50),
    reveal_answers: bool = Query(
        default=False,
        description="디버깅용으로 정답을 포함합니다. 프로덕션에서는 사용하지 마세요.",
    ),
    repository: ProblemRepository = Depends(get_problem_repository),
) -> SkillProblemListResponse:
    if not _skill_exists(skill_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": f"스킬 '{skill_id}'을 찾을 수 없습니다."},
        )

    category = _infer_category(skill_id)
    try:
        problems = repository.get_problems(category)
    except ProblemDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "문제 데이터를 불러오지 못했습니다."},
        ) from exc

    items: list[SkillProblemSummary] = []
    for problem in problems[:limit]:
        items.append(
            SkillProblemSummary(
                id=problem.id,
                skill_id=skill_id,
                category=problem.category,
                question=problem.question,
                hint=problem.hint,
            )
        )

    return SkillProblemListResponse(
        skill_id=skill_id,
        category=category,
        total=len(problems),
        items=items,
    )


@router.get(
    "/problems/{problem_id}",
    response_model=ProblemDetailResponse,
    summary="문제 상세 조회 (시드/생성형)",
)
async def problem_detail(
    problem_id: str,
    reveal_answer: bool = Query(
        default=False,
        description="디버깅용으로 정답을 포함합니다. 프로덕션에서는 사용하지 마세요.",
    ),
    repository: ProblemRepository = Depends(get_problem_repository),
) -> ProblemDetailResponse:
    try:
        problem = repository.get_problem(problem_id)
        return ProblemDetailResponse(
            id=problem.id,
            skill_id=problem.category,
            category=problem.category,
            question=problem.question,
            hint=problem.hint,
            answer=problem.answer if reveal_answer else None,
        )
    except ProblemDataError:
        generated: Optional[dict[str, object]] = resolve_generated_problem(problem_id)
        if generated is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": f"문제 '{problem_id}'를 찾을 수 없습니다."},
            ) from None
        return ProblemDetailResponse(
            id=problem_id,
            skill_id=str(generated.get("category") or ""),
            category=str(generated.get("category") or "문제"),
            question="생성형 문제",
            hint=None,
            answer=int(generated.get("answer")) if reveal_answer else None,
        )


__all__ = ["router"]
