from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from threading import RLock
from typing import Any, Dict, Iterable, List

from .config import get_settings


class BridgeDataError(RuntimeError):
    """Raised when bridge unit data cannot be loaded or parsed."""


@dataclass(frozen=True, slots=True)
class BridgeProblem:
    id: str
    type: str
    prompt: str
    representation: str
    raw: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "id": self.id,
            "type": self.type,
            "prompt": self.prompt,
            "representation": self.representation,
        }
        payload.update(self.raw)
        return payload


@dataclass(frozen=True, slots=True)
class BridgeUnit:
    sequence_id: str
    title: str
    node: str
    lens: str
    representation_flow: List[str]
    description: str
    problems: List[BridgeProblem]

    def summary(self) -> Dict[str, Any]:
        return {
            "sequence_id": self.sequence_id,
            "title": self.title,
            "node": self.node,
            "lens": self.lens,
            "description": self.description,
            "problem_count": len(self.problems),
            "representation_flow": self.representation_flow,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            **self.summary(),
            "problems": [problem.to_dict() for problem in self.problems],
        }


class BridgeRepository:
    def __init__(self, source_path: Path):
        self.source_path = Path(source_path)
        self._lock = RLock()
        self._cache: Dict[str, BridgeUnit] = {}
        self._last_loaded_at: float | None = None

    def refresh(self, *, force: bool = False) -> None:
        with self._lock:
            try:
                mtime = self.source_path.stat().st_mtime
            except FileNotFoundError as exc:
                raise BridgeDataError(
                    f"Bridge data source not found: {self.source_path}"
                ) from exc

            if not force and self._last_loaded_at and mtime <= self._last_loaded_at:
                return

            raw_text = self.source_path.read_text(encoding="utf-8")
            try:
                parsed = json.loads(raw_text)
            except json.JSONDecodeError as exc:
                raise BridgeDataError(
                    f"Invalid bridge data format in {self.source_path}"
                ) from exc

            units = list(self._coerce_units(parsed))
            if not units:
                raise BridgeDataError("No bridge units discovered in dataset")

            self._cache = {unit.sequence_id: unit for unit in units}
            self._last_loaded_at = mtime

    def _coerce_units(self, parsed: Any) -> Iterable[BridgeUnit]:
        if not isinstance(parsed, list):
            raise BridgeDataError("Bridge dataset must be a list")

        for raw in parsed:
            if not isinstance(raw, dict):
                raise BridgeDataError("Bridge unit must be an object")

            sequence_id = str(raw.get("sequence_id", "")).strip()
            if not sequence_id:
                raise BridgeDataError("Bridge unit missing sequence_id")

            problems_payload = raw.get("problems")
            if not isinstance(problems_payload, list) or not problems_payload:
                raise BridgeDataError(
                    f"Bridge unit '{sequence_id}' must include at least one problem"
                )

            problems = []
            for problem_raw in problems_payload:
                if not isinstance(problem_raw, dict):
                    raise BridgeDataError(
                        f"Bridge unit '{sequence_id}' problem entry must be an object"
                    )
                problem_id = str(problem_raw.get("id", "")).strip()
                problem_type = str(problem_raw.get("type", "")).strip()
                prompt = str(problem_raw.get("prompt", "")).strip()
                representation = str(problem_raw.get("representation", "")).strip()

                if not all([problem_id, problem_type, prompt, representation]):
                    raise BridgeDataError(
                        f"Bridge unit '{sequence_id}' problem is missing required fields"
                    )

                remaining = {
                    key: value
                    for key, value in problem_raw.items()
                    if key not in {"id", "type", "prompt", "representation"}
                }
                problems.append(
                    BridgeProblem(
                        id=problem_id,
                        type=problem_type,
                        prompt=prompt,
                        representation=representation,
                        raw=remaining,
                    )
                )

            representation_flow = raw.get("representation_flow")
            if isinstance(representation_flow, list):
                flow = [str(item) for item in representation_flow]
            else:
                flow = []

            unit = BridgeUnit(
                sequence_id=sequence_id,
                title=str(raw.get("title", sequence_id)),
                node=str(raw.get("node", "")),
                lens=str(raw.get("lens", "")),
                representation_flow=flow,
                description=str(raw.get("description", "")),
                problems=problems,
            )
            yield unit

    def _ensure_loaded(self) -> None:
        if not self._cache:
            self.refresh()

    def list_units(self) -> List[BridgeUnit]:
        self._ensure_loaded()
        return list(self._cache.values())

    def get_unit(self, sequence_id: str) -> BridgeUnit:
        self._ensure_loaded()
        try:
            return self._cache[sequence_id]
        except KeyError as exc:
            raise BridgeDataError(f"Bridge unit '{sequence_id}' not found") from exc


_repository_lock = RLock()
_repository: BridgeRepository | None = None


def get_repository() -> BridgeRepository:
    global _repository
    with _repository_lock:
        if _repository is None:
            settings = get_settings()
            data_path = Path(settings.problem_data_path).with_name("s2_bridge.json")
            repository = BridgeRepository(data_path)
            _repository = repository
        return _repository


def refresh_cache(*, force: bool = False) -> BridgeRepository:
    repository = get_repository()
    repository.refresh(force=force)
    return repository


def list_bridge_units() -> List[BridgeUnit]:
    repository = refresh_cache()
    return repository.list_units()


def get_bridge_unit(sequence_id: str) -> BridgeUnit:
    repository = refresh_cache()
    return repository.get_unit(sequence_id)


__all__ = [
    "BridgeDataError",
    "BridgeProblem",
    "BridgeUnit",
    "get_bridge_unit",
    "list_bridge_units",
    "refresh_cache",
]
