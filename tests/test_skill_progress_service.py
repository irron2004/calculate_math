import json
from pathlib import Path

import pytest

from app.progress_store import ProgressSnapshot
from app.schemas.bipartite import CourseStepNode, AtomicSkillNode, GraphEdge, EdgeType, XPReward
from app.services.skill_progress import SkillProgressService


@pytest.fixture
def sample_course() -> CourseStepNode:
    return CourseStepNode(
        type="course_step",
        id="C01-S1",
        label="Course 1",
        tier=1,
        lens=["transform"],
        misconceptions=[],
        xp=XPReward(per_try=5, per_correct=10),
    )


@pytest.fixture
def sample_skill() -> AtomicSkillNode:
    return AtomicSkillNode(
        type="skill",
        id="AS.PV.DECOMP",
        label="Decompose",
        domain="math",
        lens=["transform"],
        levels=3,
        xp_per_try=1,
        xp_per_correct=2,
    )


def test_apply_course_attempt_awards_xp(sample_course, sample_skill):
    service = SkillProgressService(
        course_steps=[sample_course],
        atomic_skills=[sample_skill],
        edges=[
            GraphEdge(from_=sample_course.id, to=sample_skill.id, type=EdgeType.TEACHES, delta_level=1)
        ],
    )

    snapshot = ProgressSnapshot(user_id="user", updated_at="2024-01-01T00:00:00+00:00")

    reward = service.apply_course_attempt(snapshot, sample_course.id, correct=True)

    assert reward == sample_course.xp.per_correct
    node_progress = snapshot.nodes[sample_course.id]
    assert node_progress.xp_earned == sample_course.xp.per_correct
    skill_progress = snapshot.skills[sample_skill.id]
    assert skill_progress.level == 1
    assert skill_progress.xp == sample_skill.xp_per_correct
    assert snapshot.total_xp == sample_course.xp.per_correct + sample_skill.xp_per_correct
