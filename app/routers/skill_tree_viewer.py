"""Skill tree viewer API that exposes levelled nodes and edges for the React graph."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from fastapi import APIRouter, HTTPException, Query

DATA_PATHS = [
    Path("app/data/curriculum_skill.json"),
    Path("docs/skill_tree_k12_l0_l2.json"),
]

router = APIRouter(prefix="/api/v1/skills", tags=["skills-viewer"])


def _list_requires(requires: Any) -> list[str]:
    if requires is None:
        return []
    if isinstance(requires, list):
        return [str(item) for item in requires]
    if isinstance(requires, str):
        return [requires]
    if isinstance(requires, dict):
        parts: list[str] = []
        for key in ("all_of", "any_of"):
            val = requires.get(key)
            if isinstance(val, list):
                parts.extend(str(item) for item in val)
            elif isinstance(val, str):
                parts.append(val)
        return parts
    return []


def _load_payload() -> dict[str, Any]:
    for path in DATA_PATHS:
        if not path.exists():
            continue
        try:
            import json

            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
    raise FileNotFoundError("No skill tree dataset available")


def _filter_nodes(raw_nodes: list[dict[str, Any]], skip_boss: bool) -> dict[str, dict[str, Any]]:
    nodes: dict[str, dict[str, Any]] = {}
    for node in raw_nodes:
        node_id = node.get("id")
        if not node_id:
            continue
        kind = str(node.get("kind") or node.get("type") or "").lower()
        if skip_boss and (kind == "boss" or str(node.get("boss", "")).lower() not in {"", "false", "0"}):
            continue
        nodes[str(node_id)] = dict(node)
    return nodes


def _build_pred(nodes: dict[str, dict[str, Any]], edges: Iterable[dict[str, Any]], allow_missing: bool) -> dict[str, set[str]]:
    pred: dict[str, set[str]] = {}
    for node_id, node in nodes.items():
        for parent in _list_requires(node.get("requires")):
            if parent not in nodes and not allow_missing:
                raise ValueError(f"{node_id} references missing prerequisite '{parent}'")
            if parent in nodes:
                pred.setdefault(node_id, set()).add(parent)

    for edge in edges:
        if edge.get("type") != "requires":
            continue
        src = edge.get("from")
        dst = edge.get("to")
        if not src or not dst:
            continue
        if src not in nodes or dst not in nodes:
            if allow_missing:
                continue
            raise ValueError(f"Edge {src}->{dst} references missing node")
        pred.setdefault(dst, set()).add(str(src))
    return pred


@dataclass(frozen=True)
class LevelledTree:
    nodes: list[dict[str, Any]]
    edges: list[dict[str, str]]
    max_level: int
    source: str


def _compute_levels(nodes: dict[str, dict[str, Any]], pred: dict[str, set[str]]) -> dict[str, int]:
    from collections import deque

    indeg = {nid: len(pred.get(nid, [])) for nid in nodes}
    succ: dict[str, list[str]] = {}
    for target, parents in pred.items():
        for parent in parents:
            succ.setdefault(parent, []).append(target)

    level = {nid: 1 for nid in nodes}
    queue = deque([nid for nid, deg in indeg.items() if deg == 0])
    visited = 0
    while queue:
        u = queue.popleft()
        visited += 1
        for v in succ.get(u, []):
            level[v] = max(level[v], level[u] + 1)
            indeg[v] -= 1
            if indeg[v] == 0:
                queue.append(v)
    if visited != len(nodes):
        raise ValueError("Cycle detected or graph disconnected")
    return level


def _build_levelled_tree(skip_boss: bool, allow_missing: bool) -> LevelledTree:
    payload = _load_payload()
    raw_nodes = payload.get("nodes")
    raw_edges = payload.get("edges", [])
    if not isinstance(raw_nodes, list):
        raise ValueError("Skill dataset must contain a nodes array")
    if not isinstance(raw_edges, list):
        raise ValueError("Skill dataset edges must be a list")

    nodes = _filter_nodes(raw_nodes, skip_boss=skip_boss)
    pred = _build_pred(nodes, raw_edges, allow_missing=allow_missing)
    levels = _compute_levels(nodes, pred)

    edges: list[dict[str, str]] = []
    for target, parents in pred.items():
        for parent in parents:
            edges.append({"from": parent, "to": target})

    for node_id, lvl in levels.items():
        node = nodes[node_id]
        node["level"] = lvl
        # derive default state: unlocked if no prereq, else locked
        state = "available" if not pred.get(node_id) else "locked"
        node.setdefault("state", state)
        node.setdefault("prerequisites", list(pred.get(node_id, [])))

    return LevelledTree(
        nodes=list(nodes.values()),
        edges=edges,
        max_level=max(levels.values()) if levels else 0,
        source=str(DATA_PATHS[0] if DATA_PATHS[0].exists() else DATA_PATHS[-1]),
    )


@router.get("/tree-diablo")
async def get_diablo_skill_tree(
    max_level: int | None = Query(None, ge=1, description="Optional maximum level to include"),
    skip_boss: bool = Query(True, description="Exclude boss nodes"),
    allow_missing: bool = Query(True, description="Skip missing prerequisites instead of failing"),
):
    """Expose a levelled skill tree for the interactive viewer."""

    try:
        tree = _build_levelled_tree(skip_boss=skip_boss, allow_missing=allow_missing)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    nodes = tree.nodes
    if max_level is not None:
        nodes = [node for node in nodes if int(node.get("level", 0)) <= max_level]
        visible_ids = {node["id"] for node in nodes}
        edges = [edge for edge in tree.edges if edge["from"] in visible_ids and edge["to"] in visible_ids]
    else:
        edges = tree.edges

    return {
        "source": tree.source,
        "max_level": tree.max_level,
        "nodes": nodes,
        "edges": edges,
    }
