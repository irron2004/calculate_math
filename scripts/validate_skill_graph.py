"""Command line interface for validating the curriculum skill DAG dataset."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict, deque
from enum import Enum
from pathlib import Path
from typing import Any, Iterable, List, Sequence

try:  # pragma: no cover - optional import for pydantic v2
    from pydantic import BaseModel, Field, ValidationError
    from pydantic import ConfigDict
except ImportError:  # pragma: no cover - fallback for pydantic v1
    from pydantic import BaseModel, Field, ValidationError

    ConfigDict = None  # type: ignore[assignment]


class SkillGraphValidationError(RuntimeError):
    """Raised when the skill graph payload violates schema expectations."""


class NodeType(str, Enum):
    """Supported node types within the skill graph dataset."""

    COURSE_STEP = "course_step"
    SKILL = "skill"


class EdgeType(str, Enum):
    """Supported edge types within the skill graph dataset."""

    REQUIRES = "requires"
    TEACHES = "teaches"
    ENABLES = "enables"
    DECOMPOSES = "decomposes"


class SkillNode(BaseModel):
    """Model describing a node entry in the skill graph."""

    id: str
    type: NodeType
    label: str
    lens: List[str] = Field(default_factory=list)
    tier: int | None = None
    domain: str | None = None
    levels: int | None = None
    xp_reward: int | None = None
    lrc_focus: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SkillEdge(BaseModel):
    """Model describing an edge entry in the skill graph."""

    source: str = Field(..., alias="from")
    target: str = Field(..., alias="to")
    type: EdgeType
    min_level: int | None = None
    delta_level: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    if ConfigDict is not None:  # pragma: no branch - simple configuration toggle
        model_config = ConfigDict(populate_by_name=True)
    else:  # pragma: no cover - exercised under pydantic v1
        class Config:
            allow_population_by_field_name = True


class SkillGraph(BaseModel):
    """Top-level container describing the skill graph dataset."""

    version: str | None = None
    nodes: List[SkillNode]
    edges: List[SkillEdge]
    meta: dict[str, Any] = Field(default_factory=dict)


PROGRESSION_EDGE_TYPES: frozenset[EdgeType] = frozenset(
    {
        EdgeType.REQUIRES,
        EdgeType.ENABLES,
        EdgeType.DECOMPOSES,
    }
)


def _model_validate(payload: dict[str, Any]) -> SkillGraph:
    validator = getattr(SkillGraph, "model_validate", None)
    try:
        if validator is not None:
            return validator(payload)
        return SkillGraph.parse_obj(payload)  # type: ignore[attr-defined]
    except ValidationError as exc:  # pragma: no cover - delegated error message
        raise SkillGraphValidationError(
            f"Skill graph payload does not match schema expectations: {exc}"
        ) from exc


def parse_graph(payload: dict[str, Any]) -> SkillGraph:
    """Parse the raw payload into a :class:`SkillGraph` instance."""

    return _model_validate(payload)


def load_graph(path: Path) -> SkillGraph:
    """Load and parse the DAG payload from *path*.

    Parameters
    ----------
    path:
        Location of the JSON payload to validate.

    Returns
    -------
    SkillGraph
        Parsed representation of the dataset.

    Raises
    ------
    SkillGraphValidationError
        If the file cannot be read or parsed as JSON.
    """

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:  # pragma: no cover - handled via unit tests
        raise SkillGraphValidationError(f"DAG dataset not found at {path}") from exc
    except json.JSONDecodeError as exc:
        raise SkillGraphValidationError(
            f"Invalid JSON payload supplied at {path}: {exc}"
        ) from exc

    return parse_graph(payload)


def _validate_nodes(nodes: Sequence[SkillNode]) -> dict[str, SkillNode]:
    seen: dict[str, SkillNode] = {}
    for node in nodes:
        if node.id in seen:
            raise SkillGraphValidationError(f"Duplicate node id detected: {node.id}")
        if not node.label:
            raise SkillGraphValidationError(f"Node '{node.id}' must define a label")
        if node.type is NodeType.SKILL and node.levels is None:
            raise SkillGraphValidationError(
                f"Skill node '{node.id}' must specify 'levels'"
            )
        if node.type is NodeType.COURSE_STEP and node.tier is None:
            raise SkillGraphValidationError(
                f"Course step '{node.id}' must specify a 'tier'"
            )
        seen[node.id] = node
    return seen


def _validate_edges(nodes: dict[str, SkillNode], graph: SkillGraph) -> None:
    for edge in graph.edges:
        if edge.source not in nodes:
            raise SkillGraphValidationError(
                f"Edge from '{edge.source}' references unknown node"
            )
        if edge.target not in nodes:
            raise SkillGraphValidationError(
                f"Edge to '{edge.target}' references unknown node"
            )

        source = nodes[edge.source]
        target = nodes[edge.target]

        if edge.type is EdgeType.REQUIRES:
            if source.type is not NodeType.SKILL:
                raise SkillGraphValidationError(
                    "'requires' edges must originate from skill nodes"
                )
            if target.type is not NodeType.COURSE_STEP:
                raise SkillGraphValidationError(
                    "'requires' edges must point to course_step nodes"
                )
            if edge.min_level is None:
                raise SkillGraphValidationError(
                    f"'requires' edge {edge.source}->{edge.target} must declare 'min_level'"
                )
            if edge.min_level < 0:
                raise SkillGraphValidationError(
                    f"'requires' edge {edge.source}->{edge.target} must have non-negative 'min_level'"
                )
        elif edge.type is EdgeType.TEACHES:
            if source.type is not NodeType.COURSE_STEP:
                raise SkillGraphValidationError(
                    "'teaches' edges must originate from course_step nodes"
                )
            if target.type is not NodeType.SKILL:
                raise SkillGraphValidationError(
                    "'teaches' edges must point to skill nodes"
                )
            if edge.delta_level is None:
                raise SkillGraphValidationError(
                    f"'teaches' edge {edge.source}->{edge.target} must declare 'delta_level'"
                )
            if edge.delta_level <= 0:
                raise SkillGraphValidationError(
                    f"'teaches' edge {edge.source}->{edge.target} must have positive 'delta_level'"
                )
        elif edge.type is EdgeType.ENABLES:
            if source.type is not NodeType.COURSE_STEP or target.type is not NodeType.COURSE_STEP:
                raise SkillGraphValidationError(
                    "'enables' edges must connect course_step nodes"
                )
        elif edge.type is EdgeType.DECOMPOSES:
            if source.type is not NodeType.SKILL or target.type is not NodeType.SKILL:
                raise SkillGraphValidationError(
                    "'decomposes' edges must connect skill nodes"
                )


def _topological_sort(nodes: Iterable[SkillNode], graph: SkillGraph) -> List[str]:
    adjacency: dict[str, set[str]] = defaultdict(set)
    indegree: dict[str, int] = {node.id: 0 for node in nodes}

    for edge in graph.edges:
        if edge.type not in PROGRESSION_EDGE_TYPES:
            continue
        adjacency[edge.source].add(edge.target)
        indegree.setdefault(edge.target, 0)
        indegree.setdefault(edge.source, 0)
        indegree[edge.target] += 1

    queue: deque[str] = deque(node_id for node_id, degree in indegree.items() if degree == 0)
    order: List[str] = []

    while queue:
        node_id = queue.popleft()
        order.append(node_id)
        for neighbour in adjacency.get(node_id, set()):
            indegree[neighbour] -= 1
            if indegree[neighbour] == 0:
                queue.append(neighbour)

    total_considered = len(indegree)
    if len(order) != total_considered:
        remaining = sorted(node_id for node_id, degree in indegree.items() if degree > 0)
        raise SkillGraphValidationError(
            "Cycle detected in progression edges involving: " + ", ".join(remaining)
        )

    return order


def validate_graph(graph: SkillGraph) -> List[str]:
    """Validate the provided :class:`SkillGraph` instance.

    Returns a topological ordering of the DAG nodes considering the
    progression edge types. Any validation failure raises
    :class:`SkillGraphValidationError`.
    """

    nodes = _validate_nodes(graph.nodes)
    _validate_edges(nodes, graph)
    return _topological_sort(nodes.values(), graph)


def _build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate the curriculum skill DAG and report ordering information.",
    )
    parser.add_argument(
        "path",
        nargs="?",
        default=Path("app/data/dag.json"),
        type=Path,
        help="Path to the DAG JSON payload (defaults to app/data/dag.json).",
    )
    parser.add_argument(
        "--show-order",
        action="store_true",
        help="Print the computed topological order after validation succeeds.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_argument_parser()
    args = parser.parse_args(argv)
    try:
        graph = load_graph(args.path)
        order = validate_graph(graph)
    except SkillGraphValidationError as exc:
        print(f"Validation failed: {exc}", file=sys.stderr)
        return 1

    message = f"Validated skill graph with {len(graph.nodes)} nodes and {len(graph.edges)} edges."
    if args.show_order:
        order_lines = "\n".join(order)
        message = f"{message}\nTopological order (progression edges):\n{order_lines}"
    print(message)
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())
