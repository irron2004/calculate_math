from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tools.problem_bank_weekly_text import build_bundles, parse_weekly_text  # noqa: E402
from tools.problem_bank_ingest import upload_bundle_to_db  # noqa: E402


SAMPLE_TEXT = """
월요일
1. 이차함수 y=x^2-4x+7의 최솟값은?
① 1 ② 2 ③ 3 ④ 4 ⑤ 5
2. 함수 |x^2-4|가 0≤x≤3에서 가질 때, 최댓값은?
① 4 ② 5 ③ 6 ④ 7 ⑤ 8

화요일
1. 이차함수 y=-(x-1)^2+2의 최댓값은?
① 0 ② 1 ③ 2 ④ 3 ⑤ 4

정답
*월요일*
1. ③
2. ②
*화요일*
1. ③
""".strip()


def test_parse_weekly_text_extracts_days_questions_and_answers() -> None:
    parsed = parse_weekly_text(SAMPLE_TEXT)

    assert sorted(parsed.keys()) == ["mon", "tue"]
    assert parsed["mon"][0]["question"] == "이차함수 y=x^2-4x+7의 최솟값은?"
    assert parsed["mon"][0]["options"] == ["1", "2", "3", "4", "5"]
    assert parsed["mon"][0]["answerIndex"] == 3
    assert parsed["mon"][1]["answerIndex"] == 2
    assert parsed["tue"][0]["answerIndex"] == 3


def test_build_bundles_and_upload_bundle_to_db(tmp_path: Path) -> None:
    parsed = parse_weekly_text(SAMPLE_TEXT)
    bundles = build_bundles(
        parsed,
        week_key="2026-W15",
        title_prefix="2차함수 최대·최소",
        imported_by="pytest-weekly-text",
        label_key="quadratic_extrema",
        label_name="2차함수 최대최소",
    )

    assert [day_key for day_key, _ in bundles] == ["mon", "tue"]
    mon_bundle = bundles[0][1]
    assert mon_bundle["payload"]["title"] == "2차함수 최대·최소 - 월요일"
    assert mon_bundle["payload"]["problems"][0]["answer"] == "3"

    db_path = tmp_path / "app.db"
    result = upload_bundle_to_db(mon_bundle, db_path=db_path)

    assert result["createdProblemCount"] == 2

    conn = sqlite3.connect(db_path)
    try:
        questions = conn.execute(
            "SELECT order_index, question, answer FROM homework_problems ORDER BY order_index ASC"
        ).fetchall()
        labels = conn.execute(
            "SELECT key FROM homework_labels ORDER BY key ASC"
        ).fetchall()
    finally:
        conn.close()

    assert questions == [
        (1, "이차함수 y=x^2-4x+7의 최솟값은?", "3"),
        (2, "함수 |x^2-4|가 0≤x≤3에서 가질 때, 최댓값은?", "5"),
    ]
    assert labels == [("quadratic_extrema",)]
