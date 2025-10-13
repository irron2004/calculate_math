from typing import Any, Dict

from fastapi import APIRouter, Request

from ..status import collect_liveness_status, collect_readiness_status


router = APIRouter(tags=["health"])


@router.get("/health", summary="Service health check")
async def health_check(request: Request) -> Dict[str, Any]:
    return collect_liveness_status(request.app)


@router.get("/api/v1/health", summary="Service health check (namespaced)")
async def health_check_v1(request: Request) -> Dict[str, Any]:
    return collect_liveness_status(request.app)


@router.get("/healthz", summary="Liveness probe")
async def healthz(request: Request) -> Dict[str, Any]:
    return collect_liveness_status(request.app)


@router.get("/readyz", summary="Readiness probe")
async def readyz(request: Request) -> Dict[str, Any]:
    return collect_readiness_status(request.app)


__all__ = ["router"]
