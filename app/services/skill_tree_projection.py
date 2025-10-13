"""Projection helpers for transforming the bipartite skill graph into a UI-ready tree."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Sequence

from ..bipartite_loader import get_atomic_skills, get_bipartite_graph, get_course_steps
from ..schemas.bipartite import (
    AtomicSkillNode,
    BipartiteGraphSpec,
    CourseStepNode,
    EdgeType,
    GraphEdge,
)


COURSE_GROUP_DEFINITIONS: Sequence[dict[str, Any]] = (
    {
        "id": "arithmetic",
        "label": "수·연산",
        "order": 1,
        "course_ids": {"C01", "C02", "C03", "C04"},
    },
    {
        "id": "fraction_ratio",
        "label": "분수·소수·비율",
        "order": 2,
        "course_ids": {"C05", "C06"},
    },
    {
        "id": "patterns_geometry_stats",
        "label": "규칙·좌표·기하·통계",
        "order": 3,
        "course_ids": {"C07", "C08", "C09", "C10", "C11", "C12"},
    },
)


DOMAIN_NORMALISATION_MAP: Mapping[str, str] = {
    "분수:": "분수",
    "단위율(1의": "단위율(1의 값)",
    "산포(범위/표준편차": "산포(범위/표준편차)",
}


def _normalise_domain(domain: str) -> str:
    """Clean up slightly malformed domain strings in the dataset."""

    cleaned = DOMAIN_NORMALISATION_MAP.get(domain, domain)
    if cleaned.endswith(":"):
        cleaned = cleaned.rstrip(":")
    if cleaned.endswith("("):
        cleaned = cleaned.rstrip("(")
    return cleaned


def _build_course_group_map(course_ids: Iterable[str]) -> tuple[List[dict[str, Any]], Dict[str, str]]:
    """Return ordered group definitions and lookup mapping for course ids."""

    course_to_group: Dict[str, str] = {}
    groups: List[dict[str, Any]] = []

    covered: set[str] = set()
    for definition in COURSE_GROUP_DEFINITIONS:
        courses = sorted(cid for cid in definition["course_ids"] if cid in course_ids)
        if not courses:
            continue
        groups.append(
            {
                "id": definition["id"],
                "label": definition["label"],
                "order": definition["order"],
                "course_ids": courses,
            }
        )
        course_to_group.update({cid: definition["id"] for cid in courses})
        covered.update(courses)

    # Any course id not covered by the curated mapping falls back to "general".
    remaining = sorted(set(course_ids) - covered)
    if remaining:
        groups.append(
            {
                "id": "general",
                "label": "기타",
                "order": len(groups) + 1,
                "course_ids": remaining,
            }
        )
        course_to_group.update({cid: "general" for cid in remaining})

    groups.sort(key=lambda item: item["order"])
    return groups, course_to_group


@dataclass(frozen=True)
class SkillRequirement:
    skill_id: str
    min_level: int
    label: str
    domain: str
    lens: List[str]
    current_level: int

    @property
    def met(self) -> bool:
        return self.current_level >= self.min_level


@dataclass(frozen=True)
class SkillTeaching:
    skill_id: str
    delta_level: int
    label: str
    domain: str
    lens: List[str]


def _collect_edges_by_target(edges: Sequence[GraphEdge]) -> dict[str, list[GraphEdge]]:
    payload: dict[str, list[GraphEdge]] = defaultdict(list)
    for edge in edges:
        payload[edge.to].append(edge)
    return payload


def _collect_edges_by_source(edges: Sequence[GraphEdge]) -> dict[str, list[GraphEdge]]:
    payload: dict[str, list[GraphEdge]] = defaultdict(list)
    for edge in edges:
        payload[edge.from_].append(edge)
    return payload


def build_skill_tree_projection(
    *,
    graph: BipartiteGraphSpec | None = None,
    node_progress: Mapping[str, Mapping[str, Any]],
    skill_progress: Mapping[str, Mapping[str, Any]],
) -> dict[str, Any]:
    """Project the bipartite graph into a grouped, tiered structure consumable by the UI."""

    spec = graph or get_bipartite_graph()
    course_steps: List[CourseStepNode] = list(get_course_steps()) if graph is None else [
        node for node in spec.nodes if isinstance(node, CourseStepNode)
    ]
    atomic_skills: List[AtomicSkillNode] = list(get_atomic_skills()) if graph is None else [
        node for node in spec.nodes if isinstance(node, AtomicSkillNode)
    ]

    skill_lookup: Dict[str, AtomicSkillNode] = {skill.id: skill for skill in atomic_skills}
    course_lookup: Dict[str, CourseStepNode] = {course.id: course for course in course_steps}

    requires_edges = _collect_edges_by_target(
        [edge for edge in spec.edges if edge.type is EdgeType.REQUIRES]
    )
    teaches_edges = _collect_edges_by_source(
        [edge for edge in spec.edges if edge.type is EdgeType.TEACHES]
    )
    enables_edges = [
        edge
        for edge in spec.edges
        if edge.type is EdgeType.ENABLES
        and edge.from_ in course_lookup
        and edge.to in course_lookup
    ]

    groups, course_to_group = _build_course_group_map(course_lookup.keys())

    nodes_payload: List[dict[str, Any]] = []
    for course in sorted(course_steps, key=lambda item: (item.tier, item.id)):
        course_id = course.id.split("-")[0]
        group_id = course_to_group.get(course_id, "general")
        course_progress = dict(node_progress.get(course.id, {}))

        requires: List[SkillRequirement] = []
        for edge in sorted(requires_edges.get(course.id, []), key=lambda item: item.from_):
            skill = skill_lookup.get(edge.from_)
            if skill is None:
                continue
            progress_entry = skill_progress.get(skill.id, {})
            requires.append(
                SkillRequirement(
                    skill_id=skill.id,
                    min_level=edge.min_level or 0,
                    label=skill.label,
                    domain=_normalise_domain(skill.domain),
                    lens=list(skill.lens),
                    current_level=int(progress_entry.get("level", 0)),
                )
            )

        teaches: List[SkillTeaching] = []
        for edge in sorted(teaches_edges.get(course.id, []), key=lambda item: item.to):
            skill = skill_lookup.get(edge.to)
            if skill is None:
                continue
            teaches.append(
                SkillTeaching(
                    skill_id=skill.id,
                    delta_level=edge.delta_level or 0,
                    label=skill.label,
                    domain=_normalise_domain(skill.domain),
                    lens=list(skill.lens),
                )
            )

        all_met = all(requirement.met for requirement in requires)
        completed = bool(course_progress.get("completed"))
        unlocked_flag = bool(course_progress.get("unlocked"))

        if completed:
            state = "completed"
        elif unlocked_flag or all_met:
            state = "available"
        else:
            state = "locked"

        first_lens = course.lens[0] if course.lens else None
        node_entry: dict[str, Any] = {
            "id": course.id,
            "label": course.label,
            "course": course_id,
            "group": group_id,
            "tier": course.tier,
            "lens": list(course.lens),
            "primary_color": spec.palette.get(first_lens) if first_lens else None,
            "session": course.session.model_dump(exclude_none=True) if course.session else None,
            "requires": [
                {
                    "skill_id": req.skill_id,
                    "label": req.label,
                    "domain": req.domain,
                    "lens": req.lens,
                    "min_level": req.min_level,
                    "current_level": req.current_level,
                    "met": req.met,
                }
                for req in requires
            ],
            "teaches": [
                {
                    "skill_id": teach.skill_id,
                    "label": teach.label,
                    "domain": teach.domain,
                    "lens": teach.lens,
                    "delta_level": teach.delta_level,
                }
                for teach in teaches
            ],
            "xp": course.xp.model_dump(),
            "lrc_min": course.lrc_min or {},
            "misconceptions": list(course.misconceptions),
            "state": {
                "value": state,
                "completed": completed,
                "available": state in {"available", "completed"},
                "unlocked": unlocked_flag or all_met,
            },
            "progress": course_progress,
        }
        nodes_payload.append(node_entry)

    edges_payload = [
        {"from": edge.from_, "to": edge.to} for edge in sorted(enables_edges, key=lambda item: (item.from_, item.to))
    ]

    skills_payload: List[dict[str, Any]] = []
    for skill in sorted(atomic_skills, key=lambda item: item.id):
        progress_entry = dict(skill_progress.get(skill.id, {}))
        skills_payload.append(
            {
                "id": skill.id,
                "label": skill.label,
                "domain": _normalise_domain(skill.domain),
                "lens": list(skill.lens),
                "levels": skill.levels,
                "xp": {
                    "per_try": skill.xp_per_try,
                    "per_correct": skill.xp_per_correct,
                    "earned": progress_entry.get("xp", 0),
                },
                "level": progress_entry.get("level", 0),
            }
        )

    return {
        "version": spec.version,
        "palette": dict(spec.palette),
        "groups": groups,
        "nodes": nodes_payload,
        "edges": edges_payload,
        "skills": skills_payload,
    }


__all__ = ["build_skill_tree_projection"]
