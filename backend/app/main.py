"""FastAPI application entrypoint."""
from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .api import router
from .auth import hash_password
from .db import ensure_admin_user, init_db, resolve_database_path, seed_db

logger = logging.getLogger(__name__)

# Rate limiter instance
limiter = Limiter(key_func=get_remote_address)


def get_cors_origins() -> list[str]:
    """Get CORS origins from environment variable plus defaults for dev."""
    env_origins = os.getenv("CORS_ORIGINS", "")
    if env_origins:
        # In production, only use explicitly configured origins
        return [o.strip() for o in env_origins.split(",") if o.strip()]
    # Default to localhost only for development
    return ["http://localhost:5173", "http://127.0.0.1:5173"]


def get_allowed_methods() -> list[str]:
    """Return allowed HTTP methods."""
    return ["GET", "POST", "PUT", "DELETE", "OPTIONS"]


def get_allowed_headers() -> list[str]:
    """Return allowed HTTP headers."""
    return ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"]


def _load_env_file() -> None:
    """Load backend/.env if python-dotenv is available."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    try:
        from dotenv import load_dotenv
    except Exception:
        logger.debug("python-dotenv not installed; skipping .env load")
        return
    load_dotenv(env_path, override=False)
    logger.info("Loaded environment variables from %s", env_path)


def _ensure_admin_account(db_path: Path) -> None:
    username = os.getenv("ADMIN_USERNAME", "").strip()
    password = os.getenv("ADMIN_PASSWORD", "").strip()
    if not username or not password:
        logger.info("ADMIN_USERNAME or ADMIN_PASSWORD not set; skipping admin bootstrap")
        return
    email = os.getenv("ADMIN_AUTH_EMAIL", f"{username}@local").strip()
    name = os.getenv("ADMIN_NAME", "Admin").strip() or "Admin"
    grade = os.getenv("ADMIN_GRADE", "admin").strip() or "admin"
    try:
        created = ensure_admin_user(
            username=username,
            password_hash=hash_password(password),
            email=email,
            name=name,
            grade=grade,
            path=db_path,
        )
        if created:
            logger.info("Admin account created: %s", username)
    except Exception as exc:
        logger.warning("Failed to ensure admin account: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    _load_env_file()
    db_path = resolve_database_path()
    app.state.database_path = str(db_path)
    logger.info("Database path resolved to %s", db_path)
    init_db(db_path)
    seed_db(db_path)
    _ensure_admin_account(db_path)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Math Knowledge Graph API", lifespan=lifespan)

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=True,
        allow_methods=get_allowed_methods(),
        allow_headers=get_allowed_headers(),
    )

    app.include_router(router)

    return app


app = create_app()

# Export limiter for use in api.py
def get_limiter() -> Limiter:
    return limiter
