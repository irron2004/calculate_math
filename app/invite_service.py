from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from threading import Lock
from typing import Dict, Optional

from .config import get_settings


@dataclass(slots=True)
class InviteSummary:
    total: int
    correct: int

    @property
    def accuracy(self) -> int:
        if self.total <= 0:
            return 0
        percentage = round((self.correct / self.total) * 100)
        return max(0, min(100, percentage))

    def to_dict(self) -> dict[str, int]:
        data = asdict(self)
        data["accuracy"] = self.accuracy
        return data


@dataclass(slots=True)
class InviteSession:
    token: str
    category: str
    created_at: datetime
    expires_at: datetime
    summary: InviteSummary | None = None

    def is_expired(self, *, reference: Optional[datetime] = None) -> bool:
        point_in_time = reference or datetime.now(timezone.utc)
        return point_in_time >= self.expires_at

    def to_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "token": self.token,
            "category": self.category,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
        }
        if self.summary:
            payload["summary"] = self.summary.to_dict()
        return payload


class InviteStore:
    """In-memory store for invite sessions with TTL handling."""

    def __init__(self, *, ttl_minutes: int = 120, token_bytes: int = 16) -> None:
        self._ttl = timedelta(minutes=max(ttl_minutes, 1))
        self._token_bytes = max(token_bytes, 8)
        self._storage: Dict[str, InviteSession] = {}
        self._lock = Lock()

    def create(
        self,
        *,
        category: str,
        summary: InviteSummary | None = None,
    ) -> InviteSession:
        now = datetime.now(timezone.utc)
        token = token_urlsafe(self._token_bytes)
        session = InviteSession(
            token=token,
            category=category,
            created_at=now,
            expires_at=now + self._ttl,
            summary=summary,
        )
        with self._lock:
            self._storage[token] = session
        return session

    def get(self, token: str) -> InviteSession | None:
        now = datetime.now(timezone.utc)
        with self._lock:
            session = self._storage.get(token)
            if session is None:
                return None
            if session.is_expired(reference=now):
                self._storage.pop(token, None)
                return None
            return session

    def expire(self, token: str) -> InviteSession | None:
        with self._lock:
            return self._storage.pop(token, None)

    def purge_expired(self) -> None:
        now = datetime.now(timezone.utc)
        with self._lock:
            expired_tokens = [token for token, session in self._storage.items() if session.is_expired(reference=now)]
            for token in expired_tokens:
                self._storage.pop(token, None)


_settings = get_settings()
invite_store = InviteStore(
    ttl_minutes=getattr(_settings, "invite_token_ttl_minutes", 180),
    token_bytes=getattr(_settings, "invite_token_bytes", 16),
)

__all__ = ["InviteStore", "InviteSession", "InviteSummary", "invite_store"]
