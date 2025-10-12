"""API router exposing personalised progress metrics."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..dependencies.auth import get_current_user
from ..progress_store import ProgressStore, refresh_progress_store
from ..repositories import AttemptRepository, UserRecord
from ..services.progress_metrics import (
    ProgressMetricsService,
    UserProgressMetrics,
)


router = APIRouter(prefix="/api", tags=["metrics"])


def _get_attempt_repository(request: Request) -> AttemptRepository:
    repository = getattr(request.app.state, "attempt_repository", None)
    if isinstance(repository, AttemptRepository):
        return repository
    settings = getattr(request.app.state, "settings", None)
    if settings is None:
        from ..config import get_settings

        settings = get_settings()
    repository = AttemptRepository(settings.attempts_database_path)
    request.app.state.attempt_repository = repository
    return repository


def _get_progress_store(request: Request) -> ProgressStore:
    store = getattr(request.app.state, "dag_progress_store", None)
    if isinstance(store, ProgressStore):
        return store
    store = refresh_progress_store(force=True)
    request.app.state.dag_progress_store = store
    return store


def _get_metrics_service(
    attempt_repository: AttemptRepository = Depends(_get_attempt_repository),
    progress_store: ProgressStore = Depends(_get_progress_store),
) -> ProgressMetricsService:
    return ProgressMetricsService(
        attempt_repository=attempt_repository,
        progress_store=progress_store,
    )


@router.get("/v1/metrics/me", response_model=UserProgressMetrics)
async def get_personal_metrics(
    current_user: UserRecord = Depends(get_current_user),
    service: ProgressMetricsService = Depends(_get_metrics_service),
) -> UserProgressMetrics:
    """Return personalised metrics for the authenticated learner."""

    return service.get_metrics_for_user(current_user.id)


__all__ = ["router"]

