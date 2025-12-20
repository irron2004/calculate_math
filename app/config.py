from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

SERVICE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = SERVICE_ROOT.parent
DATA_DIR = (SERVICE_ROOT / "data").resolve()
LEGACY_DATA_DIR = (DATA_DIR / ".old").resolve()


def _default_data_file(filename: str) -> Path:
    primary = (DATA_DIR / filename).resolve()
    legacy = (LEGACY_DATA_DIR / filename).resolve()
    if primary.exists():
        return primary
    if legacy.exists():
        return legacy
    return primary


DEFAULT_DATA_PATH = _default_data_file("problems.json")
DEFAULT_DB_PATH = (DATA_DIR / "attempts.db").resolve()
DEFAULT_CONCEPT_PATH = _default_data_file("concepts.json")
DEFAULT_TEMPLATE_PATH = _default_data_file("templates.json")
DEFAULT_DAG_PATH = _default_data_file("dag.json")
DEFAULT_PROGRESS_PATH = _default_data_file("dag_progress.json")
DEFAULT_LEVEL1_PATH = _default_data_file("level1.json")


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


def _parse_positive_int(value: str | None, default: int) -> int:
    candidate = _parse_int(value, default)
    return candidate if candidate > 0 else default


def _clamp_percentage(value: str | None, default: int) -> int:
    candidate = _parse_int(value, default)
    if candidate < 0:
        return 0
    if candidate > 100:
        return 100
    return candidate


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


def _parse_optional_str(value: str | None) -> Optional[str]:
    if value is None:
        return None
    candidate = value.strip()
    return candidate or None


def _parse_samesite(value: str | None, default: str) -> str:
    allowed = {"strict", "lax", "none"}
    if value is None or not value.strip():
        return default
    candidate = value.strip().lower()
    if candidate in allowed:
        return candidate
    return default


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
    session_cookie_samesite: str
    problem_data_path: Path
    attempts_database_path: Path
    concept_data_path: Path
    template_data_path: Path
    dag_data_path: Path
    progress_data_path: Path
    level1_data_path: Path
    skill_tree_list_rollout_percentage: int
    external_hub_url: Optional[str]
    password_pepper: str
    login_rate_limit_attempts: int
    login_rate_limit_window_seconds: int


def _build_settings() -> Settings:
    _load_env_file()
    return Settings(
        app_name=os.getenv("APP_NAME", "Calculate Service"),
        app_description=os.getenv("APP_DESCRIPTION", "초등수학 문제 제공 API 및 웹 서비스"),
        app_version=os.getenv("APP_VERSION", "1.0.0"),
        enable_openapi=_parse_bool(os.getenv("ENABLE_OPENAPI"), True),
        allowed_problem_categories=_parse_categories(os.getenv("ALLOWED_PROBLEM_CATEGORIES")),
        invite_token_ttl_minutes=_parse_int(os.getenv("INVITE_TOKEN_TTL_MINUTES"), 180),
        invite_token_bytes=_parse_int(os.getenv("INVITE_TOKEN_BYTES"), 16),
        session_token_secret=os.getenv("SESSION_TOKEN_SECRET", "calculate-dev-secret"),
        session_token_ttl_minutes=_parse_int(os.getenv("SESSION_TOKEN_TTL_MINUTES"), 60),
        session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "session_token"),
        session_cookie_secure=_parse_bool(os.getenv("SESSION_COOKIE_SECURE"), True),
        session_cookie_samesite=_parse_samesite(os.getenv("SESSION_COOKIE_SAMESITE"), "strict"),
        problem_data_path=_resolve_path(os.getenv("PROBLEM_DATA_PATH"), default=DEFAULT_DATA_PATH),
        attempts_database_path=_resolve_path(os.getenv("ATTEMPTS_DATABASE_PATH"), default=DEFAULT_DB_PATH),
        concept_data_path=_resolve_path(os.getenv("CONCEPT_DATA_PATH"), default=DEFAULT_CONCEPT_PATH),
        template_data_path=_resolve_path(os.getenv("TEMPLATE_DATA_PATH"), default=DEFAULT_TEMPLATE_PATH),
        dag_data_path=_resolve_path(os.getenv("DAG_DATA_PATH"), default=DEFAULT_DAG_PATH),
        progress_data_path=_resolve_path(os.getenv("DAG_PROGRESS_PATH"), default=DEFAULT_PROGRESS_PATH),
        level1_data_path=_resolve_path(os.getenv("LEVEL1_DATA_PATH"), default=DEFAULT_LEVEL1_PATH),
        skill_tree_list_rollout_percentage=_clamp_percentage(os.getenv("SKILL_TREE_LIST_ROLLOUT"), default=50),
        external_hub_url=_parse_optional_str(os.getenv("HUB_URL")),
        password_pepper=os.getenv("PASSWORD_PEPPER", "calculate-pepper"),
        login_rate_limit_attempts=_parse_positive_int(os.getenv("LOGIN_RATE_LIMIT_ATTEMPTS"), 5),
        login_rate_limit_window_seconds=_parse_positive_int(
            os.getenv("LOGIN_RATE_LIMIT_WINDOW_SECONDS"), 60
        ),
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""

    return _build_settings()


__all__ = ["Settings", "get_settings"]
