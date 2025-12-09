#!/usr/bin/env python3
"""Recompute skill levels from prerequisite relationships.

Levels are derived as:
- Nodes with no prerequisites -> level = 1
- Otherwise: level(node) = max(level(prereq)) + 1

Supports two prerequisite sources:
- Inline `requires` on nodes (expects `all_of`/`any_of` lists)
- Edges with `type == "requires"` (from -> to)

Usage:
  python scripts/recompute_skill_levels.py --in app/data/curriculum_skill.json --out app/data/curriculum_skill.levels.json
  python scripts/recompute_skill_levels.py --in app/data/curriculum_skill.json --in-place --drop-tier

Flags:
- --allow-missing: skip missing prereq refs instead of failing
- --kinds kind1,kind2: only include nodes whose `kind` or `type` is in the list
- --drop-tier: remove the `tier` field from nodes after recompute
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict, deque
from pathlib import Path
from typing import Iterable, Mapping, MutableMapping, Sequence


def _list_requires(requires: object) -> list[str]:
    if requires is None:
        return []
    if isinstance(requires, list):
        return [str(item) for item in requires]
    if isinstance(requires, str):
        return [requires]
    if isinstance(requires, Mapping):
        parts: list[str] = []
        for key in ("all_of", "any_of"):
            val = requires.get(key)
            if isinstance(val, list):
                parts.extend(str(item) for item in val)
            elif isinstance(val, str):
                parts.append(val)
        return parts
    return []


def _build_pred_lookup(
    nodes: MutableMapping[str, MutableMapping[str, object]],
    edges: Iterable[Mapping[str, object]],
    *,
    allow_missing: bool,
) -> dict[str, set[str]]:
    pred: dict[str, set[str]] = defaultdict(set)

    for node_id, node in nodes.items():
        for parent in _list_requires(node.get("requires")):
            if parent not in nodes and not allow_missing:
                raise ValueError(f"{node_id} references missing prerequisite '{parent}'")
            if parent in nodes:
                pred[node_id].add(parent)

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
        pred[dst].add(src)

    return pred


def compute_levels(
    nodes: MutableMapping[str, MutableMapping[str, object]],
    edges: Iterable[Mapping[str, object]],
    *,
    allow_missing: bool = False,
) -> dict[str, int]:
    pred = _build_pred_lookup(nodes, edges, allow_missing=allow_missing)
    indegree: dict[str, int] = {node_id: 0 for node_id in nodes}
    succ: dict[str, list[str]] = defaultdict(list)
    for node_id, parents in pred.items():
        indegree[node_id] = len(parents)
        for parent in parents:
            succ[parent].append(node_id)

    level: dict[str, int] = {node_id: 1 for node_id in nodes}
    queue: deque[str] = deque([nid for nid, deg in indegree.items() if deg == 0])
    visited = 0

    while queue:
        u = queue.popleft()
        visited += 1
        for v in succ.get(u, []):
            level[v] = max(level[v], level[u] + 1)
            indegree[v] -= 1
            if indegree[v] == 0:
                queue.append(v)

    if visited != len(nodes):
        raise ValueError("Cycle detected or graph is disconnected; could not visit all nodes")

    return level


def _filter_nodes_by_kind(
    nodes: list[MutableMapping[str, object]],
    *,
    kinds: set[str] | None,
) -> dict[str, MutableMapping[str, object]]:
    if kinds is None:
        return {node["id"]: node for node in nodes if "id" in node}

    filtered: dict[str, MutableMapping[str, object]] = {}
    for node in nodes:
        node_id = node.get("id")
        if not node_id:
            continue
        kind = str(node.get("kind") or node.get("type") or "").lower()
        if kind in kinds:
            filtered[str(node_id)] = node
    return filtered


def _parse_kinds(raw: str | None) -> set[str] | None:
    if not raw:
        return None
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def rewrite_levels(
    input_path: Path,
    output_path: Path | None,
    *,
    allow_missing: bool,
    kinds: set[str] | None,
    drop_tier: bool,
) -> Path:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    nodes_raw = payload.get("nodes")
    if not isinstance(nodes_raw, list):
        raise ValueError("Input payload must contain a 'nodes' array")
    edges_raw = payload.get("edges") or []
    if not isinstance(edges_raw, list):
        raise ValueError("Input payload 'edges' must be a list")

    nodes = _filter_nodes_by_kind(nodes_raw, kinds=kinds)
    if not nodes:
        raise ValueError("No nodes remain after applying kind filter")

    levels = compute_levels(nodes, edges_raw, allow_missing=allow_missing)
    for node_id, lvl in levels.items():
        nodes[node_id]["level"] = lvl
        if drop_tier:
            nodes[node_id].pop("tier", None)

    payload["nodes"] = nodes_raw  # mutated in place

    out_path = input_path if output_path is None else output_path
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return out_path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Recompute skill levels from prerequisites")
    parser.add_argument("--in", dest="input_path", required=True, help="Path to input JSON")
    group = parser.add_mutually_exclusive_group(required=False)
    group.add_argument("--out", dest="output_path", help="Path to write output JSON")
    group.add_argument(
        "--in-place",
        dest="in_place",
        action="store_true",
        help="Overwrite the input file in place",
    )
    parser.add_argument(
        "--allow-missing",
        action="store_true",
        help="Skip missing prerequisite references instead of failing",
    )
    parser.add_argument(
        "--kinds",
        help="Comma-separated list of node kinds/types to include (default: include all)",
    )
    parser.add_argument(
        "--drop-tier",
        action="store_true",
        help="Remove the 'tier' field from nodes after recomputing",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    input_path = Path(args.input_path)
    output_path = None if args.in_place else (Path(args.output_path) if args.output_path else None)
    kinds = _parse_kinds(args.kinds)

    try:
        out_path = rewrite_levels(
            input_path=input_path,
            output_path=output_path,
            allow_missing=args.allow_missing,
            kinds=kinds,
            drop_tier=args.drop_tier,
        )
    except Exception as exc:  # pragma: no cover - CLI guardrail
        print(f"Level recompute failed: {exc}")
        return 1

    print(f"Wrote recomputed levels to {out_path}")
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(main())
