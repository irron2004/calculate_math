from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .config import get_settings
from .instrumentation import RequestContextMiddleware, configure_telemetry
from .problem_bank import refresh_cache, reset_cache
from .template_engine import refresh_engine, reset_engine
from .repositories import AttemptRepository, LRCRepository, UserRepository
from .routers import curriculum, health, invites, pages, practice, problems


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        problem_repository = refresh_cache(force=True)
        app.state.problem_repository = problem_repository
        app.state.problem_cache_strategy = {
            "strategy": "file-mtime",
            "source": str(problem_repository.source_path),
        }

        template_engine = refresh_engine(force=True)
        app.state.template_engine = template_engine
        app.state.template_cache_strategy = {
            "concept_source": str(template_engine.concept_path),
            "template_source": str(template_engine.template_path),
        }

        attempt_repository = AttemptRepository(settings.attempts_database_path)
        app.state.attempt_repository = attempt_repository

        user_repository = UserRepository(settings.attempts_database_path)
        app.state.user_repository = user_repository

        lrc_repository = LRCRepository(settings.attempts_database_path)
        app.state.lrc_repository = lrc_repository

        try:
            yield
        finally:
            if hasattr(app.state, "attempt_repository"):
                delattr(app.state, "attempt_repository")
            if hasattr(app.state, "user_repository"):
                delattr(app.state, "user_repository")
            if hasattr(app.state, "lrc_repository"):
                delattr(app.state, "lrc_repository")
            if hasattr(app.state, "problem_cache_strategy"):
                delattr(app.state, "problem_cache_strategy")
            if hasattr(app.state, "problem_repository"):
                delattr(app.state, "problem_repository")
            if hasattr(app.state, "template_cache_strategy"):
                delattr(app.state, "template_cache_strategy")
            if hasattr(app.state, "template_engine"):
                delattr(app.state, "template_engine")
            reset_cache()
            reset_engine()

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

    # Store shared resources on the application state so routers can resolve them
    # without needing to be constructed dynamically during startup.
    app.state.settings = settings
    app.state.templates = templates

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
    app.include_router(page_router)
    app.include_router(invite_router)
    app.include_router(problems.router)
    app.include_router(practice.router)
    app.include_router(curriculum.router)

    return app


app = create_app()


__all__ = ["create_app", "app"]
