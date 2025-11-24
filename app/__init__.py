import logging
from contextlib import asynccontextmanager
from pathlib import Path
from time import time

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .config import get_settings
from .dag_loader import reset_graph_cache
from .bipartite_loader import reset_bipartite_graph_cache
from .instrumentation import RequestContextMiddleware, configure_telemetry
from .problem_bank import refresh_cache, reset_cache
from .template_engine import refresh_engine, reset_engine
from .repositories import (
    AttemptRepository,
    LRCRepository,
    SessionRepository,
    UserRepository,
)
from .routers import (
    bridge,
    curriculum,
    dag,
    health,
    invites,
    metrics,
    pages,
    practice,
    problems,
    skill_problems,
    skills,
)
from .progress_store import (
    refresh_progress_store,
    reset_progress_store,
)


startup_logger = logging.getLogger("calculate_service.startup")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        startup_logger.debug("lifespan setup start for app id=%s", id(app))
        app.state.start_time = time()
        startup_logger.debug(
            "refreshing problem cache from %s", settings.problem_data_path
        )
        problem_repository = refresh_cache(force=True)
        startup_logger.debug("problem cache ready with %d items", len(problem_repository))
        app.state.problem_repository = problem_repository
        app.state.problem_cache_strategy = {
            "strategy": "file-mtime",
            "source": str(problem_repository.source_path),
        }

        startup_logger.debug(
            "refreshing template engine with concept=%s template=%s",
            settings.concept_data_path,
            settings.template_data_path,
        )
        template_engine = refresh_engine(force=True)
        app.state.template_engine = template_engine
        app.state.template_cache_strategy = {
            "concept_source": str(template_engine.concept_path),
            "template_source": str(template_engine.template_path),
        }

        startup_logger.debug(
            "initialising AttemptRepository at %s", settings.attempts_database_path
        )
        attempt_repository = AttemptRepository(settings.attempts_database_path)
        app.state.attempt_repository = attempt_repository

        startup_logger.debug(
            "initialising UserRepository at %s", settings.attempts_database_path
        )
        user_repository = UserRepository(settings.attempts_database_path)
        app.state.user_repository = user_repository

        startup_logger.debug(
            "initialising SessionRepository at %s", settings.attempts_database_path
        )
        session_repository = SessionRepository(settings.attempts_database_path)
        app.state.session_repository = session_repository

        startup_logger.debug(
            "initialising LRCRepository at %s", settings.attempts_database_path
        )
        lrc_repository = LRCRepository(settings.attempts_database_path)
        app.state.lrc_repository = lrc_repository

        startup_logger.debug(
            "initialising DAG progress store at %s", settings.progress_data_path
        )
        dag_progress_store = refresh_progress_store(force=True)
        app.state.dag_progress_store = dag_progress_store

        try:
            startup_logger.debug("lifespan setup complete for app id=%s", id(app))
            yield
        finally:
            startup_logger.debug("lifespan teardown start for app id=%s", id(app))
            if hasattr(app.state, "attempt_repository"):
                delattr(app.state, "attempt_repository")
            if hasattr(app.state, "user_repository"):
                delattr(app.state, "user_repository")
            if hasattr(app.state, "session_repository"):
                delattr(app.state, "session_repository")
            if hasattr(app.state, "lrc_repository"):
                delattr(app.state, "lrc_repository")
            if hasattr(app.state, "dag_progress_store"):
                delattr(app.state, "dag_progress_store")
            if hasattr(app.state, "problem_cache_strategy"):
                delattr(app.state, "problem_cache_strategy")
            if hasattr(app.state, "problem_repository"):
                delattr(app.state, "problem_repository")
            if hasattr(app.state, "template_cache_strategy"):
                delattr(app.state, "template_cache_strategy")
            if hasattr(app.state, "template_engine"):
                delattr(app.state, "template_engine")
            if hasattr(app.state, "start_time"):
                delattr(app.state, "start_time")
            reset_cache()
            reset_engine()
            reset_progress_store()
            reset_graph_cache()
            reset_bipartite_graph_cache()
            startup_logger.debug("lifespan teardown complete for app id=%s", id(app))

    app = FastAPI(
        title=settings.app_name,
        description=settings.app_description,
        version=settings.app_version,
        docs_url="/docs" if settings.enable_openapi else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    configure_telemetry(app)

    # Ensure templates/tests can resolve relative paths when run from any CWD.
    base_dir = Path(__file__).resolve().parent
    static_dir = base_dir / "static"
    template_dir = base_dir / "templates"

    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    templates = Jinja2Templates(directory=template_dir)

    frontend_dir = base_dir.parent / "frontend" / "dist"
    frontend_available = frontend_dir.exists()
    if frontend_available:
        startup_logger.debug("mounting built frontend from %s", frontend_dir)
        app.mount(
            "/math",
            StaticFiles(directory=frontend_dir, html=True),
            name="frontend",
        )
    else:
        startup_logger.debug("frontend bundle not found at %s; skipping mount", frontend_dir)

    # Store shared resources on the application state so routers can resolve them
    # without needing to be constructed dynamically during startup.
    app.state.settings = settings
    app.state.templates = templates
    app.state.frontend_available = frontend_available

    app.add_middleware(RequestContextMiddleware)

    # Older router modules exposed a factory (``get_router``) so we gracefully
    # support both patterns to avoid merge conflicts when downstream branches
    # still rely on the function based API.
    page_router = (
        pages.get_router(templates) if hasattr(pages, "get_router") else pages.router
    )
    invite_router = (
        invites.get_router(templates)
        if hasattr(invites, "get_router")
        else invites.router
    )

    app.include_router(health.router)
    app.include_router(bridge.router)
    app.include_router(page_router)
    app.include_router(invite_router)
    app.include_router(problems.router)
    app.include_router(practice.router)
    app.include_router(metrics.router)
    app.include_router(curriculum.router)
    app.include_router(dag.router)
    app.include_router(skill_problems.router)
    app.include_router(skills.router)

    return app


app = create_app()


__all__ = ["create_app", "app"]
