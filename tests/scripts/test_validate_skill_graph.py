import pytest

from scripts.validate_skill_graph import (
    SkillGraph,
    SkillGraphValidationError,
    parse_graph,
    validate_graph,
)


def _make_graph(payload: dict) -> SkillGraph:
    return parse_graph(payload)


def test_validate_graph_accepts_valid_payload():
    payload = {
        "version": "test",
        "nodes": [
            {"id": "skill-A", "type": "skill", "label": "Skill A", "levels": 3},
            {"id": "skill-B", "type": "skill", "label": "Skill B", "levels": 3},
            {
                "id": "course-1",
                "type": "course_step",
                "label": "Course 1",
                "tier": 1,
            },
            {
                "id": "course-2",
                "type": "course_step",
                "label": "Course 2",
                "tier": 1,
            },
        ],
        "edges": [
            {"from": "skill-A", "to": "course-1", "type": "requires", "min_level": 1},
            {"from": "course-1", "to": "skill-B", "type": "teaches", "delta_level": 1},
            {"from": "course-1", "to": "course-2", "type": "enables"},
            {"from": "skill-A", "to": "skill-B", "type": "decomposes"},
        ],
    }
    graph = _make_graph(payload)

    order = validate_graph(graph)

    assert set(order) == {node["id"] for node in payload["nodes"]}
    assert order.index("skill-A") < order.index("course-1")
    assert order.index("course-1") < order.index("course-2")


def test_validate_graph_rejects_missing_min_level():
    payload = {
        "nodes": [
            {"id": "skill-A", "type": "skill", "label": "Skill A", "levels": 3},
            {"id": "course-1", "type": "course_step", "label": "Course 1", "tier": 1},
        ],
        "edges": [
            {"from": "skill-A", "to": "course-1", "type": "requires"},
        ],
    }
    graph = _make_graph(payload)

    with pytest.raises(SkillGraphValidationError) as exc:
        validate_graph(graph)

    assert "min_level" in str(exc.value)


def test_validate_graph_detects_cycles():
    payload = {
        "nodes": [
            {"id": "skill-A", "type": "skill", "label": "Skill A", "levels": 3},
            {"id": "skill-B", "type": "skill", "label": "Skill B", "levels": 3},
        ],
        "edges": [
            {"from": "skill-A", "to": "skill-B", "type": "decomposes"},
            {"from": "skill-B", "to": "skill-A", "type": "decomposes"},
        ],
    }
    graph = _make_graph(payload)

    with pytest.raises(SkillGraphValidationError) as exc:
        validate_graph(graph)

    assert "Cycle" in str(exc.value)
