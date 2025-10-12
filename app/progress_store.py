"""Lightweight read-only store for curriculum DAG progress snapshots."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any, Dict, Iterable, Optional

from pydantic import BaseModel, Field, validator

from .config import Settings, get_settings


class ProgressDataError(RuntimeError):
    """Raised when the progress dataset cannot be loaded or parsed."""


class NodeProgress(BaseModel):
    """Progress information for a single course step node."""

    xp_earned: int = 0
    xp_required: Optional[int] = None
    level: Optional[int] = None
    unlocked: bool = False
    completed: bool = False
    lrc_status: str = "pending"
    lrc_metrics: Dict[str, float] = Field(default_factory=dict)
    attempts: Optional[int] = None


class SkillProgress(BaseModel):
    """Progress information for an atomic skill."""

    level: int = 0
    xp: int = 0


class ProgressSnapshot(BaseModel):
    """Aggregated curriculum progress for a learner."""

    user_id: str
    updated_at: datetime
    total_xp: int = 0
    nodes: Dict[str, NodeProgress] = Field(default_factory=dict)
    skills: Dict[str, SkillProgress] = Field(default_factory=dict)

    @validator("updated_at", pre=True)
    def _coerce_datetime(cls, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        if isinstance(value, str) and value:
            try:
                parsed = datetime.fromisoformat(value)
            except ValueError as exc:
                raise ProgressDataError("Invalid datetime format in progress dataset") from exc
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        return datetime.now(tz=timezone.utc)


@dataclass
class _ParsedDataset:
    meta: Dict[str, Any]
    records: Dict[str, ProgressSnapshot]


class ProgressStore:
    """Read-only store backed by a JSON dataset."""

    def __init__(self, source_path: Path):
        self.source_path = Path(source_path)
        self._lock = RLock()
        self._cache: Dict[str, ProgressSnapshot] | None = None
        self._meta: Dict[str, Any] = {}
        self._last_loaded_at: float | None = None

    @property
    def meta(self) -> Dict[str, Any]:
        self._ensure_loaded()
        return self._meta

    def refresh(self, *, force: bool = False) -> None:
        with self._lock:
            try:
                mtime = self.source_path.stat().st_mtime
            except FileNotFoundError as exc:
                raise ProgressDataError(
                    f"Progress dataset not found at {self.source_path}"
                ) from exc

            if not force and self._last_loaded_at and mtime <= self._last_loaded_at:
                return

            raw_text = self.source_path.read_text(encoding="utf-8")
            try:
                parsed = json.loads(raw_text)
            except json.JSONDecodeError as exc:
                raise ProgressDataError(
                    f"Invalid progress dataset format in {self.source_path}"
                ) from exc

            dataset = self._coerce_dataset(parsed)
            self._cache = dataset.records
            self._meta = dataset.meta
            self._last_loaded_at = mtime

    def _ensure_loaded(self) -> None:
        if self._cache is None:
            self.refresh()

    def _coerce_dataset(self, payload: Any) -> _ParsedDataset:
        if not isinstance(payload, dict):
            raise ProgressDataError("Progress dataset must be a JSON object")

        meta = payload.get("meta") or {}
        raw_users = payload.get("users")
        if raw_users is None:
            raise ProgressDataError("Progress dataset must include a 'users' list")
        if not isinstance(raw_users, list):
            raise ProgressDataError("Progress dataset 'users' section must be a list")

        records: Dict[str, ProgressSnapshot] = {}
        for raw in raw_users:
            if not isinstance(raw, dict):
                raise ProgressDataError("Progress record must be an object")
            user_id = str(raw.get("user_id", "")).strip()
            if not user_id:
                raise ProgressDataError("Progress record missing user_id")
            snapshot = ProgressSnapshot.parse_obj({
                **raw,
                "user_id": user_id,
            })
            records[user_id] = snapshot
        return _ParsedDataset(meta=meta, records=records)

    def get_snapshot(self, user_id: str | int) -> ProgressSnapshot:
        self._ensure_loaded()
        key = str(user_id)
        if self._cache is None:
            raise ProgressDataError("Progress store is not initialised")
        snapshot = self._cache.get(key)
        if snapshot is not None:
            return snapshot
        return ProgressSnapshot(
            user_id=key,
            updated_at=datetime.now(tz=timezone.utc),
        )

    def list_user_ids(self) -> Iterable[str]:
        self._ensure_loaded()
        if self._cache is None:
            return []
        return list(self._cache.keys())


_store_lock = RLock()
_store: ProgressStore | None = None


def _resolve_dataset_path(settings: Settings) -> Path:
    path = settings.progress_data_path
    if not path.exists():
        raise ProgressDataError(f"Progress dataset not found at {path}")
    return path


def get_progress_store() -> ProgressStore:
    global _store
    with _store_lock:
        if _store is None:
            settings = get_settings()
            path = _resolve_dataset_path(settings)
            _store = ProgressStore(path)
        return _store


def refresh_progress_store(*, force: bool = False) -> ProgressStore:
    store = get_progress_store()
    store.refresh(force=force)
    return store


def reset_progress_store() -> None:
    global _store
    with _store_lock:
        _store = None


__all__ = [
    "NodeProgress",
    "ProgressDataError",
    "ProgressSnapshot",
    "ProgressStore",
    "SkillProgress",
    "get_progress_store",
    "refresh_progress_store",
    "reset_progress_store",
]
