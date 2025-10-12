"""Authentication helpers and dependencies for API routers."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status

from ..config import Settings, get_settings
from ..repositories import (
    SessionRecord,
    SessionRepository,
    UserRecord,
    UserRepository,
)


@dataclass(frozen=True)
class SessionValidationResult:
    """Result of verifying a session token."""

    token: str
    record: SessionRecord


class SessionTokenService:
    """Issue and validate session tokens persisted in the repository."""

    def __init__(
        self,
        *,
        repository: SessionRepository,
        secret: str,
        ttl_minutes: int,
        cookie_name: str,
        cookie_secure: bool,
    ) -> None:
        self.repository = repository
        self.secret = secret
        self.ttl_minutes = max(1, ttl_minutes)
        self.cookie_name = cookie_name
        self.cookie_secure = cookie_secure

    @property
    def ttl_seconds(self) -> int:
        return int(timedelta(minutes=self.ttl_minutes).total_seconds())

    def issue_session(
        self,
        *,
        user_id: int,
        user_agent: Optional[str] = None,
    ) -> tuple[str, SessionRecord]:
        token = secrets.token_urlsafe(32)
        issued_at = datetime.now(timezone.utc)
        expires_at = issued_at + timedelta(minutes=self.ttl_minutes)
        token_hash = self._hash_token(token)
        session = self.repository.create_session(
            user_id=user_id,
            token_hash=token_hash,
            issued_at=issued_at,
            expires_at=expires_at,
            user_agent=user_agent,
        )
        return token, session

    def verify_session(self, token: str) -> Optional[SessionValidationResult]:
        if not token:
            return None
        token_hash = self._hash_token(token)
        record = self.repository.get_by_token_hash(token_hash)
        if record is None:
            return None
        now = datetime.now(timezone.utc)
        if not record.is_active or record.expires_at <= now:
            return None
        self.repository.touch_session(record.id)
        return SessionValidationResult(token=token, record=record)

    def deactivate_session(self, session_id: int) -> None:
        self.repository.deactivate_session(session_id)

    def _hash_token(self, token: str) -> str:
        payload = f"{self.secret}:{token}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()


def _resolve_settings(request: Request) -> Settings:
    stored = getattr(request.app.state, "settings", None)
    if isinstance(stored, Settings):
        return stored
    return get_settings()


def get_user_repository(request: Request) -> UserRepository:
    repository = getattr(request.app.state, "user_repository", None)
    if isinstance(repository, UserRepository):
        return repository

    settings = _resolve_settings(request)
    repository = UserRepository(settings.attempts_database_path)
    request.app.state.user_repository = repository
    return repository


def get_session_repository(request: Request) -> SessionRepository:
    repository = getattr(request.app.state, "session_repository", None)
    if isinstance(repository, SessionRepository):
        return repository

    settings = _resolve_settings(request)
    repository = SessionRepository(settings.attempts_database_path)
    request.app.state.session_repository = repository
    return repository


def get_session_token_service(
    request: Request,
    repository: SessionRepository = Depends(get_session_repository),
) -> SessionTokenService:
    settings = _resolve_settings(request)
    return SessionTokenService(
        repository=repository,
        secret=settings.session_token_secret,
        ttl_minutes=settings.session_token_ttl_minutes,
        cookie_name=settings.session_cookie_name,
        cookie_secure=settings.session_cookie_secure,
    )


def _extract_token_from_request(request: Request, cookie_name: str) -> Optional[str]:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip() or None
    cookie_token = request.cookies.get(cookie_name)
    if cookie_token:
        return cookie_token
    return None


async def get_current_session(
    request: Request,
    service: SessionTokenService = Depends(get_session_token_service),
) -> SessionRecord:
    token = _extract_token_from_request(request, service.cookie_name)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "인증 정보가 필요합니다."},
        )

    validation = service.verify_session(token)
    if validation is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "세션이 유효하지 않습니다."},
        )
    return validation.record


async def get_current_user(
    session: SessionRecord = Depends(get_current_session),
    repository: UserRepository = Depends(get_user_repository),
) -> UserRecord:
    user = repository.get_by_id(session.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "사용자를 찾을 수 없습니다."},
        )
    return user


def resolve_optional_user(request: Request) -> UserRecord | None:
    """Resolve the authenticated user for a request if present."""

    session_repository = get_session_repository(request)
    session_service = get_session_token_service(request, repository=session_repository)
    user_repository = get_user_repository(request)
    token = _extract_token_from_request(request, session_service.cookie_name)
    if not token:
        return None
    validation = session_service.verify_session(token)
    if validation is None:
        return None
    return user_repository.get_by_id(validation.record.user_id)


async def get_optional_user(request: Request) -> UserRecord | None:
    """FastAPI dependency that returns the user when authenticated."""

    return resolve_optional_user(request)


__all__ = [
    "SessionTokenService",
    "SessionValidationResult",
    "get_current_session",
    "get_current_user",
    "get_optional_user",
    "get_session_repository",
    "get_session_token_service",
    "resolve_optional_user",
    "get_user_repository",
]
