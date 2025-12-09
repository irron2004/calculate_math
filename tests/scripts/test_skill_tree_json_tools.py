from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.skill_tree_json_tools import (
    SkillTree,
    SkillTreeParseError,
    SkillTreeValidationError,
    _load_skill_tree_flexible,
    load_skill_tree,
    to_mermaid,
    validate_skill_tree,
)


def _sample_payload() -> dict:
    return {
        "tree_id": "math_basic",
        "title": "Math basics",
        "description": "Sample skill tree for incremental validation",
        "skills": [
            {"id": "nat_num", "name": "Natural numbers", "level": 1, "prerequisites": []},
            {
                "id": "int_num",
                "name": "Integers",
                "level": 2,
                "prerequisites": ["nat_num"],
            },
            {
                "id": "add_sub",
                "name": "Add/Subtract",
                "level": 3,
                "prerequisites": ["int_num"],
            },
            {
                "id": "mul_div",
                "name": "Multiply/Divide",
                "level": 4,
                "prerequisites": ["add_sub"],
            },
            {
                "id": "fractions",
                "name": "Fractions",
                "level": 5,
                "prerequisites": ["mul_div"],
            },
        ],
    }


def test_validate_skill_tree_accepts_valid_payload():
    tree = SkillTree.from_payload(_sample_payload())

    order = validate_skill_tree(tree, max_level=3)

    assert set(order) == {"nat_num", "int_num", "add_sub"}
    assert order.index("nat_num") < order.index("int_num")
    assert order.index("int_num") < order.index("add_sub")


def test_validate_skill_tree_rejects_missing_prerequisite():
    payload = _sample_payload()
    payload["skills"][2]["prerequisites"] = ["missing_skill"]
    tree = SkillTree.from_payload(payload)

    with pytest.raises(SkillTreeValidationError) as exc:
        validate_skill_tree(tree)

    assert "missing_skill" in str(exc.value)


def test_validate_skill_tree_allows_missing_prerequisite_when_requested():
    payload = _sample_payload()
    payload["skills"][2]["prerequisites"] = ["missing_skill"]
    tree = SkillTree.from_payload(payload)

    order = validate_skill_tree(tree, allow_missing_prereqs=True)

    assert set(order) == {skill["id"] for skill in payload["skills"]}


def test_validate_skill_tree_rejects_non_increasing_levels():
    payload = _sample_payload()
    payload["skills"][1]["prerequisites"] = ["add_sub"]  # higher-level prerequisite
    tree = SkillTree.from_payload(payload)

    with pytest.raises(SkillTreeValidationError) as exc:
        validate_skill_tree(tree)

    assert "higher level" in str(exc.value)


def test_validate_skill_tree_detects_duplicate_ids():
    payload = _sample_payload()
    payload["skills"].append(
        {"id": "nat_num", "name": "Duplicate", "level": 1, "prerequisites": []}
    )
    tree = SkillTree.from_payload(payload)

    with pytest.raises(SkillTreeValidationError) as exc:
        validate_skill_tree(tree)

    assert "Duplicate skill id" in str(exc.value)


def test_validate_skill_tree_rejects_empty_filtered_view():
    tree = SkillTree.from_payload(_sample_payload())

    with pytest.raises(SkillTreeValidationError) as exc:
        validate_skill_tree(tree, max_level=0)

    assert "No skills available" in str(exc.value)


def test_to_mermaid_respects_level_filter():
    tree = SkillTree.from_payload(_sample_payload())

    mermaid = to_mermaid(tree, max_level=2)

    assert "fractions" not in mermaid
    assert "mul_div" not in mermaid
    assert "nat_num" in mermaid and "int_num" in mermaid
    assert "nat_num --> int_num" in mermaid


def test_load_skill_tree_reads_file(tmp_path: Path):
    payload_path = tmp_path / "tree.json"
    payload_path.write_text(json.dumps(_sample_payload()), encoding="utf-8")

    tree = load_skill_tree(payload_path)

    assert tree.tree_id == "math_basic"
    assert len(tree.skills) == 5


def test_load_skill_tree_rejects_missing_file(tmp_path: Path):
    with pytest.raises(SkillTreeParseError):
        load_skill_tree(tmp_path / "missing.json")


def test_load_skill_tree_handles_mermaid(tmp_path: Path):
    mermaid_path = tmp_path / "tree.mmd"
    mermaid_path.write_text(
        """```mermaid
graph LR
  A["A label (L1)"]
  B["B label (L2)"]
  A --> B
```""",
        encoding="utf-8",
    )

    tree = _load_skill_tree_flexible(mermaid_path)

    assert {skill.id for skill in tree.skills} == {"A", "B"}
    assert any(skill.id == "B" and "A" in skill.prerequisites for skill in tree.skills)


def test_load_skill_tree_handles_nodes_payload(tmp_path: Path):
    payload_path = tmp_path / "nodes.json"
    payload_path.write_text(
        json.dumps(
            {
                "version": "v1",
                "nodes": [
                    {"id": "A", "label": "Node A", "tier": 1},
                    {"id": "B", "label": "Node B", "tier": 2, "requires": {"all_of": ["A"]}},
                    {"id": "C", "label": "Course", "type": "course_step", "tier": 1},
                ],
            }
        ),
        encoding="utf-8",
    )

    tree = _load_skill_tree_flexible(payload_path)

    assert {skill.id for skill in tree.skills} == {"A", "B"}
    assert any(skill.id == "B" and "A" in skill.prerequisites for skill in tree.skills)
