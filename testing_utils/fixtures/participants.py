"""Reusable participant fixtures for MBTI self/other flows."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List

MBTI_ARCADE_ROOT = Path(__file__).resolve().parents[2] / "mbti-arcade"
if str(MBTI_ARCADE_ROOT) not in sys.path:
    sys.path.append(str(MBTI_ARCADE_ROOT))

from app.data.questions import questions_for_mode  # noqa: E402


def build_fake_answers(mode: str = "basic") -> List[dict[str, int]]:
    """Return deterministic 32문항 답변 세트 (1~5 반복 패턴)."""

    answers: list[dict[str, int]] = []
    for idx, payload in enumerate(questions_for_mode(mode)):
        value = (idx % 5) + 1
        answers.append({"question_id": int(payload["id"]), "value": value})
    return answers


FAKE_PARTICIPANT_PREVIEW = {
    "participant_id": 101,
    "self_type": "ESTJ",
    "your_view_type": "ISTP",
    "diff_axes": [
        {"axis": "EI", "self": 0.72, "other": -0.41},
        {"axis": "SN", "self": 0.35, "other": -0.22},
        {"axis": "TF", "self": 0.58, "other": -0.05},
        {"axis": "JP", "self": 0.63, "other": -0.49},
    ],
    "short_tips": [
        "요약 1줄 + 선택지 2개로 큰 그림/세부 균형 맞추기",
        "결정 전 3분 의견 모으기 타임으로 I/P 준비 시간 제공",
        "주간 계획은 앵커 3개 + 자유 슬롯 2개로 합의",
    ],
    "generated_at": datetime.now(timezone.utc).isoformat(),
}
# QA 계약 테스트에서 사용되는 미리보기 스냅샷.
