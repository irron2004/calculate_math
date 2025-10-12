"""Loader utilities for the bipartite (course step ↔ atomic skill) graph."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Iterable, List, Type, TypeVar

from pydantic import ValidationError

from app.schemas.bipartite import (
    AtomicSkillNode,
    BipartiteGraphSpec,
    CourseStepNode,
    EdgeType,
    GraphEdge,
)


class BipartiteSpecError(RuntimeError):
    """Raised when the bipartite graph specification cannot be loaded or validated."""


_BASE_DIR = Path(__file__).resolve().parent
_GRAPH_CANDIDATES = (
    _BASE_DIR.parent / "graph.bipartite.json",
    _BASE_DIR / "data" / "graph.bipartite.json",
)


def _locate_graph_file() -> Path:
    for candidate in _GRAPH_CANDIDATES:
        if candidate.exists():
            return candidate
    raise BipartiteSpecError("Unable to locate graph.bipartite.json in expected locations")


def _load_raw_spec() -> dict:
    graph_path = _locate_graph_file()
    try:
        return json.loads(graph_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise BipartiteSpecError(f"Failed to parse JSON from {graph_path}") from exc


@lru_cache(maxsize=1)
def get_bipartite_graph() -> BipartiteGraphSpec:
    """Return the validated bipartite graph specification."""

    raw = _load_raw_spec()
    try:
        return BipartiteGraphSpec.model_validate(raw)
    except ValidationError as exc:  # pragma: no cover - exercised in tests
        raise BipartiteSpecError("Invalid bipartite graph specification") from exc


def reset_bipartite_graph_cache() -> None:
    """Clear the cached bipartite graph."""

    get_bipartite_graph.cache_clear()


NodeT = TypeVar("NodeT", AtomicSkillNode, CourseStepNode)


def _nodes_of_type(node_cls: Type[NodeT]) -> List[NodeT]:
    graph = get_bipartite_graph()
    return [node for node in graph.nodes if isinstance(node, node_cls)]


def get_course_steps() -> List[CourseStepNode]:
    """Return all course-step nodes."""

    return _nodes_of_type(CourseStepNode)


def get_atomic_skills() -> List[AtomicSkillNode]:
    """Return all atomic-skill nodes."""

    return _nodes_of_type(AtomicSkillNode)


def get_edges(edge_type: EdgeType | None = None) -> List[GraphEdge]:
    """Return all edges, optionally filtered by type."""

    edges: Iterable[GraphEdge] = get_bipartite_graph().edges
    if edge_type is not None:
        edges = (edge for edge in edges if edge.type is edge_type)
    return list(edges)


__all__ = [
    "AtomicSkillNode",
    "BipartiteGraphSpec",
    "BipartiteSpecError",
    "CourseStepNode",
    "EdgeType",
    "GraphEdge",
    "get_atomic_skills",
    "get_bipartite_graph",
    "get_course_steps",
    "get_edges",
    "reset_bipartite_graph_cache",
]
