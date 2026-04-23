from __future__ import annotations

import sqlite3
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tools.problem_bank_ingest import normalize_bundle, upload_bundle_to_db  # noqa: E402


def test_normalize_bundle_supports_aliases_and_label_mappings() -> None:
    raw = {
        "weekKey": "2026-W15",
        "dayKey": "Tue",
        "title": "분수와 소수",
        "description": "alias normalization test",
        "commonLabelKeys": ["frac_decimal_mix"],
        "labelDefinitions": [
            {
                "key": "frac_decimal_mix",
                "label": "분수-소수 혼합",
            }
        ],
        "problems": [
            {
                "stem": "0.5와 같은 분수는?",
                "choices": ["1/4", "1/2", "2/3"],
                "answerKey": "B",
            },
            {
                "prompt": "3/10을 소수로 쓰세요.",
                "problemType": "short_answer",
                "solution": "0.3",
                "labels": ["review"],
            },
        ],
    }

    normalized = normalize_bundle(raw)

    assert normalized["weekKey"] == "2026-W15"
    assert normalized["dayKey"] == "tue"
    assert normalized["expectedProblemCount"] == 2
    assert normalized["payload"]["problems"][0]["type"] == "objective"
    assert normalized["payload"]["problems"][0]["answer"] == "1/2"
    assert normalized["payload"]["problems"][1]["type"] == "subjective"
    assert normalized["payload"]["problems"][1]["answer"] == "0.3"
    assert normalized["problemLabels"] == [
        {"orderIndex": 1, "labelKeys": ["frac_decimal_mix"]},
        {"orderIndex": 2, "labelKeys": ["frac_decimal_mix", "review"]},
    ]


def test_upload_bundle_to_db_imports_problems_and_applies_labels(tmp_path: Path) -> None:
    db_path = tmp_path / "app.db"
    raw = {
        "weekKey": "2026-W16",
        "dayKey": "fri",
        "title": "로그 연습",
        "description": "db upload test",
        "labelDefinitions": [
            {"key": "log_review", "label": "로그-복습", "kind": "custom"},
            {"key": "objective_set", "label": "객관식 세트", "kind": "custom"},
        ],
        "commonLabelKeys": ["objective_set"],
        "problems": [
            {
                "question": "log_2 8의 값은?",
                "type": "objective",
                "options": ["2", "3", "4"],
                "answer": "3",
                "labelKeys": ["log_review"],
            },
            {
                "question": "log_3 9의 값은?",
                "type": "objective",
                "options": ["1", "2", "3"],
                "answerIndex": 2,
            },
        ],
    }

    bundle = normalize_bundle(raw)
    first = upload_bundle_to_db(bundle, db_path=db_path, imported_by_override="pytest")
    second = upload_bundle_to_db(bundle, db_path=db_path, imported_by_override="pytest")

    assert first["createdProblemCount"] == 2
    assert first["appliedProblemLabelCount"] == 2
    assert second["createdProblemCount"] == 0
    assert second["skippedProblemCount"] == 2

    conn = sqlite3.connect(db_path)
    try:
        problem_rows = conn.execute(
            "SELECT day_key, order_index, question FROM homework_problems ORDER BY order_index ASC"
        ).fetchall()
        label_rows = conn.execute(
            "SELECT key FROM homework_labels ORDER BY key ASC"
        ).fetchall()
        link_rows = conn.execute(
            """
            SELECT hp.order_index, hl.key
            FROM homework_problem_labels hpl
            INNER JOIN homework_problems hp ON hp.id = hpl.problem_id
            INNER JOIN homework_labels hl ON hl.id = hpl.label_id
            ORDER BY hp.order_index ASC, hl.key ASC
            """
        ).fetchall()
    finally:
        conn.close()

    assert [row[0] for row in problem_rows] == ["fri", "fri"]
    assert [row[2] for row in problem_rows] == ["log_2 8의 값은?", "log_3 9의 값은?"]
    assert [row[0] for row in label_rows] == ["log_review", "objective_set"]
    assert link_rows == [
        (1, "log_review"),
        (1, "objective_set"),
        (2, "objective_set"),
    ]
