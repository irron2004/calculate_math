from __future__ import annotations

import pytest

from app.graph_patch import merge_graph_patches, validate_graph_patch


def _base_patch() -> dict:
    return {
        "researcher": "R1",
        "scope": "SCOPE-1",
        "add_nodes": [],
        "merge_aliases": [],
        "add_edges": [],
        "remove_edges": [],
        "notes": [],
    }


@pytest.mark.parametrize(
    "patch",
    [
        {"scope": "SCOPE-1"},
        {"researcher": "R1"},
        {"researcher": "", "scope": "SCOPE-1"},
        {"researcher": "R1", "scope": ""},
    ],
)
def test_validate_graph_patch_missing_required_fields(patch):
    with pytest.raises(ValueError):
        validate_graph_patch(patch)


def test_validate_graph_patch_invalid_confidence():
    patch = _base_patch()
    patch["notes"] = [{"claim": "c1", "reason": "r1"}]
    with pytest.raises(ValueError):
        validate_graph_patch(patch)

    patch["notes"] = [{"claim": "c2", "reason": "r2", "confidence": 1.2}]
    with pytest.raises(ValueError):
        validate_graph_patch(patch)


def test_validate_graph_patch_invalid_edge_type():
    patch = _base_patch()
    patch["add_edges"] = [{"from": "A", "to": "B", "type": "blocks"}]
    with pytest.raises(ValueError):
        validate_graph_patch(patch)


def test_validate_graph_patch_level_field_rejected():
    patch = _base_patch()
    patch["add_nodes"] = [{"id": "N1", "level": 2}]
    with pytest.raises(ValueError):
        validate_graph_patch(patch)


def test_merge_graph_patches_edge_priority_and_dedupe():
    patch_r1 = {
        "researcher": "R1",
        "scope": "SCOPE-1",
        "add_nodes": [{"id": "N1", "type": "micro", "name_ko": "Alpha"}],
        "add_edges": [
            {"from": "A", "to": "B", "type": "requires", "note": "r1"},
            {"from": "C", "to": "D", "type": "enables", "note": "r1"},
        ],
        "notes": [{"claim": "c1", "reason": "r1", "confidence": 0.4}],
    }
    patch_r2 = {
        "researcher": "R2",
        "scope": "SCOPE-1",
        "add_nodes": [{"id": "N1", "type": "micro", "name_ko": "Dup"}],
        "add_edges": [
            {"from": "A", "to": "B", "type": "requires", "note": "r2"},
            {"from": "E", "to": "F", "type": "analog_of", "note": "r2"},
        ],
        "notes": [{"claim": "c2", "reason": "r2", "confidence": 0.6}],
    }
    patch_r3 = {
        "researcher": "R3",
        "scope": "SCOPE-1",
        "add_nodes": [{"id": "N2", "type": "micro", "name_ko": "Beta"}],
        "add_edges": [
            {"from": "C", "to": "D", "type": "enables", "note": "r3"},
            {"from": "E", "to": "F", "type": "analog_of", "note": "r3"},
        ],
        "notes": [{"claim": "c3", "reason": "r3", "confidence": 0.8}],
    }

    merged = merge_graph_patches([patch_r2, patch_r3, patch_r1])

    assert merged["researcher"] == "MERGED"
    assert merged["scope"] == "SCOPE-1"
    assert len(merged["add_nodes"]) == 2

    requires_edges = [edge for edge in merged["add_edges"] if edge["type"] == "requires"]
    enables_edges = [edge for edge in merged["add_edges"] if edge["type"] == "enables"]
    analog_edges = [edge for edge in merged["add_edges"] if edge["type"] == "analog_of"]

    assert len(requires_edges) == 1
    assert requires_edges[0]["note"] == "r2"
    assert len(enables_edges) == 1
    assert enables_edges[0]["note"] == "r3"
    assert len(analog_edges) == 1
    assert analog_edges[0]["note"] == "r3"
