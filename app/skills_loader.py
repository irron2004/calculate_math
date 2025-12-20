"""Utilities for loading and querying the curriculum skill DAG."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from pydantic import ValidationError

from app.schemas.skill import EdgeType, SkillEdge, SkillGraphSpec, SkillKind, SkillNode

_BASE_DIR = Path(__file__).resolve().parent
_DOCS_PATH = _BASE_DIR.parent / "docs" / "dag.md"
_JSON_EXPORT_PATH = _BASE_DIR / "data" / "skills.json"
_LEGACY_JSON_EXPORT_PATH = _BASE_DIR / "data" / ".old" / "skills.json"


class SkillSpecError(RuntimeError):
    """Raised when the curriculum specification cannot be loaded or validated."""


def _extract_json_blob(markdown: str) -> Optional[str]:
    """Return the first JSON code block embedded within markdown content."""

    inside = False
    lines: List[str] = []
    for line in markdown.splitlines():
        if line.strip().startswith("```json") and not inside:
            inside = True
            continue
        if line.strip().startswith("```") and inside:
            break
        if inside:
            lines.append(line)
    return "\n".join(lines) if lines else None


def _load_raw_spec() -> Dict[str, object]:
    """Load the raw JSON skill specification.

    Priority:
    1) Packaged export (app/data/skills.json) — keeps runtime aligned with shipped data.
    2) Legacy export (app/data/.old/skills.json) — fallback for older bundles.
    3) Embedded JSON in docs/dag.md (for local editing and regeneration).
    """

    for candidate in (_JSON_EXPORT_PATH, _LEGACY_JSON_EXPORT_PATH):
        if candidate.exists():
            try:
                return json.loads(candidate.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                raise SkillSpecError("Packaged skill specification is invalid JSON") from exc

    if _DOCS_PATH.exists():
        markdown = _DOCS_PATH.read_text(encoding="utf-8")
        if json_blob := _extract_json_blob(markdown):
            try:
                return json.loads(json_blob)
            except json.JSONDecodeError:
                pass

    raise SkillSpecError("Unable to locate skill specification source")


@lru_cache(maxsize=1)
def _load_skill_spec() -> SkillGraphSpec:
    """Parse and validate the curriculum specification."""

    raw_spec = _load_raw_spec()
    try:
        return SkillGraphSpec.parse_obj(raw_spec)
    except ValidationError as exc:  # pragma: no cover - exercised in tests via parse_obj
        raise SkillSpecError("Invalid skill specification") from exc


def get_skill_graph() -> SkillGraphSpec:
    """Return the validated skill graph specification."""

    return _load_skill_spec()


def get_node(node_id: str) -> SkillNode:
    """Retrieve a node by its identifier."""

    graph = get_skill_graph()
    for node in graph.nodes:
        if node.id == node_id:
            return node
    raise KeyError(f"Unknown skill node '{node_id}'")


def get_nodes_by_tier(tier: int) -> List[SkillNode]:
    """Return nodes that belong to a specific tier."""

    return [node for node in get_skill_graph().nodes if node.tier == tier]


def get_nodes_by_kind(kind: SkillKind) -> List[SkillNode]:
    """Return nodes filtered by their skill kind."""

    return [node for node in get_skill_graph().nodes if node.kind == kind]


def get_boss_nodes() -> List[SkillNode]:
    """Return all boss encounters in the curriculum."""

    return get_nodes_by_kind(SkillKind.BOSS)


def _filter_edges(
    *,
    source: Optional[str] = None,
    target: Optional[str] = None,
    edge_type: Optional[EdgeType] = None,
) -> List[SkillEdge]:
    graph = get_skill_graph()
    edges: Iterable[SkillEdge] = graph.edges
    if source is not None:
        edges = (edge for edge in edges if edge.from_ == source)
    if target is not None:
        edges = (edge for edge in edges if edge.to == target)
    if edge_type is not None:
        edges = (edge for edge in edges if edge.type == edge_type)
    return list(edges)


def get_edges_from(node_id: str, *, edge_type: Optional[EdgeType] = None) -> List[SkillEdge]:
    """Return all outbound edges from the provided node."""

    return _filter_edges(source=node_id, edge_type=edge_type)


def get_edges_to(node_id: str, *, edge_type: Optional[EdgeType] = None) -> List[SkillEdge]:
    """Return all inbound edges to the provided node."""

    return _filter_edges(target=node_id, edge_type=edge_type)


def get_palette_color(lens: str) -> str:
    """Return the configured colour for a given lens key."""

    palette = get_skill_graph().palette
    try:
        return palette[lens]
    except KeyError as exc:
        raise KeyError(f"Lens '{lens}' is not defined in the palette") from exc


__all__ = [
    "EdgeType",
    "SkillGraphSpec",
    "SkillSpecError",
    "SkillKind",
    "SkillNode",
    "SkillEdge",
    "get_skill_graph",
    "get_node",
    "get_nodes_by_tier",
    "get_nodes_by_kind",
    "get_boss_nodes",
    "get_edges_from",
    "get_edges_to",
    "get_palette_color",
]
