"""Utilities for applying course-step progress updates."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Iterable, List

from app.schemas.bipartite import (
    AtomicSkillNode,
    CourseStepNode,
    EdgeType,
    GraphEdge,
)
from app.progress_store import ProgressSnapshot, NodeProgress, SkillProgress


class SkillProgressService:
    """Applies XP and level changes based on course completions."""

    def __init__(
        self,
        course_steps: Iterable[CourseStepNode],
        atomic_skills: Iterable[AtomicSkillNode],
        edges: Iterable[GraphEdge],
    ) -> None:
        self.course_map: Dict[str, CourseStepNode] = {node.id: node for node in course_steps}
        self.skill_map: Dict[str, AtomicSkillNode] = {node.id: node for node in atomic_skills}
        self.teaches_map: Dict[str, List[GraphEdge]] = {}

        for edge in edges:
            if edge.type is EdgeType.TEACHES:
                self.teaches_map.setdefault(edge.from_, []).append(edge)

    def apply_course_attempt(
        self,
        snapshot: ProgressSnapshot,
        course_step_id: str,
        *,
        correct: bool,
    ) -> int:
        course = self.course_map.get(course_step_id)
        if course is None:
            raise ValueError(f"Unknown course step '{course_step_id}'")

        reward = course.xp.per_correct if correct else course.xp.per_try
        node_progress = snapshot.nodes.get(course_step_id)
        if node_progress is None:
            node_progress = NodeProgress(
                xp_earned=0,
                xp_required=course.xp.per_correct * 5 if course.xp.per_correct else None,
                level=0,
                unlocked=True,
                completed=False,
                lrc_status="pending",
                lrc_metrics={},
                attempts=0,
            )
            snapshot.nodes[course_step_id] = node_progress

        node_progress.unlocked = True
        node_progress.xp_earned += reward
        node_progress.attempts = (node_progress.attempts or 0) + 1

        if node_progress.xp_required is not None and node_progress.xp_earned >= node_progress.xp_required:
            node_progress.completed = True
            node_progress.level = (node_progress.level or 0) + 1
            node_progress.xp_required += course.xp.per_correct * 5 if course.xp.per_correct else 0

        snapshot.total_xp += reward
        snapshot.updated_at = datetime.now(tz=timezone.utc)

        for teach_edge in self.teaches_map.get(course_step_id, []):
            self._apply_teach_edge(snapshot, teach_edge.to, teach_edge.delta_level or 0, correct)

        return reward

    def _apply_teach_edge(
        self,
        snapshot: ProgressSnapshot,
        skill_id: str,
        delta_level: int,
        correct: bool,
    ) -> None:
        skill = self.skill_map.get(skill_id)
        if skill is None:
            return

        reward = skill.xp_per_correct if correct else skill.xp_per_try
        skill_progress = snapshot.skills.get(skill_id)
        if skill_progress is None:
            skill_progress = SkillProgress(level=0, xp=0)
            snapshot.skills[skill_id] = skill_progress

        skill_progress.xp += reward
        if correct and delta_level > 0:
            skill_progress.level = min(skill.levels, skill_progress.level + delta_level)

        snapshot.total_xp += reward
        snapshot.updated_at = datetime.now(tz=timezone.utc)


__all__ = ["SkillProgressService"]
