"""Schema definitions for the bipartite curriculum graph (course steps ↔ atomic skills)."""

from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional, Sequence, Union, Literal, Annotated

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class NodeType(str, Enum):
    """Discriminator for node variants in the bipartite graph."""

    COURSE_STEP = "course_step"
    SKILL = "skill"


class EdgeType(str, Enum):
    """Classification of edges within the bipartite graph."""

    REQUIRES = "requires"
    TEACHES = "teaches"
    ENABLES = "enables"


class XPReward(BaseModel):
    """XP reward configuration attached to a course step."""

    per_try: int = Field(..., ge=0)
    per_correct: int = Field(..., ge=0)


class AtomicSkillNode(BaseModel):
    """A reusable atomic skill that may be shared across multiple course steps."""

    type: Literal[NodeType.SKILL]  # discriminated union tag
    id: str
    label: str
    domain: str
    lens: List[str] = Field(default_factory=list)
    levels: int = Field(..., ge=1)
    xp_per_try: int = Field(..., ge=0)
    xp_per_correct: int = Field(..., ge=0)

    @field_validator("lens", mode="before")
    def _normalize_lens(cls, value: Optional[Sequence[str]]) -> List[str]:
        if value is None:
            return []
        return list(value)


class CourseStepNode(BaseModel):
    """A course step describing a concrete learning session."""

    type: Literal[NodeType.COURSE_STEP]
    id: str
    label: str
    tier: int = Field(..., ge=1)
    lens: List[str] = Field(default_factory=list)
    misconceptions: List[str] = Field(default_factory=list)
    xp: XPReward
    lrc_min: Optional[Dict[str, float]] = None

    @field_validator("lens", "misconceptions", mode="before")
    def _normalize_sequence(
        cls, value: Optional[Sequence[str]]
    ) -> List[str]:
        if value is None:
            return []
        return list(value)


NodeSpec = Annotated[Union[AtomicSkillNode, CourseStepNode], Field(discriminator="type")]


class GraphEdge(BaseModel):
    """Directed edge connecting atomic skills and course steps."""

    from_: str = Field(..., alias="from")
    to: str
    type: EdgeType
    min_level: Optional[int] = None
    delta_level: Optional[int] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def _validate_payload(self) -> "GraphEdge":
        if self.type is EdgeType.REQUIRES:
            if self.min_level is None:
                raise ValueError("requires edges must define min_level")
            if self.min_level < 0:
                raise ValueError("requires edge min_level must be non-negative")
            if self.delta_level is not None:
                raise ValueError("requires edges cannot define delta_level")
        elif self.type is EdgeType.TEACHES:
            if self.delta_level is None:
                raise ValueError("teaches edges must define delta_level")
            if self.delta_level <= 0:
                raise ValueError("teaches edge delta_level must be positive")
            if self.min_level is not None:
                raise ValueError("teaches edges cannot define min_level")
        else:  # EdgeType.ENABLES
            if self.min_level is not None or self.delta_level is not None:
                raise ValueError("enables edges cannot define min_level or delta_level")
        return self


class BipartiteGraphSpec(BaseModel):
    """Top-level representation of the course-step ↔ atomic-skill graph."""

    version: str
    palette: Dict[str, str]
    nodes: List[NodeSpec]
    edges: List[GraphEdge]

    @field_validator("palette")
    def _validate_palette(cls, palette: Dict[str, str]) -> Dict[str, str]:
        for key, value in palette.items():
            if not value or not isinstance(value, str):
                raise ValueError(f"Palette colour for '{key}' must be a non-empty string")
            if not value.startswith("#") or len(value) not in (4, 7):
                raise ValueError(f"Palette colour '{value}' for '{key}' must be a hex string")
        return palette

    @model_validator(mode="after")
    def _xfield_checks(self) -> "BipartiteGraphSpec":
        node_ids = {node.id for node in self.nodes}
        palette_keys = set(self.palette)
        missing_lens: set[str] = set()

        for node in self.nodes:
            missing_lens.update(set(node.lens) - palette_keys)
            if isinstance(node, CourseStepNode) and node.lrc_min:
                negative = [k for k, v in node.lrc_min.items() if v < 0 or v > 1]
                if negative:
                    raise ValueError(
                        f"Course step '{node.id}' has invalid lrc_min values for {negative}"
                    )

        for edge in self.edges:
            if edge.from_ not in node_ids:
                raise ValueError(f"Edge references unknown source '{edge.from_}'")
            if edge.to not in node_ids:
                raise ValueError(f"Edge references unknown target '{edge.to}'")

        if missing_lens:
            raise ValueError(
                "Palette is missing definitions for lens keys: " + ", ".join(sorted(missing_lens))
            )

        return self


__all__ = [
    "AtomicSkillNode",
    "BipartiteGraphSpec",
    "CourseStepNode",
    "EdgeType",
    "GraphEdge",
    "NodeSpec",
    "NodeType",
    "XPReward",
]

