from __future__ import annotations

import hashlib
import random
import time
from dataclasses import dataclass
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from ..dependencies.auth import (
    SessionTokenService,
    get_current_user,
    get_session_token_service,
    get_user_repository,
)
from ..repositories import UserRecord, UserRepository

router = APIRouter(prefix="/api", tags=["practice"])


@dataclass
class GeneratedProblem:
    id: int
    left: int
    right: int
    answer: int
    options: List[int]


class LoginRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class LoginResponse(BaseModel):
    user_id: int
    nickname: str
    role: str
    message: str
    session_token: str
    expires_at: float


class SessionProblem(BaseModel):
    id: int
    left: int
    right: int
    answer: int
    options: List[int]


class SessionResponse(BaseModel):
    session_id: int
    problems: List[SessionProblem]


def _hash_password(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _set_session_cookie(
    response: Response, session_service: SessionTokenService, token: str
) -> None:
    response.set_cookie(
        key=session_service.cookie_name,
        value=token,
        httponly=True,
        secure=session_service.cookie_secure,
        samesite="lax",
        max_age=session_service.ttl_seconds,
    )


def _generate_problem(problem_id: int) -> GeneratedProblem:
    left = random.randint(10, 99)
    right = random.randint(10, 99)
    answer = left + right

    options = {answer}
    while len(options) < 4:
        offset = random.randint(-10, 10)
        candidate = answer + offset
        if candidate < 0:
            candidate = abs(candidate)
        options.add(candidate)

    option_list = list(options)
    random.shuffle(option_list)
    return GeneratedProblem(
        id=problem_id,
        left=left,
        right=right,
        answer=answer,
        options=option_list,
    )


@router.post("/v1/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    repository: UserRepository = Depends(get_user_repository),
    session_service: SessionTokenService = Depends(get_session_token_service),
) -> LoginResponse:
    normalized_nickname = payload.nickname.strip()
    if not normalized_nickname:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "닉네임을 입력해주세요."},
        )

    existing = repository.get_by_nickname(normalized_nickname)
    password_hash = _hash_password(payload.password)

    if existing is None:
        created = repository.create_user(
            nickname=normalized_nickname,
            password_hash=password_hash,
            role="student",
        )
        session_token, session_record = session_service.issue_session(
            user_id=created.id,
            user_agent=request.headers.get("user-agent"),
        )
        _set_session_cookie(response, session_service, session_token)
        return LoginResponse(
            user_id=created.id,
            nickname=created.nickname,
            role=created.role,
            message="새 계정이 생성되었습니다",
            session_token=session_token,
            expires_at=session_record.expires_at.timestamp(),
        )

    if existing.password_hash != password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "비밀번호가 일치하지 않습니다."},
        )

    session_token, session_record = session_service.issue_session(
        user_id=existing.id,
        user_agent=request.headers.get("user-agent"),
    )
    _set_session_cookie(response, session_service, session_token)
    return LoginResponse(
        user_id=existing.id,
        nickname=existing.nickname,
        role=existing.role,
        message="로그인 성공",
        session_token=session_token,
        expires_at=session_record.expires_at.timestamp(),
    )


@router.post("/v1/sessions", response_model=SessionResponse)
async def create_session(
    _current_user: UserRecord = Depends(get_current_user),
) -> SessionResponse:
    problems = [_generate_problem(index + 1) for index in range(20)]
    session_id = int(time.time() * 1000) % 1_000_000

    return SessionResponse(
        session_id=session_id,
        problems=[SessionProblem(**problem.__dict__) for problem in problems],
    )


@router.get("/v1/stats/daily")
async def get_daily_stats(days: int = 30) -> dict[str, object]:
    safe_days = max(1, min(days, 90))
    return {
        "total_sessions": 12 + safe_days // 5,
        "total_problems": 20 * safe_days,
        "average_accuracy": 82.5,
        "average_time": 1180,
        "streak_days": min(safe_days, 14),
    }


__all__ = ["router"]
