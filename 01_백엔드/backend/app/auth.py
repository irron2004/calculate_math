"""Authentication helpers for JWT + bcrypt."""
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

JWT_ALGORITHM = "HS256"


@dataclass(frozen=True)
class TokenData:
    user_id: str
    username: str
    role: str


def _get_env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret:
        raise RuntimeError("JWT_SECRET is not configured")
    return secret


def get_access_ttl_minutes() -> int:
    return _get_env_int("JWT_ACCESS_TTL_MINUTES", 15)


def get_refresh_ttl_days() -> int:
    return _get_env_int("JWT_REFRESH_TTL_DAYS", 7)


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _build_token(*, user_id: str, username: str, role: str, token_type: str, expires_delta: timedelta) -> tuple[str, dict]:
    now = datetime.now(timezone.utc)
    exp = now + expires_delta
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    if token_type == "refresh":
        payload["jti"] = str(uuid4())
    token = jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)
    return token, payload


def create_access_token(*, user_id: str, username: str, role: str) -> tuple[str, dict]:
    ttl_minutes = get_access_ttl_minutes()
    return _build_token(
        user_id=user_id,
        username=username,
        role=role,
        token_type="access",
        expires_delta=timedelta(minutes=ttl_minutes),
    )


def create_refresh_token(*, user_id: str, username: str, role: str) -> tuple[str, dict]:
    ttl_days = get_refresh_ttl_days()
    return _build_token(
        user_id=user_id,
        username=username,
        role=role,
        token_type="refresh",
        expires_delta=timedelta(days=ttl_days),
    )


def decode_token(token: str, *, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="TOKEN_EXPIRED") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_TOKEN") from exc

    if payload.get("type") != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_TOKEN_TYPE")
    return payload


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenData:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="MISSING_TOKEN")
    payload = decode_token(credentials.credentials, expected_type="access")
    user_id = payload.get("sub")
    username = payload.get("username")
    role = payload.get("role")
    if not user_id or not username or not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_TOKEN")
    return TokenData(user_id=user_id, username=username, role=role)


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Optional[TokenData]:
    if credentials is None:
        return None
    payload = decode_token(credentials.credentials, expected_type="access")
    user_id = payload.get("sub")
    username = payload.get("username")
    role = payload.get("role")
    if not user_id or not username or not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_TOKEN")
    return TokenData(user_id=user_id, username=username, role=role)


def require_admin(user: TokenData = Depends(get_current_user)) -> TokenData:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ADMIN_ONLY")
    return user
