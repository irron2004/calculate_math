"""API routes for graph and problem read endpoints."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from .db import fetch_latest_graph, fetch_problems
from .models import ErrorResponse, GraphResponse, Problem

router = APIRouter(prefix="/api")


@router.get("/graph/draft", response_model=GraphResponse, responses={404: {"model": ErrorResponse}})
def get_draft_graph() -> GraphResponse | JSONResponse:
    graph = fetch_latest_graph("draft")
    if not graph:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "DRAFT_NOT_FOUND",
                    "message": "Draft graph not found",
                }
            },
        )
    return graph


@router.get("/graph/published", response_model=GraphResponse, responses={404: {"model": ErrorResponse}})
def get_published_graph() -> GraphResponse | JSONResponse:
    graph = fetch_latest_graph("published")
    if not graph:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "PUBLISHED_NOT_FOUND",
                    "message": "Published graph not found",
                }
            },
        )
    return graph


@router.get("/problems", response_model=List[Problem], responses={404: {"model": ErrorResponse}})
def list_problems(nodeId: str = Query(..., min_length=1)) -> List[Problem] | JSONResponse:
    problems = fetch_problems(nodeId)
    if problems is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NODE_NOT_FOUND",
                    "message": f"Node '{nodeId}' not found",
                }
            },
        )
    return problems
