"""Loader utilities for the curriculum progression DAG specification."""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from pydantic import BaseModel, Field, validator

from .config import Settings, get_settings


class DagDataError(RuntimeError):
    """Raised when the DAG dataset cannot be loaded or parsed."""


class DagNodeType(str, Enum):
    """Supported node types in the bipartite curriculum DAG."""

    COURSE_STEP = "course_step"
    SKILL = "skill"


class DagEdgeType(str, Enum):
    """Supported edge types in the bipartite curriculum DAG."""

    REQUIRES = "requires"
    TEACHES = "teaches"
    ENABLES = "enables"
    DECOMPOSES = "decomposes"


class DagMeta(BaseModel):
    """Metadata attached to the curriculum DAG payload."""

    version: Optional[str] = None
    xp: Dict[str, Any] = Field(default_factory=dict)
    lrc: Dict[str, Any] = Field(default_factory=dict)
    palette: Dict[str, str] = Field(default_factory=dict)


class DagNode(BaseModel):
    """Node entry within the curriculum DAG."""

    id: str
    type: DagNodeType
    label: str
    lens: List[str] = Field(default_factory=list)
    tier: Optional[int] = None
    domain: Optional[str] = None
    levels: Optional[int] = None
    xp_reward: Optional[int] = None
    lrc_focus: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        extra = "allow"

    @validator("lens", pre=True, always=True)
    def _normalise_lens(cls, value: Iterable[str] | None) -> List[str]:
        if value is None:
            return []
        return [str(item) for item in value]


class DagEdge(BaseModel):
    """Edge entry connecting nodes in the curriculum DAG."""

    source: str = Field(..., alias="from")
    target: str = Field(..., alias="to")
    type: DagEdgeType
    min_level: Optional[int] = None
    delta_level: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        allow_population_by_field_name = True
        extra = "allow"


class DagGraph(BaseModel):
    """Complete curriculum DAG specification."""

    version: Optional[str] = None
    nodes: List[DagNode]
    edges: List[DagEdge]
    meta: DagMeta = Field(default_factory=DagMeta)


@dataclass(frozen=True)
class GraphFilters:
    """Filtering parameters accepted by the query helpers."""

    node_type: DagNodeType | None = None
    tier: Optional[int] = None
    lens: Optional[List[str]] = None
    search: Optional[str] = None
    edge_type: DagEdgeType | None = None
    source: Optional[str] = None
    target: Optional[str] = None


def _resolve_dataset_path(settings: Settings) -> Path:
    path = settings.dag_data_path
    if not path.exists():
        raise DagDataError(f"DAG dataset not found at {path}")
    return path


def _load_raw_graph(path: Path) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise DagDataError(f"DAG dataset not found at {path}") from exc
    except json.JSONDecodeError as exc:
        raise DagDataError(f"Invalid DAG dataset format at {path}") from exc


def _parse_graph(raw: Dict[str, Any]) -> DagGraph:
    if "nodes" not in raw or "edges" not in raw:
        raise DagDataError("DAG dataset must include 'nodes' and 'edges' sections")
    return DagGraph.parse_obj(raw)


@lru_cache(maxsize=1)
def get_dag_graph() -> DagGraph:
    """Return the cached curriculum DAG specification."""

    settings = get_settings()
    path = _resolve_dataset_path(settings)
    payload = _load_raw_graph(path)
    return _parse_graph(payload)


def list_nodes(*, filters: GraphFilters | None = None) -> List[DagNode]:
    """Return nodes filtered according to the provided parameters."""

    graph = get_dag_graph()
    nodes: Iterable[DagNode] = graph.nodes
    if filters is not None:
        if filters.node_type is not None:
            nodes = (node for node in nodes if node.type == filters.node_type)
        if filters.tier is not None:
            nodes = (node for node in nodes if node.tier == filters.tier)
        if filters.lens:
            lookup = {lens.lower() for lens in filters.lens}
            nodes = (
                node
                for node in nodes
                if any(lens.lower() in lookup for lens in node.lens)
            )
        if filters.search:
            needle = filters.search.lower()
            nodes = (
                node
                for node in nodes
                if needle in node.label.lower() or needle in node.id.lower()
            )
    return list(nodes)


def list_edges(*, filters: GraphFilters | None = None) -> List[DagEdge]:
    """Return edges filtered according to the provided parameters."""

    graph = get_dag_graph()
    edges: Iterable[DagEdge] = graph.edges
    if filters is not None:
        if filters.edge_type is not None:
            edges = (edge for edge in edges if edge.type == filters.edge_type)
        if filters.source is not None:
            edges = (edge for edge in edges if edge.source == filters.source)
        if filters.target is not None:
            edges = (edge for edge in edges if edge.target == filters.target)
    return list(edges)


def reset_graph_cache() -> None:
    """Clear cached DAG payload for use in tests."""

    get_dag_graph.cache_clear()


__all__ = [
    "DagDataError",
    "DagEdge",
    "DagEdgeType",
    "DagGraph",
    "DagMeta",
    "DagNode",
    "DagNodeType",
    "GraphFilters",
    "get_dag_graph",
    "list_edges",
    "list_nodes",
    "reset_graph_cache",
]
