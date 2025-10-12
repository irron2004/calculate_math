"""Services for aggregating personalised progress metrics for learners."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Iterable

from pydantic import BaseModel, Field

from ..progress_store import ProgressSnapshot, ProgressStore
from ..repositories import AttemptRecord, AttemptRepository


def _normalise_date(value: datetime) -> date:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).date()


def _compute_streak_days(attempts: Iterable[AttemptRecord]) -> int:
    dates = sorted({_normalise_date(attempt.attempted_at) for attempt in attempts}, reverse=True)
    if not dates:
        return 0

    today = datetime.now(timezone.utc).date()
    streak = 0
    expected = today

    for attempt_date in dates:
        if attempt_date > expected:
            continue
        if (expected - attempt_date) > timedelta(days=1):
            break
        streak += 1
        expected = attempt_date - timedelta(days=1)

    return streak


class AttemptMetrics(BaseModel):
    """Attempt based metrics derived from the practice repository."""

    total: int = Field(0, description="총 풀이 시도 수")
    correct: int = Field(0, description="정답으로 제출된 횟수")
    accuracy_rate: float = Field(0.0, description="정답률 (0-100)")
    streak_days: int = Field(0, description="연속 학습 일수")
    last_attempt_at: datetime | None = Field(
        default=None, description="마지막으로 문제를 푼 시각"
    )


class ProgressBreakdown(BaseModel):
    """Aggregated curriculum metrics from the DAG progress snapshot."""

    total_xp: int = Field(0, description="누적 경험치")
    unlocked_nodes: int = Field(0, description="활성화된 커리큘럼 노드 수")
    completed_nodes: int = Field(0, description="완료된 커리큘럼 노드 수")
    mastered_skills: int = Field(0, description="숙련 단계에 도달한 스킬 수")


class UserProgressMetrics(BaseModel):
    """Combined personalised progress metrics for a learner."""

    user_id: str
    attempts: AttemptMetrics
    progress: ProgressBreakdown
    skill_levels: dict[str, int] = Field(default_factory=dict)


@dataclass
class ProgressMetricsService:
    """Aggregate per-user metrics from problem attempts and DAG progress."""

    attempt_repository: AttemptRepository
    progress_store: ProgressStore

    def get_metrics_for_user(self, user_id: str | int) -> UserProgressMetrics:
        user_key = str(user_id)
        attempts = self.attempt_repository.list_attempts(user_id=user_key)
        attempt_metrics = self._build_attempt_metrics(attempts)
        snapshot = self.progress_store.get_snapshot(user_key)
        progress_metrics = self._build_progress_metrics(snapshot)
        skill_levels = {skill_id: progress.level for skill_id, progress in snapshot.skills.items()}
        return UserProgressMetrics(
            user_id=user_key,
            attempts=attempt_metrics,
            progress=progress_metrics,
            skill_levels=skill_levels,
        )

    def _build_attempt_metrics(self, attempts: list[AttemptRecord]) -> AttemptMetrics:
        total = len(attempts)
        correct = sum(1 for attempt in attempts if attempt.is_correct)
        accuracy = (correct / total * 100.0) if total else 0.0
        last_attempt = max((attempt.attempted_at for attempt in attempts), default=None)
        streak_days = _compute_streak_days(attempts)
        return AttemptMetrics(
            total=total,
            correct=correct,
            accuracy_rate=round(accuracy, 2),
            streak_days=streak_days,
            last_attempt_at=last_attempt,
        )

    def _build_progress_metrics(self, snapshot: ProgressSnapshot) -> ProgressBreakdown:
        unlocked_nodes = sum(1 for node in snapshot.nodes.values() if node.unlocked)
        completed_nodes = sum(1 for node in snapshot.nodes.values() if node.completed)
        mastered_skills = sum(1 for skill in snapshot.skills.values() if skill.level >= 3)
        return ProgressBreakdown(
            total_xp=snapshot.total_xp,
            unlocked_nodes=unlocked_nodes,
            completed_nodes=completed_nodes,
            mastered_skills=mastered_skills,
        )


__all__ = [
    "AttemptMetrics",
    "ProgressBreakdown",
    "ProgressMetricsService",
    "UserProgressMetrics",
]

