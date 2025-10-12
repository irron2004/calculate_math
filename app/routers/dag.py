"""API endpoints exposing the curriculum progression DAG and learner progress."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from ..dag_loader import (
    DagDataError,
    DagEdge,
    DagEdgeType,
    DagGraph,
    DagMeta,
    DagNode,
    DagNodeType,
    GraphFilters,
    get_dag_graph,
    list_edges,
    list_nodes,
)
from ..dependencies.auth import get_current_session
from ..progress_store import (
    NodeProgress,
    ProgressDataError,
    ProgressStore,
    SkillProgress,
    get_progress_store,
)

router = APIRouter(prefix="/api/v1/dag", tags=["dag"])


class NodeListResponse(BaseModel):
    items: List[DagNode]
    total: int
    page: int
    page_size: int
    meta: DagMeta


class EdgeListResponse(BaseModel):
    items: List[DagEdge]
    total: int
    page: int
    page_size: int
    meta: DagMeta


class ProgressResponse(BaseModel):
    user_id: str
    updated_at: datetime
    total_xp: int
    nodes: Dict[str, NodeProgress]
    skills: Dict[str, SkillProgress]
    meta: Dict[str, Any]


def _normalise_lens(lens: Optional[List[str]]) -> Optional[List[str]]:
    if not lens:
        return None
    values: List[str] = []
    for item in lens:
        if not item:
            continue
        parts = [part.strip() for part in item.split(",") if part.strip()]
        values.extend(parts)
    return values or None


def _paginate(collection: List[Any], *, page: int, page_size: int) -> List[Any]:
    start = (page - 1) * page_size
    if start >= len(collection):
        return []
    end = start + page_size
    return collection[start:end]


def _resolve_progress_store(request: Request) -> ProgressStore:
    store = getattr(request.app.state, "dag_progress_store", None)
    if isinstance(store, ProgressStore):
        return store
    return get_progress_store()


def _compose_meta(graph: DagGraph, store: ProgressStore | None = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}
    if graph.meta.version:
        payload["version"] = graph.meta.version
    if graph.meta.xp:
        payload["xp"] = dict(graph.meta.xp)
    if graph.meta.lrc:
        payload.setdefault("lrc", {}).update(graph.meta.lrc)
    if graph.meta.palette:
        payload["palette"] = dict(graph.meta.palette)
    if store is not None:
        meta = store.meta
        if meta.get("xp"):
            payload.setdefault("xp", {}).update(meta["xp"])
        if meta.get("lrc"):
            payload.setdefault("lrc", {}).update(meta["lrc"])
        for key, value in meta.items():
            if key not in {"xp", "lrc"}:
                payload[key] = value
    return payload


@router.get("/nodes", response_model=NodeListResponse)
async def api_list_dag_nodes(
    *,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    node_type: DagNodeType | None = Query(None, alias="type"),
    tier: int | None = Query(None, ge=0),
    lens: Optional[List[str]] = Query(None),
    search: str | None = Query(None, min_length=1, max_length=128),
) -> NodeListResponse:
    try:
        filters = GraphFilters(
            node_type=node_type,
            tier=tier,
            lens=_normalise_lens(lens),
            search=search,
        )
        nodes = list_nodes(filters=filters)
        graph = get_dag_graph()
    except DagDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": str(exc)},
        ) from exc

    total = len(nodes)
    page_items = _paginate(nodes, page=page, page_size=page_size)
    return NodeListResponse(
        items=page_items,
        total=total,
        page=page,
        page_size=page_size,
        meta=graph.meta,
    )


@router.get("/edges", response_model=EdgeListResponse)
async def api_list_dag_edges(
    *,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    edge_type: DagEdgeType | None = Query(None, alias="type"),
    source: str | None = Query(None, min_length=1, max_length=128),
    target: str | None = Query(None, min_length=1, max_length=128),
) -> EdgeListResponse:
    try:
        filters = GraphFilters(
            edge_type=edge_type,
            source=source,
            target=target,
        )
        edges = list_edges(filters=filters)
        graph = get_dag_graph()
    except DagDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": str(exc)},
        ) from exc

    total = len(edges)
    page_items = _paginate(edges, page=page, page_size=page_size)
    return EdgeListResponse(
        items=page_items,
        total=total,
        page=page,
        page_size=page_size,
        meta=graph.meta,
    )


@router.get("/progress", response_model=ProgressResponse)
async def api_get_dag_progress(
    request: Request,
    session=Depends(get_current_session),
) -> ProgressResponse:
    try:
        store = _resolve_progress_store(request)
        snapshot = store.get_snapshot(session.user_id)
        graph = get_dag_graph()
    except (ProgressDataError, DagDataError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": str(exc)},
        ) from exc

    meta = _compose_meta(graph, store)
    return ProgressResponse(
        user_id=str(snapshot.user_id),
        updated_at=snapshot.updated_at,
        total_xp=snapshot.total_xp,
        nodes=snapshot.nodes,
        skills=snapshot.skills,
        meta=meta,
    )


__all__ = ["router"]
