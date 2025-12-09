from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.recompute_skill_levels import compute_levels, rewrite_levels


def test_compute_levels_simple_chain():
    nodes = {
        "A": {"id": "A", "requires": None},
        "B": {"id": "B", "requires": {"all_of": ["A"]}},
        "C": {"id": "C", "requires": {"any_of": ["B"]}},
    }
    levels = compute_levels(nodes, edges=[], allow_missing=False)

    assert levels == {"A": 1, "B": 2, "C": 3}


def test_compute_levels_with_edges_and_allow_missing():
    nodes = {
        "A": {"id": "A"},
        "B": {"id": "B"},
    }
    edges = [{"from": "A", "to": "B", "type": "requires"}, {"from": "X", "to": "B", "type": "requires"}]

    levels = compute_levels(nodes, edges, allow_missing=True)

    assert levels == {"A": 1, "B": 2}


def test_rewrite_levels_roundtrip(tmp_path: Path):
    payload = {
        "nodes": [
            {"id": "A", "label": "A", "requires": None, "tier": 1},
            {"id": "B", "label": "B", "requires": {"all_of": ["A"]}, "tier": 1},
            {"id": "C", "label": "C", "requires": {"all_of": ["B"]}, "tier": 2},
        ],
        "edges": [],
    }
    inp = tmp_path / "skills.json"
    inp.write_text(json.dumps(payload), encoding="utf-8")

    out_path = rewrite_levels(
        input_path=inp,
        output_path=None,
        allow_missing=False,
        kinds=None,
        drop_tier=True,
    )

    written = json.loads(out_path.read_text(encoding="utf-8"))
    nodes = {node["id"]: node for node in written["nodes"]}
    assert nodes["A"]["level"] == 1
    assert nodes["B"]["level"] == 2
    assert nodes["C"]["level"] == 3
    assert "tier" not in nodes["A"]


def test_rewrite_levels_respects_kind_filter(tmp_path: Path):
    payload = {
        "nodes": [
            {"id": "A", "label": "A", "requires": None, "kind": "skill"},
            {"id": "B", "label": "B", "requires": {"all_of": ["A"]}, "kind": "boss"},
            {"id": "C", "label": "C", "requires": {"all_of": ["B"]}, "kind": "course_step"},
        ],
        "edges": [],
    }
    inp = tmp_path / "skills.json"
    inp.write_text(json.dumps(payload), encoding="utf-8")

    out_path = rewrite_levels(
        input_path=inp,
        output_path=None,
        allow_missing=False,
        kinds={"skill", "boss"},
        drop_tier=False,
    )

    written = json.loads(out_path.read_text(encoding="utf-8"))
    nodes = {node["id"]: node for node in written["nodes"]}
    assert nodes["A"]["level"] == 1
    assert nodes["B"]["level"] == 2
    # course_step should remain untouched (no level added because filtered out)
    assert "level" not in nodes["C"]


def test_compute_levels_detects_cycle():
    nodes = {
        "A": {"id": "A", "requires": {"all_of": ["B"]}},
        "B": {"id": "B", "requires": {"all_of": ["A"]}},
    }

    with pytest.raises(ValueError):
        compute_levels(nodes, edges=[], allow_missing=False)
