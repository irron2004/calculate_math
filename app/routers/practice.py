from __future__ import annotations

import hashlib
import random
import time
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional

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


class PracticeGenerator(str, Enum):
    ARITHMETIC = "arithmetic"


class PracticeSessionConfig(BaseModel):
    generator: PracticeGenerator = PracticeGenerator.ARITHMETIC
    op: Optional[str] = None
    ops: List[str] = Field(default_factory=list)
    min: Optional[int] = Field(default=None, ge=0)
    max: Optional[int] = Field(default=None, ge=0)
    digits: List[int] = Field(default_factory=list)
    left_digits: Optional[int] = Field(default=None, ge=1)
    right_digits: Optional[int] = Field(default=None, ge=1)
    dividend_digits: Optional[int] = Field(default=None, ge=1)
    divisor_digits: Optional[int] = Field(default=None, ge=1)
    allow_carry: Optional[bool] = None
    allow_remainder: Optional[bool] = None
    include_pow10: Optional[bool] = None
    count: int = Field(default=20, ge=1, le=60)


class PracticeSessionRequest(BaseModel):
    config: Optional[PracticeSessionConfig] = None


@dataclass
class GeneratedProblem:
    id: int
    left: int
    right: int
    answer: int
    options: List[int]
    operator: str


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
    operator: str


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
        operator="add",
    )


_ARITHMETIC_OPS = {"add", "sub", "mul", "div"}


def _has_addition_carry(left: int, right: int) -> bool:
    while left > 0 or right > 0:
        if (left % 10) + (right % 10) >= 10:
            return True
        left //= 10
        right //= 10
    return False


def _has_subtraction_borrow(left: int, right: int) -> bool:
    while left > 0 or right > 0:
        if (left % 10) < (right % 10):
            return True
        left //= 10
        right //= 10
    return False


def _build_numeric_options(answer: int) -> List[int]:
    options = {answer}
    delta = max(5, abs(answer) // 5 or 5)
    attempts = 0
    while len(options) < 4 and attempts < 200:
        offset = random.randint(-delta, delta)
        attempts += 1
        if offset == 0:
            continue
        candidate = answer + offset
        if candidate < 0:
            continue
        options.add(candidate)
    result = list(options)
    random.shuffle(result)
    return result


def _resolve_digit_range(digit: Optional[int], fallback_min: int, fallback_max: int) -> tuple[int, int]:
    if digit and digit > 0:
        digit_min = 10 ** (digit - 1)
        digit_max = (10 ** digit) - 1
        return digit_min, digit_max
    return fallback_min, fallback_max


def _clamp_range(min_value: int, max_value: int) -> tuple[int, int]:
    if min_value > max_value:
        return max_value, min_value
    return min_value, max_value


def _generate_arithmetic_problem_set(config: PracticeSessionConfig) -> List[GeneratedProblem]:
    ops: List[str] = [op for op in config.ops if op in _ARITHMETIC_OPS]
    if config.op in _ARITHMETIC_OPS and config.op not in ops:
        ops.append(config.op)
    if not ops:
        ops = ["add"]

    count = max(1, min(config.count, 60))
    problems: List[GeneratedProblem] = []

    digits = list(config.digits)
    default_left_digits = config.left_digits or (digits[0] if digits else None)
    default_right_digits = config.right_digits or (digits[1] if len(digits) > 1 else default_left_digits)

    for index in range(count):
        operator = random.choice(ops)

        if operator == "mul":
            left_digits = config.left_digits or default_left_digits or 2
            right_digits = config.right_digits or default_right_digits or 1
            left_min, left_max = _resolve_digit_range(left_digits, 10, 999)
            right_min, right_max = _resolve_digit_range(right_digits, 2, 9)
            left = random.randint(left_min, left_max)
            right = random.randint(right_min, right_max)
            if config.include_pow10:
                if random.random() < 0.3:
                    right = random.choice([10, 100])
            answer = left * right
        elif operator == "div":
            divisor_digits = config.divisor_digits or default_right_digits or 1
            dividend_digits = config.dividend_digits or default_left_digits or max(divisor_digits + 1, 2)
            divisor_min, divisor_max = _resolve_digit_range(divisor_digits, 2, 9)
            dividend_min, dividend_max = _resolve_digit_range(dividend_digits, 10, 9999)
            divisor = random.randint(divisor_min, max(divisor_min, divisor_max))
            if divisor == 0:
                divisor = 1
            if not config.allow_remainder:
                max_attempts = 50
                quotient_digits = max(1, dividend_digits - divisor_digits + 1)
                quotient_min, quotient_max = _resolve_digit_range(quotient_digits, 2, 99)
                quotient = random.randint(quotient_min, max(quotient_min, quotient_max))
                dividend = divisor * quotient
                attempts = 0
                while attempts < max_attempts and not (dividend_min <= dividend <= dividend_max):
                    quotient = random.randint(quotient_min, max(quotient_min, quotient_max))
                    dividend = divisor * quotient
                    attempts += 1
                if dividend_min > dividend_max:
                    dividend_min, dividend_max = _clamp_range(dividend_min, dividend_max)
                dividend = max(dividend_min, min(dividend, dividend_max))
                left = dividend
                right = divisor
                answer = dividend // divisor
            else:
                dividend = random.randint(dividend_min, max(dividend_min, dividend_max))
                if dividend < divisor:
                    dividend, divisor = divisor, dividend
                left = dividend
                right = divisor
                answer = dividend // divisor
        else:
            default_min = config.min if config.min is not None else 10
            default_max = config.max if config.max is not None else 999
            left_digits = config.left_digits or default_left_digits
            right_digits = config.right_digits or default_right_digits
            left_min, left_max = _resolve_digit_range(left_digits, default_min, default_max)
            right_min, right_max = _resolve_digit_range(right_digits, default_min, default_max)
            left_min, left_max = _clamp_range(left_min, left_max)
            right_min, right_max = _clamp_range(right_min, right_max)

            attempts = 0
            left = random.randint(left_min, left_max)
            right = random.randint(right_min, right_max)
            if operator == "add" and config.allow_carry is False:
                while attempts < 50 and _has_addition_carry(left, right):
                    left = random.randint(left_min, left_max)
                    right = random.randint(right_min, right_max)
                    attempts += 1
            if operator == "sub":
                if left < right:
                    left, right = right, left
                if config.allow_carry is False:
                    while attempts < 50 and _has_subtraction_borrow(left, right):
                        left = random.randint(left_min, left_max)
                        right = random.randint(right_min, right_max)
                        if left < right:
                            left, right = right, left
                        attempts += 1
            if operator == "add":
                answer = left + right
            elif operator == "sub":
                answer = left - right
            else:
                answer = left + right

        options = _build_numeric_options(int(answer))
        problems.append(
            GeneratedProblem(
                id=index + 1,
                left=int(left),
                right=int(right),
                answer=int(answer),
                options=options,
                operator=operator,
            )
        )

    return problems


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
    payload: PracticeSessionRequest | None = None,
    _current_user: UserRecord = Depends(get_current_user),
) -> SessionResponse:
    config = payload.config if payload else None
    if config and config.generator is PracticeGenerator.ARITHMETIC:
        generated = _generate_arithmetic_problem_set(config)
    else:
        generated = [_generate_problem(index + 1) for index in range(20)]

    session_id = int(time.time() * 1000) % 1_000_000

    return SessionResponse(
        session_id=session_id,
        problems=[SessionProblem(**problem.__dict__) for problem in generated],
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
