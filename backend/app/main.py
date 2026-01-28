"""FastAPI application entrypoint."""
from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router
from .db import init_db, resolve_database_path, seed_db

logger = logging.getLogger(__name__)


def get_cors_origins() -> list[str]:
    """Get CORS origins from environment variable plus defaults."""
    origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    extra = os.getenv("CORS_ORIGINS", "")
    if extra:
        origins.extend([o.strip() for o in extra.split(",") if o.strip()])
    return origins


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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    _load_env_file()
    db_path = resolve_database_path()
    app.state.database_path = str(db_path)
    logger.info("Database path resolved to %s", db_path)
    init_db(db_path)
    seed_db(db_path)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Math Knowledge Graph API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    return app


app = create_app()
