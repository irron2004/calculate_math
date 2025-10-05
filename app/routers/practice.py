from __future__ import annotations

import hashlib
import random
import time
from dataclasses import dataclass
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..repositories import UserRepository
from ..config import get_settings

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


def _get_user_repository(request: Request) -> UserRepository:
    repository = getattr(request.app.state, "user_repository", None)
    if isinstance(repository, UserRepository):
        return repository

    settings = getattr(request.app.state, "settings", None) or get_settings()
    repository = UserRepository(settings.attempts_database_path)
    request.app.state.user_repository = repository
    return repository


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
async def login(payload: LoginRequest, repository: UserRepository = Depends(_get_user_repository)) -> LoginResponse:
    existing = repository.get_by_nickname(payload.nickname)
    password_hash = _hash_password(payload.password)

    if existing is None:
        created = repository.create_user(
            nickname=payload.nickname.strip(),
            password_hash=password_hash,
            role="student",
        )
        return LoginResponse(
            user_id=created.id,
            nickname=created.nickname,
            role=created.role,
            message="새 계정이 생성되었습니다",
        )

    if existing.password_hash != password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "비밀번호가 일치하지 않습니다."},
        )

    return LoginResponse(
        user_id=existing.id,
        nickname=existing.nickname,
        role=existing.role,
        message="로그인 성공",
    )


@router.post("/v1/sessions", response_model=SessionResponse)
async def create_session() -> SessionResponse:
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
