#!/usr/bin/env python3
"""Utility to verify skill tree assets are synchronised.

Checks include:
* `app/data/skills.ui.json` exists and contains graph nodes/edges.
* Each UI node ID maps to a `course_step` node in `graph.bipartite.json`.
* Edge endpoints declared in the UI spec reference existing UI nodes.

This script is intended for local diagnostics prior to deployment.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Set

REPO_ROOT = Path(__file__).resolve().parents[1]
UI_PATH = REPO_ROOT / "app" / "data" / "skills.ui.json"
BIPARTITE_PATH = REPO_ROOT / "graph.bipartite.json"


@dataclass
class ValidationIssue:
    kind: str
    message: str
    detail: str | None = None


def load_json(path: Path) -> dict:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Missing required file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to parse JSON: {path}") from exc


def collect_course_step_ids(bipartite_payload: dict) -> Set[str]:
    nodes = bipartite_payload.get("nodes", [])
    return {node["id"] for node in nodes if node.get("type") == "course_step"}


def validate_ui_spec(ui_payload: dict, course_step_ids: Iterable[str]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    ui_nodes = ui_payload.get("nodes", [])
    ui_edges = ui_payload.get("edges", [])

    if not ui_nodes:
        issues.append(
            ValidationIssue(
                kind="error",
                message="UI spec contains no nodes.",
                detail="`skills.ui.json` must define at least one course-step node.",
            )
        )

    if not ui_edges:
        issues.append(
            ValidationIssue(
                kind="warning",
                message="UI spec contains no edges.",
                detail="Confirm whether a linear progression is expected; empty edges will hide graph links.",
            )
        )

    course_step_set = set(course_step_ids)
    ui_node_ids = {node.get("id") for node in ui_nodes if "id" in node}

    missing_in_bipartite = sorted(node_id for node_id in ui_node_ids if node_id not in course_step_set)
    if missing_in_bipartite:
        issues.append(
            ValidationIssue(
                kind="error",
                message="UI node IDs missing from bipartite graph.",
                detail=", ".join(missing_in_bipartite[:10]) + ("…" if len(missing_in_bipartite) > 10 else ""),
            )
        )

    dangling_edges = []
    for edge in ui_edges:
        source = edge.get("from")
        target = edge.get("to")
        if source not in ui_node_ids or target not in ui_node_ids:
            dangling_edges.append(f"{source}->{target}")

    if dangling_edges:
        issues.append(
            ValidationIssue(
                kind="error",
                message="Edges reference unknown UI nodes.",
                detail=", ".join(dangling_edges[:10]) + ("…" if len(dangling_edges) > 10 else ""),
            )
        )

    return issues


def main() -> int:
    try:
        ui_payload = load_json(UI_PATH)
        bipartite_payload = load_json(BIPARTITE_PATH)
    except RuntimeError as exc:
        print(f"[skill-tree-check] {exc}", file=sys.stderr)
        return 2

    course_step_ids = collect_course_step_ids(bipartite_payload)
    issues = validate_ui_spec(ui_payload, course_step_ids)

    if not issues:
        node_count = len(ui_payload.get("nodes", []))
        edge_count = len(ui_payload.get("edges", []))
        print(
            f"[skill-tree-check] OK: {node_count} nodes, {edge_count} edges validated against bipartite graph.",
            file=sys.stdout,
        )
        return 0

    for issue in issues:
        detail_suffix = f" ({issue.detail})" if issue.detail else ""
        print(f"[skill-tree-check][{issue.kind}] {issue.message}{detail_suffix}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
