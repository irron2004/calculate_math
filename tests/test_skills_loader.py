"""Unit tests for the skill DAG loader and schema validation."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.skill import EdgeType, SkillGraphSpec
from app.skills_loader import (
    SkillKind,
    get_boss_nodes,
    get_edges_from,
    get_edges_to,
    get_node,
    get_nodes_by_kind,
    get_nodes_by_tier,
    get_palette_color,
    get_skill_graph,
)


def test_skill_graph_parses_and_is_queryable() -> None:
    graph = get_skill_graph()

    assert graph.version == "2025-10-11"
    assert graph.nodes, "Expected at least one node in the specification"

    tier_two_nodes = get_nodes_by_tier(2)
    assert tier_two_nodes and all(node.tier == 2 for node in tier_two_nodes)

    boss_nodes = get_boss_nodes()
    assert boss_nodes and all(node.kind == SkillKind.BOSS for node in boss_nodes)

    node = get_node("add_2d_c")
    assert node.label.startswith("덧셈")

    requires_edges = get_edges_from("add_2d_c", edge_type=EdgeType.REQUIRES)
    assert any(edge.to == "fraction_s1" for edge in requires_edges)

    inbound_edges = get_edges_to("avg_rate_s1")
    assert any(edge.from_ == "linear_s2" for edge in inbound_edges)

    assert get_palette_color("accumulation").startswith("#")


def test_missing_palette_entry_is_flagged() -> None:
    graph = get_skill_graph()
    raw = graph.dict(by_alias=True)

    lens_to_remove = next(lens for node in graph.nodes for lens in node.lens if lens)
    raw["palette"].pop(lens_to_remove)

    with pytest.raises(ValidationError):
        SkillGraphSpec.parse_obj(raw)


def test_invalid_requirement_reference_is_flagged() -> None:
    graph = get_skill_graph()
    raw = graph.dict(by_alias=True)

    raw["nodes"][0]["requires"] = {"all_of": ["unknown_skill"], "any_of": [], "min_level": 1}

    with pytest.raises(ValidationError):
        SkillGraphSpec.parse_obj(raw)


def test_kind_filtering_accepts_enum_value() -> None:
    concept_nodes = get_nodes_by_kind(SkillKind.CONCEPT)
    assert concept_nodes
    assert all(node.kind == SkillKind.CONCEPT for node in concept_nodes)

