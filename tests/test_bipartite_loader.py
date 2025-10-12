"""Tests for the bipartite graph loader (course steps ↔ atomic skills)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Any

import pytest
from pydantic import ValidationError

from app import bipartite_loader as loader
from app.schemas.bipartite import EdgeType, BipartiteGraphSpec


def test_bipartite_graph_loads_and_exposes_helpers(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    graph = loader.get_bipartite_graph()

    assert graph.version.startswith("2025-10-12")
    assert len(loader.get_course_steps()) == 36
    assert len(loader.get_atomic_skills()) == 64

    requires_edges = loader.get_edges(EdgeType.REQUIRES)
    teaches_edges = loader.get_edges(EdgeType.TEACHES)

    assert requires_edges and all(edge.type is EdgeType.REQUIRES for edge in requires_edges)
    assert teaches_edges and all(edge.type is EdgeType.TEACHES for edge in teaches_edges)


def test_graph_validation_detects_missing_lens(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    original = loader.get_bipartite_graph()
    raw: Dict[str, Any] = json.loads(original.model_dump_json(by_alias=True))

    some_lens = next(iter(original.palette))
    del raw["palette"][some_lens]

    with pytest.raises(ValidationError):
        BipartiteGraphSpec.model_validate(raw)


def test_graph_validation_detects_missing_nodes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    original = loader.get_bipartite_graph()
    raw: Dict[str, Any] = json.loads(original.model_dump_json(by_alias=True))

    # Remove the target of the first edge to trigger validation.
    removed_node_id = raw["edges"][0]["to"]
    raw["nodes"] = [node for node in raw["nodes"] if node["id"] != removed_node_id]

    with pytest.raises(ValidationError):
        BipartiteGraphSpec.model_validate(raw)

