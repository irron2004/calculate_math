"""Typed representations of the curriculum skill DAG specification."""

from __future__ import annotations

from enum import Enum
from typing import Dict, Iterable, List, Optional, Set, Sequence

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class SkillKind(str, Enum):
    """Kinds of skills represented in the curriculum graph."""

    CORE = "core"
    CONCEPT = "concept"
    ALGEBRA = "algebra"
    CALCULUS = "calculus"
    STATISTICS = "statistics"
    BOSS = "boss"


class EdgeType(str, Enum):
    """Categorisation of edges within the skill DAG."""

    REQUIRES = "requires"
    ENABLES = "enables"

class RequirementSpec(BaseModel):
    """Prerequisite requirements for unlocking a skill."""

    all_of: List[str] = Field(default_factory=list)
    any_of: List[str] = Field(default_factory=list)
    min_level: Optional[int] = None

    @field_validator("min_level")
    def _check_min_level(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("min_level must be non-negative when provided")
        return value
class SkillNode(BaseModel):
    """A node within the curriculum DAG."""

    id: str
    label: str
    tier: int = Field(..., ge=1)
    kind: SkillKind
    requires: Optional[RequirementSpec] = None
    boss: Optional[str] = None
    xp_per_try: int = Field(..., ge=0)
    xp_per_correct: int = Field(..., ge=0)
    xp_to_level: List[int]
    lens: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    micro_skills: List[str] = Field(default_factory=list)
    misconceptions: List[str] = Field(default_factory=list)
    lrc_min: Optional[Dict[str, float]] = None

    @field_validator("xp_to_level")
    def _validate_xp_table(cls, value: List[int]) -> List[int]:
        if not value:
            raise ValueError("xp_to_level must contain at least one entry")
        if value[0] != 0:
            raise ValueError("xp_to_level must start at 0")
        if any(curr <= prev for prev, curr in zip(value, value[1:])):
            raise ValueError("xp_to_level entries must be strictly increasing")
        return value

    @field_validator("lens", "keywords", "micro_skills", "misconceptions", mode="before")
    def _ensure_list(
        cls, value: Optional[Iterable[str] | Sequence[str]]
    ) -> List[str]:
        if value is None:
            return []
        return list(value)
class SkillEdge(BaseModel):
    """A directional edge between two skills."""

    from_: str = Field(..., alias="from")
    to: str
    type: EdgeType
    lens: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)
class SkillGraphSpec(BaseModel):
    """Top-level representation of the curriculum skill DAG."""

    version: str
    palette: Dict[str, str]
    nodes: List[SkillNode]
    edges: List[SkillEdge]

    @field_validator("palette")
    def _validate_palette(cls, palette: Dict[str, str]) -> Dict[str, str]:
        for key, value in palette.items():
            if not value or not isinstance(value, str):
                raise ValueError(f"Palette colour for '{key}' must be a non-empty string")
            if not value.startswith("#") or len(value) not in (4, 7):
                raise ValueError(f"Palette colour '{value}' for '{key}' must be a hex string")
        return palette

    @model_validator(mode="after")
    def _cross_field_validation(self) -> "SkillGraphSpec":
        palette = self.palette
        nodes = self.nodes
        edges = self.edges

        node_ids: Set[str] = {node.id for node in nodes}
        palette_keys: Set[str] = set(palette)

        missing_lens: Set[str] = set()

        for node in nodes:
            if node.requires:
                self._validate_requirements(node, node_ids)
            if node.boss is not None and node.boss not in node_ids:
                raise ValueError(f"Node '{node.id}' references unknown boss '{node.boss}'")
            if node.kind is SkillKind.BOSS:
                self._validate_boss_node(node)

            missing_lens.update(set(node.lens) - palette_keys)

        for edge in edges:
            if edge.from_ not in node_ids:
                raise ValueError(f"Edge references unknown source '{edge.from_}'")
            if edge.to not in node_ids:
                raise ValueError(f"Edge references unknown target '{edge.to}'")
            if edge.lens is not None and edge.lens not in palette_keys:
                missing_lens.add(edge.lens)

        if missing_lens:
            raise ValueError(
                "Palette is missing definitions for lens keys: " + ", ".join(sorted(missing_lens))
            )

        return self

    @classmethod
    def _validate_requirements(cls, node: SkillNode, node_ids: Set[str]) -> None:
        requirements = node.requires
        assert requirements is not None  # nosec - guarded by caller
        invalid_ids = set(requirements.all_of) | set(requirements.any_of) - node_ids
        if invalid_ids:
            raise ValueError(
                f"Node '{node.id}' has requirements referencing unknown nodes: {sorted(invalid_ids)}"
            )

    @staticmethod
    def _validate_boss_node(node: SkillNode) -> None:
        if node.requires is not None:
            raise ValueError(f"Boss node '{node.id}' should not declare requirements")
        if node.xp_per_try != 0 or node.xp_per_correct != 0:
            raise ValueError(f"Boss node '{node.id}' must have zero XP rewards")
        if node.xp_to_level != [0]:
            raise ValueError(f"Boss node '{node.id}' must have a trivial XP table")


__all__ = [
    "EdgeType",
    "RequirementSpec",
    "SkillEdge",
    "SkillGraphSpec",
    "SkillKind",
    "SkillNode",
]
