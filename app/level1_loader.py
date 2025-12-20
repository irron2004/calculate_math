"""Loader utilities for the Level 1 subjective practice dataset."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set

try:  # pragma: no cover - optional import for pydantic v2+
    from pydantic import ValidationError
except ImportError:  # pragma: no cover - pydantic v1 fallback
    from pydantic import ValidationError  # type: ignore[no-redef]

from .config import Settings, get_settings
from .schemas.level1 import Level1Dataset


class Level1DataError(RuntimeError):
    """Raised when the Level 1 dataset cannot be loaded or parsed."""


@dataclass(frozen=True)
class Level1ValidationIssue:
    kind: str
    message: str
    skill_id: str | None = None
    problem_id: str | None = None
    order: int | None = None
    problem_ids: List[str] | None = None
    grading_mode: str | None = None
    answer_type: str | None = None

    def to_dict(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"kind": self.kind, "message": self.message}
        if self.skill_id is not None:
            payload["skill_id"] = self.skill_id
        if self.problem_id is not None:
            payload["problem_id"] = self.problem_id
        if self.order is not None:
            payload["order"] = self.order
        if self.problem_ids is not None:
            payload["problem_ids"] = list(self.problem_ids)
        if self.grading_mode is not None:
            payload["grading_mode"] = self.grading_mode
        if self.answer_type is not None:
            payload["answer_type"] = self.answer_type
        return payload


class Level1ValidationError(Level1DataError):
    def __init__(self, issues: List[Level1ValidationIssue]) -> None:
        super().__init__("Level 1 dataset validation failed")
        self.issues = issues


def _resolve_dataset_path(settings: Settings) -> Path:
    path = settings.level1_data_path
    if not path.exists():
        raise Level1DataError(f"Level 1 dataset not found at {path}")
    return path


def _load_raw_dataset(path: Path) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise Level1DataError(f"Level 1 dataset not found at {path}") from exc
    except json.JSONDecodeError as exc:
        raise Level1DataError(f"Invalid Level 1 dataset format at {path}") from exc


def _parse_dataset(raw: Dict[str, Any]) -> Level1Dataset:
    if "skills" not in raw or "problems" not in raw:
        raise Level1DataError("Level 1 dataset must include 'skills' and 'problems'")
    validator = getattr(Level1Dataset, "model_validate", None)
    try:
        if validator is not None:
            return validator(raw)
        return Level1Dataset.parse_obj(raw)
    except ValidationError as exc:
        raise Level1DataError("Level 1 dataset schema is invalid") from exc


def _find_duplicates(items: Iterable[str]) -> Set[str]:
    seen: Set[str] = set()
    duplicates: Set[str] = set()
    for item in items:
        if item in seen:
            duplicates.add(item)
        else:
            seen.add(item)
    return duplicates


def validate_level1_dataset(dataset: Level1Dataset) -> List[Level1ValidationIssue]:
    issues: List[Level1ValidationIssue] = []

    skill_ids = [skill.skill_id for skill in dataset.skills]
    problem_ids = [problem.problem_id for problem in dataset.problems]
    skill_id_set = set(skill_ids)
    problem_id_set = set(problem_ids)

    for skill_id in sorted(_find_duplicates(skill_ids)):
        issues.append(
            Level1ValidationIssue(
                kind="duplicate_skill_id",
                skill_id=skill_id,
                message="Duplicate skill_id detected.",
            )
        )

    for problem_id in sorted(_find_duplicates(problem_ids)):
        issues.append(
            Level1ValidationIssue(
                kind="duplicate_problem_id",
                problem_id=problem_id,
                message="Duplicate problem_id detected.",
            )
        )

    for problem in dataset.problems:
        if problem.primary_skill_id not in skill_id_set:
            issues.append(
                Level1ValidationIssue(
                    kind="missing_skill",
                    skill_id=problem.primary_skill_id,
                    problem_id=problem.problem_id,
                    message="Problem references missing primary_skill_id.",
                )
            )

    for skill in dataset.skills:
        for problem_id in skill.problem_ids:
            if problem_id not in problem_id_set:
                issues.append(
                    Level1ValidationIssue(
                        kind="missing_problem",
                        skill_id=skill.skill_id,
                        problem_id=problem_id,
                        message="Skill references missing problem_id.",
                    )
                )

    orders_by_skill: Dict[str, Dict[int, List[str]]] = {}
    for problem in dataset.problems:
        if problem.primary_skill_id not in skill_id_set:
            continue
        orders = orders_by_skill.setdefault(problem.primary_skill_id, {})
        orders.setdefault(problem.order, []).append(problem.problem_id)

    for skill_id, orders in orders_by_skill.items():
        for order, grouped in orders.items():
            if len(grouped) > 1:
                issues.append(
                    Level1ValidationIssue(
                        kind="duplicate_order",
                        skill_id=skill_id,
                        order=order,
                        problem_ids=sorted(grouped),
                        message="Duplicate order detected for skill.",
                    )
                )

    allowed_modes = {
        "numeric_equal": "number",
        "exact_string": "string",
    }
    allowed_answer_types = {"number", "string"}

    for problem in dataset.problems:
        mode = (problem.grading.mode or "").strip()
        answer_type = (problem.answer.type or "").strip()
        if mode not in allowed_modes:
            issues.append(
                Level1ValidationIssue(
                    kind="invalid_grading_mode",
                    problem_id=problem.problem_id,
                    grading_mode=mode,
                    message="Grading mode is not supported.",
                )
            )
            continue
        if answer_type not in allowed_answer_types:
            issues.append(
                Level1ValidationIssue(
                    kind="invalid_answer_type",
                    problem_id=problem.problem_id,
                    answer_type=answer_type,
                    message="Answer type is not supported.",
                )
            )
            continue
        expected = allowed_modes[mode]
        if answer_type != expected:
            issues.append(
                Level1ValidationIssue(
                    kind="incompatible_grading",
                    problem_id=problem.problem_id,
                    grading_mode=mode,
                    answer_type=answer_type,
                    message="Grading mode is incompatible with answer type.",
                )
            )

    return issues


def load_level1_dataset() -> Level1Dataset:
    settings = get_settings()
    path = _resolve_dataset_path(settings)
    payload = _load_raw_dataset(path)
    dataset = _parse_dataset(payload)
    issues = validate_level1_dataset(dataset)
    if issues:
        raise Level1ValidationError(issues)
    return dataset


@lru_cache(maxsize=1)
def get_level1_dataset() -> Level1Dataset:
    return load_level1_dataset()


def reset_level1_cache() -> None:
    get_level1_dataset.cache_clear()


__all__ = [
    "Level1DataError",
    "Level1ValidationError",
    "Level1ValidationIssue",
    "get_level1_dataset",
    "load_level1_dataset",
    "reset_level1_cache",
    "validate_level1_dataset",
]
