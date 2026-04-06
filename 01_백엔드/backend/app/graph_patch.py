"""Validation and merge helpers for Graph Patch JSON payloads."""
from __future__ import annotations

import json
from copy import deepcopy
from typing import Any, Iterable, Mapping

ALLOWED_EDGE_TYPES = {"requires", "enables", "analog_of"}

_RESEARCHER_ORDER = {"R1": 0, "R2": 1, "R3": 2}
_EDGE_PRIORITY = {
    "requires": ["R2", "R1", "R3"],
    "enables": ["R3", "R1", "R2"],
    "analog_of": ["R3", "R1", "R2"],
}


def _contains_level(value: Any) -> bool:
    if isinstance(value, Mapping):
        for key, item in value.items():
            if key == "level":
                return True
            if _contains_level(item):
                return True
        return False
    if isinstance(value, list):
        return any(_contains_level(item) for item in value)
    return False


def _stable_key(item: Mapping[str, Any]) -> str:
    return json.dumps(item, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def validate_graph_patch(patch: Mapping[str, Any]) -> None:
    if not isinstance(patch, Mapping):
        raise ValueError("Graph patch must be a JSON object.")

    researcher = patch.get("researcher")
    scope = patch.get("scope")
    if not researcher:
        raise ValueError("Graph patch missing required field 'researcher'.")
    if not scope:
        raise ValueError("Graph patch missing required field 'scope'.")

    if _contains_level(patch):
        raise ValueError("Graph patch must not contain the 'level' field.")

    notes = patch.get("notes")
    if notes is not None:
        if not isinstance(notes, list):
            raise ValueError("Graph patch notes must be a list.")
        for idx, note in enumerate(notes):
            if not isinstance(note, Mapping):
                raise ValueError(f"Graph patch note at index {idx} must be an object.")
            if "confidence" not in note:
                raise ValueError("Graph patch note missing confidence.")
            confidence = note["confidence"]
            if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
                raise ValueError("Graph patch note confidence must be between 0 and 1.")
            if confidence < 0 or confidence > 1:
                raise ValueError("Graph patch note confidence must be between 0 and 1.")

    add_edges = patch.get("add_edges")
    if add_edges is not None:
        if not isinstance(add_edges, list):
            raise ValueError("Graph patch add_edges must be a list.")
        for idx, edge in enumerate(add_edges):
            if not isinstance(edge, Mapping):
                raise ValueError(f"Graph patch edge at index {idx} must be an object.")
            edge_type = edge.get("type")
            if edge_type not in ALLOWED_EDGE_TYPES:
                raise ValueError(f"Graph patch edge type '{edge_type}' is invalid.")


def _ordered_patches(patches: Iterable[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    ordered = []
    for idx, patch in enumerate(patches):
        researcher = patch.get("researcher")
        priority = _RESEARCHER_ORDER.get(researcher, 99)
        ordered.append((priority, idx, patch))
    ordered.sort(key=lambda item: (item[0], item[1]))
    return [patch for _, __, patch in ordered]


def _node_key(node: Mapping[str, Any]) -> str:
    node_id = node.get("id")
    if node_id is not None:
        return str(node_id)
    return _stable_key(node)


def _alias_key(alias: Mapping[str, Any]) -> str:
    alias_id = alias.get("alias")
    keep_id = alias.get("keep")
    if alias_id is not None or keep_id is not None:
        return f"{alias_id}->{keep_id}"
    return _stable_key(alias)


def _edge_key(edge: Mapping[str, Any]) -> tuple[Any, Any, Any]:
    return (edge.get("from"), edge.get("to"), edge.get("type"))


def _merge_list(
    patches: Iterable[Mapping[str, Any]],
    field: str,
    key_fn,
) -> list[dict]:
    merged: list[dict] = []
    seen: set[Any] = set()
    for patch in patches:
        items = patch.get(field) or []
        if items is None:
            continue
        if not isinstance(items, list):
            raise ValueError(f"Graph patch field '{field}' must be a list.")
        for item in items:
            if not isinstance(item, Mapping):
                raise ValueError(f"Graph patch field '{field}' entries must be objects.")
            key = key_fn(item)
            if key in seen:
                continue
            seen.add(key)
            merged.append(deepcopy(dict(item)))
    return merged


def _edge_priority(edge_type: str | None, researcher: Any) -> int:
    order = _EDGE_PRIORITY.get(edge_type, ["R1", "R2", "R3"])
    try:
        return order.index(researcher)
    except ValueError:
        return len(order)


def _merge_edges(patches: Iterable[Mapping[str, Any]]) -> list[dict]:
    best_edges: dict[tuple[Any, Any, Any], Mapping[str, Any]] = {}
    best_ranks: dict[tuple[Any, Any, Any], int] = {}

    for patch in patches:
        researcher = patch.get("researcher")
        edges = patch.get("add_edges") or []
        if edges is None:
            continue
        if not isinstance(edges, list):
            raise ValueError("Graph patch add_edges must be a list.")
        for edge in edges:
            if not isinstance(edge, Mapping):
                raise ValueError("Graph patch edge entries must be objects.")
            key = _edge_key(edge)
            rank = _edge_priority(edge.get("type"), researcher)
            current_rank = best_ranks.get(key)
            if current_rank is None or rank < current_rank:
                best_ranks[key] = rank
                best_edges[key] = edge

    merged: list[dict] = []
    seen: set[tuple[Any, Any, Any]] = set()
    for patch in patches:
        edges = patch.get("add_edges") or []
        if edges is None:
            continue
        for edge in edges:
            key = _edge_key(edge)
            if key in seen:
                continue
            if best_edges.get(key) is edge:
                merged.append(deepcopy(dict(edge)))
                seen.add(key)
    return merged


def merge_graph_patches(patches: Iterable[Mapping[str, Any]]) -> dict:
    patch_list = list(patches)
    if not patch_list:
        raise ValueError("No graph patches provided.")

    for patch in patch_list:
        validate_graph_patch(patch)

    scope = patch_list[0].get("scope")
    for patch in patch_list[1:]:
        if patch.get("scope") != scope:
            raise ValueError("Graph patch scopes must match.")

    ordered = _ordered_patches(patch_list)

    return {
        "researcher": "MERGED",
        "scope": scope,
        "add_nodes": _merge_list(ordered, "add_nodes", _node_key),
        "merge_aliases": _merge_list(ordered, "merge_aliases", _alias_key),
        "add_edges": _merge_edges(ordered),
        "remove_edges": _merge_list(ordered, "remove_edges", _edge_key),
        "notes": _merge_list(ordered, "notes", _stable_key),
    }
