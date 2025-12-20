"""Schema definitions for the Level 1 subjective practice dataset."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

try:  # pragma: no cover - optional import for pydantic v2+
    from pydantic import BaseModel, ConfigDict, Field
except ImportError:  # pragma: no cover - pydantic v1 fallback
    from pydantic import BaseModel, Field

    ConfigDict = None  # type: ignore[assignment]


class _BaseModel(BaseModel):
    if ConfigDict is not None:  # pragma: no branch - prefer v2 config when available
        model_config = ConfigDict(extra="allow")
    else:  # pragma: no cover - v1 compatibility
        class Config:
            extra = "allow"


class Grading(_BaseModel):
    mode: str
    normalize: List[str] = Field(default_factory=list)


class Answer(_BaseModel):
    type: str
    value: Any


class Problem(_BaseModel):
    problem_id: str
    primary_skill_id: str
    order: int
    prompt: str
    answer: Answer
    grading: Grading


class Skill(_BaseModel):
    skill_id: str
    title: str
    description: Optional[str] = None
    problem_ids: List[str] = Field(default_factory=list)


class Attempt(_BaseModel):
    attempt_id: str
    skill_id: str
    problem_id: str
    response: str
    correct: bool
    submitted_at: Optional[datetime] = None


class Level1Dataset(_BaseModel):
    version: Optional[str] = None
    skills: List[Skill]
    problems: List[Problem]
    meta: Dict[str, Any] = Field(default_factory=dict)


__all__ = [
    "Answer",
    "Attempt",
    "Grading",
    "Level1Dataset",
    "Problem",
    "Skill",
]
