from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from ..repositories import LRCRepository
from ..template_engine import (
    ConceptNotFound,
    TemplateNotFound,
    TemplateEngineError,
    ConceptNode,
    ItemInstance,
    list_concepts,
    list_templates,
    get_concept,
    generate_item,
)

router = APIRouter(prefix="/api/v1", tags=["curriculum"])


class ConceptResponse(BaseModel):
    id: str
    name: str
    lens: List[str]
    prerequisites: List[str]
    transfers: List[str]
    summary: str
    stage_span: List[str]
    focus_keywords: List[str]

    @classmethod
    def from_node(cls, node: ConceptNode) -> "ConceptResponse":
        return cls(**node.to_dict())


class TemplateSummaryResponse(BaseModel):
    id: str
    concept: str
    step: str
    lens: List[str]
    representation: str
    context_pack: List[str]
    rubric_keywords: List[str]
    parameter_names: List[str]


class TemplateGenerateRequest(BaseModel):
    seed: int | None = Field(default=None, ge=0, le=2**31 - 1)
    context: str | None = Field(default=None, description="선호 컨텍스트 (life/table/geometry 등)")


class TemplateGenerateResponse(BaseModel):
    id: str
    template_id: str
    concept: str
    step: str
    prompt: str
    explanation: str
    answer: int
    options: List[int]
    context: str
    lens: List[str]
    representation: str
    rubric_keywords: List[str]
    variables: dict[str, object]

    @classmethod
    def from_instance(cls, instance: ItemInstance) -> "TemplateGenerateResponse":
        payload = instance.to_dict()
        payload["options"] = list(payload["options"])
        payload["lens"] = list(payload["lens"])
        payload["rubric_keywords"] = list(payload["rubric_keywords"])
        return cls(**payload)


class LRCMetric(BaseModel):
    value: float = Field(..., ge=0.0, le=1.0)
    threshold: float = Field(..., ge=0.0, le=1.0)
    met: bool


class LRCEvaluateResponse(BaseModel):
    passed: bool
    status: str
    metrics: dict[str, LRCMetric]
    recommendation: str
    focus_concept: str | None = None
    evaluated_at: str | None = None


class LRCEvaluateRequest(BaseModel):
    accuracy: float = Field(..., ge=0.0, le=1.0, description="정답률 (0~1)")
    rt_percentile: float = Field(..., ge=0.0, le=1.0, description="반응시간 백분위 (0~1)")
    rubric: float = Field(..., ge=0.0, le=1.0, description="설명 루브릭 점수 (0~1)")
    user_id: str | None = Field(default=None, description="평가 결과를 저장할 사용자 ID")
    focus_concept: str | None = Field(default=None, description="이번 세션의 핵심 콘셉트 ID")


THRESHOLDS = {
    "accuracy": 0.90,
    "rt_percentile": 0.60,
    "rubric": 0.75,
}
_NEAR_MISS_MARGIN = 0.05


def _resolve_lrc_repository(request: Request) -> LRCRepository | None:
    repository = getattr(request.app.state, "lrc_repository", None)
    if isinstance(repository, LRCRepository):
        return repository
    return None


@router.get("/concepts", response_model=List[ConceptResponse])
async def api_list_concepts(step: str | None = Query(default=None)) -> List[ConceptResponse]:
    nodes = list_concepts()
    if step:
        normalized = step.upper()
        nodes = [node for node in nodes if normalized in {s.upper() for s in node.stage_span}]
    return [ConceptResponse.from_node(node) for node in nodes]


@router.get("/concepts/{concept_id}", response_model=ConceptResponse)
async def api_get_concept(concept_id: str) -> ConceptResponse:
    try:
        node = get_concept(concept_id)
    except ConceptNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="concept not found") from exc
    return ConceptResponse.from_node(node)


