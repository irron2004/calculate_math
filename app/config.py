from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List


SERVICE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = SERVICE_ROOT.parent
DEFAULT_DATA_PATH = (SERVICE_ROOT / "data" / "problems.json").resolve()
DEFAULT_DB_PATH = (SERVICE_ROOT / "data" / "attempts.db").resolve()
DEFAULT_CONCEPT_PATH = (SERVICE_ROOT / "data" / "concepts.json").resolve()
DEFAULT_TEMPLATE_PATH = (SERVICE_ROOT / "data" / "templates.json").resolve()


def _load_env_file() -> None:
    """Populate process env vars from a local .env file if present."""

    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_int(value: str | None, default: int) -> int:
    if value is None or not value.strip():
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _parse_categories(value: str | None) -> List[str] | None:
    if value is None or not value.strip():
        return None
    items = [chunk.strip() for chunk in value.split(",")]
    filtered = [item for item in items if item]
    return filtered or None


def _resolve_path(value: str | None, *, default: Path) -> Path:
    if value is None or not value.strip():
        return default
    candidate = Path(value.strip())
    if not candidate.is_absolute():
        candidate = (REPO_ROOT / candidate).resolve()
    return candidate


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_description: str
    app_version: str
    enable_openapi: bool
    allowed_problem_categories: List[str] | None
    invite_token_ttl_minutes: int
    invite_token_bytes: int
    session_token_secret: str
    session_token_ttl_minutes: int
    session_cookie_name: str
    session_cookie_secure: bool
    problem_data_path: Path
    attempts_database_path: Path
    concept_data_path: Path
    template_data_path: Path


def _build_settings() -> Settings:
    _load_env_file()
    return Settings(
        app_name=os.getenv("APP_NAME", "Calculate Service"),
        app_description=os.getenv(
            "APP_DESCRIPTION", "초등수학 문제 제공 API 및 웹 서비스"
        ),
        app_version=os.getenv("APP_VERSION", "1.0.0"),
        enable_openapi=_parse_bool(os.getenv("ENABLE_OPENAPI"), True),
        allowed_problem_categories=_parse_categories(
            os.getenv("ALLOWED_PROBLEM_CATEGORIES")
        ),
        invite_token_ttl_minutes=_parse_int(
            os.getenv("INVITE_TOKEN_TTL_MINUTES"), 180
        ),
        invite_token_bytes=_parse_int(
            os.getenv("INVITE_TOKEN_BYTES"), 16
        ),
        problem_data_path=_resolve_path(
            os.getenv("PROBLEM_DATA_PATH"), default=DEFAULT_DATA_PATH
        ),
        attempts_database_path=_resolve_path(
            os.getenv("ATTEMPTS_DATABASE_PATH"), default=DEFAULT_DB_PATH
        ),
        concept_data_path=_resolve_path(
            os.getenv("CONCEPT_DATA_PATH"), default=DEFAULT_CONCEPT_PATH
        ),
        template_data_path=_resolve_path(
            os.getenv("TEMPLATE_DATA_PATH"), default=DEFAULT_TEMPLATE_PATH
        ),
        session_token_secret=os.getenv("SESSION_TOKEN_SECRET", "calculate-dev-secret"),
        session_token_ttl_minutes=_parse_int(
            os.getenv("SESSION_TOKEN_TTL_MINUTES"), 1440
        ),
        session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "session_token"),
        session_cookie_secure=_parse_bool(
            os.getenv("SESSION_COOKIE_SECURE"), False
        ),
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""

    return _build_settings()


__all__ = ["Settings", "get_settings"]
