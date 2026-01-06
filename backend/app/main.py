"""FastAPI application entrypoint."""
from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api import router
from .db import init_db, resolve_database_path, seed_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    db_path = resolve_database_path()
    app.state.database_path = str(db_path)
    logger.info("Database path resolved to %s", db_path)
    init_db(db_path)
    seed_db(db_path)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Math Knowledge Graph API", lifespan=lifespan)
    app.include_router(router)

    return app


app = create_app()
