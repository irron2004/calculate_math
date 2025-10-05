from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import Any, Dict, Iterable, List

from .config import get_settings


class ProblemDataError(RuntimeError):
    """Base exception for problem data related errors."""


class ProblemDataNotFound(ProblemDataError):
    """Raised when the problem data source cannot be located."""


class ProblemDataFormatError(ProblemDataError):
    """Raised when the problem data source cannot be parsed."""


@dataclass(frozen=True, slots=True)
class Problem:
    id: str
    category: str
    question: str
    answer: int
    hint: str | None = None

    def to_dict(self, *, include_answer: bool = False) -> dict[str, Any]:
        data: dict[str, Any] = {
            "id": self.id,
            "category": self.category,
            "question": self.question,
        }
        if self.hint is not None:
            data["hint"] = self.hint
        if include_answer:
            data["answer"] = self.answer
        return data


class ProblemRepository:
    """Repository that loads problem data from an external JSON/CSV source."""

    def __init__(self, source_path: Path):
        self.source_path = Path(source_path)
        self._lock = RLock()
        self._cache: Dict[str, List[Problem]] = {}
        self._problem_by_id: Dict[str, Problem] = {}
        self._last_loaded_at: float | None = None

    def refresh(self, *, force: bool = False) -> None:
        with self._lock:
            try:
                mtime = self.source_path.stat().st_mtime
            except FileNotFoundError as exc:
                raise ProblemDataNotFound(
                    f"Problem data source not found: {self.source_path}"
                ) from exc

            if not force and self._last_loaded_at is not None:
                if mtime <= self._last_loaded_at:
                    return

            raw_text = self.source_path.read_text(encoding="utf-8")
            try:
                parsed = json.loads(raw_text)
            except json.JSONDecodeError as exc:
                raise ProblemDataFormatError(
                    f"Invalid problem data format in {self.source_path}"
                ) from exc

            problems = list(self._coerce_records(parsed))
            if not problems:
                raise ProblemDataFormatError(
                    f"No problem entries discovered in {self.source_path}"
                )

            cache: Dict[str, List[Problem]] = {}
            problem_by_id: Dict[str, Problem] = {}
            for problem in problems:
                cache.setdefault(problem.category, []).append(problem)
                problem_by_id[problem.id] = problem

            self._cache = cache
            self._problem_by_id = problem_by_id
            self._last_loaded_at = mtime

    def _ensure_loaded(self) -> None:
        if not self._cache:
            self.refresh()

    def list_categories(self) -> List[str]:
        self._ensure_loaded()
        return list(self._cache.keys())

    def get_problems(self, category: str) -> List[Problem]:
        self._ensure_loaded()
        if category in self._cache:
            return self._cache[category]
        if not self._cache:
            raise ProblemDataError("Problem data cache is empty")
        first_category = next(iter(self._cache))
        return self._cache[first_category]

    def get_problem(self, problem_id: str) -> Problem:
        self._ensure_loaded()
        try:
            return self._problem_by_id[problem_id]
        except KeyError as exc:
            raise ProblemDataError(f"Problem '{problem_id}' does not exist") from exc

    def __len__(self) -> int:
        self._ensure_loaded()
        return sum(len(items) for items in self._cache.values())

    def _coerce_records(self, parsed: Any) -> Iterable[Problem]:
        if isinstance(parsed, dict):
            for category, entries in parsed.items():
                if not isinstance(entries, list):
                    raise ProblemDataFormatError(
                        "Expected list of problem entries per category"
                    )
                for index, raw in enumerate(entries, start=1):
                    yield self._build_problem(raw, category=category, index=index)
        elif isinstance(parsed, list):
            for index, raw in enumerate(parsed, start=1):
                category = raw.get("category") if isinstance(raw, dict) else None
                yield self._build_problem(raw, category=category, index=index)
        else:
            raise ProblemDataFormatError("Unsupported problem data structure")

    def _build_problem(
        self, raw: Any, *, category: str | None, index: int
    ) -> Problem:
        if not isinstance(raw, dict):
            raise ProblemDataFormatError("Problem entry must be an object")

        resolved_category = category or raw.get("category")
        if not resolved_category:
            raise ProblemDataFormatError("Problem entry is missing category")

        question = raw.get("question")
        answer = raw.get("answer")
        if question is None or answer is None:
            raise ProblemDataFormatError(
                "Problem entry must include question and answer"
            )

        try:
            answer_value = int(answer)
        except (TypeError, ValueError) as exc:
            raise ProblemDataFormatError(
                f"Problem '{question}' has invalid answer value"
            ) from exc

        hint = raw.get("hint")
        problem_id = raw.get("id") or f"{resolved_category}-{index}"

        return Problem(
            id=str(problem_id),
            category=str(resolved_category),
            question=str(question),
            answer=answer_value,
            hint=str(hint) if hint is not None else None,
        )


_repository_lock = RLock()
_repository: ProblemRepository | None = None


def get_repository() -> ProblemRepository:
    global _repository
    with _repository_lock:
        if _repository is None:
            settings = get_settings()
            repository = ProblemRepository(Path(settings.problem_data_path))
            _repository = repository
        return _repository


def refresh_cache(*, force: bool = False) -> ProblemRepository:
    repository = get_repository()
    repository.refresh(force=force)
    return repository


def list_categories() -> List[str]:
    repository = refresh_cache()
    return repository.list_categories()


def get_problems(category: str) -> List[Problem]:
    repository = refresh_cache()
    return repository.get_problems(category)


def get_problem(problem_id: str) -> Problem:
    repository = refresh_cache()
    return repository.get_problem(problem_id)


def get_random_problem(category: str) -> Problem:
    import random

    problems = get_problems(category)
    if not problems:
        raise ProblemDataError(f"No problems available for category '{category}'")
    return random.choice(problems)


def reset_cache() -> None:
    global _repository
    with _repository_lock:
        _repository = None


__all__ = [
    "Problem",
    "ProblemRepository",
    "ProblemDataError",
    "ProblemDataNotFound",
    "ProblemDataFormatError",
    "get_repository",
    "refresh_cache",
    "list_categories",
    "get_problems",
    "get_problem",
    "get_random_problem",
    "reset_cache",
]