@router.get("/templates", response_model=List[TemplateSummaryResponse])
async def api_list_templates(
    concept: str | None = Query(default=None),
    step: str | None = Query(default=None),
) -> List[TemplateSummaryResponse]:
    templates = list_templates(concept=concept, step=step)
    response: List[TemplateSummaryResponse] = []
    for template in templates:
        brief = template.to_brief_dict()
        response.append(TemplateSummaryResponse(**brief))
    return response


@router.post(
    "/templates/{template_id}/generate",
    response_model=TemplateGenerateResponse,
)
async def api_generate_template(
    template_id: str,
    payload: TemplateGenerateRequest | None = None,
) -> TemplateGenerateResponse:
    seed = payload.seed if payload else None
    context = payload.context if payload else None
    try:
        instance = generate_item(template_id, seed=seed, context=context)
    except TemplateNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="template not found") from exc
    except TemplateEngineError as exc:  # type: ignore[name-defined]
        # TemplateEngineError is defined in template_engine; import lazily to avoid circular import.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TemplateGenerateResponse.from_instance(instance)


@router.post("/lrc/evaluate", response_model=LRCEvaluateResponse)
async def api_evaluate_lrc(payload: LRCEvaluateRequest, request: Request) -> LRCEvaluateResponse:
    metrics: dict[str, LRCMetric] = {}
    misses = 0
    near_misses = 0
    for key, threshold in THRESHOLDS.items():
        value = getattr(payload, key)
        met = value >= threshold
        metrics[key] = LRCMetric(value=value, threshold=threshold, met=met)
        if not met:
            misses += 1
            if value >= threshold - _NEAR_MISS_MARGIN:
                near_misses += 1
    if misses == 0:
        recommendation = "promote"
        status_label = "passed"
        passed = True
    elif misses == 1 and near_misses == 1:
        recommendation = "reinforce"
        status_label = "near-miss"
        passed = False
    else:
        recommendation = "remediate"
        status_label = "retry"
        passed = False
    evaluated_at = datetime.now(timezone.utc)
    recorded_at_iso = evaluated_at.isoformat()
    focus_concept = payload.focus_concept

    repository = None
    if payload.user_id:
        repository = _resolve_lrc_repository(request)
        if repository is not None:
            record = repository.record_result(
                user_id=payload.user_id,
                accuracy=payload.accuracy,
                rt_percentile=payload.rt_percentile,
                rubric=payload.rubric,
                passed=passed,
                status=status_label,
                recommendation=recommendation,
                focus_concept=focus_concept,
            )
            recorded_at_iso = record.evaluated_at.isoformat()
            focus_concept = record.focus_concept

    return LRCEvaluateResponse(
        passed=passed,
        status=status_label,
        metrics=metrics,
        recommendation=recommendation,
        focus_concept=focus_concept,
        evaluated_at=recorded_at_iso,
    )


@router.get("/lrc/last", response_model=LRCEvaluateResponse)
async def api_get_last_lrc(request: Request, user_id: str = Query(...)) -> LRCEvaluateResponse:
    repository = _resolve_lrc_repository(request)
    if repository is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="lrc repository not available")

    record = repository.get_latest(user_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="lrc result not found")

    metrics = {
        "accuracy": LRCMetric(
            value=record.accuracy,
            threshold=THRESHOLDS["accuracy"],
            met=record.accuracy >= THRESHOLDS["accuracy"],
        ),
        "rt_percentile": LRCMetric(
            value=record.rt_percentile,
            threshold=THRESHOLDS["rt_percentile"],
            met=record.rt_percentile >= THRESHOLDS["rt_percentile"],
        ),
        "rubric": LRCMetric(
            value=record.rubric,
            threshold=THRESHOLDS["rubric"],
            met=record.rubric >= THRESHOLDS["rubric"],
        ),
    }

    return LRCEvaluateResponse(
        passed=record.passed,
        status=record.status,
        metrics=metrics,
        recommendation=record.recommendation,
        focus_concept=record.focus_concept,
        evaluated_at=record.evaluated_at.isoformat(),
    )


__all__ = ["router"]
