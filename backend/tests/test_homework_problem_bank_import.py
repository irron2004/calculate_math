from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.db import import_homework_problem_batch


def test_import_is_idempotent_and_preserves_order(
    client: tuple[TestClient, Any],
) -> None:
    _test_client, db_path = client

    payload = {
        "title": "응용 나눗셈 변형 (월요일)",
        "description": "테스트",
        "problems": [
            {
                "type": "subjective",
                "question": "월-1) Q1",
                "answer": "7",
            },
            {
                "type": "objective",
                "question": "월-2) Q2",
                "options": ["6개", "7개", "8개"],
                "answer": "7개",
            },
        ],
    }

    first = import_homework_problem_batch(
        week_key="2026-W04",
        day_key="mon",
        payload=payload,
        imported_by="admin",
        expected_problem_count=2,
        path=Path(db_path),
    )

    second = import_homework_problem_batch(
        week_key="2026-W04",
        day_key="mon",
        payload=payload,
        imported_by="admin",
        expected_problem_count=2,
        path=Path(db_path),
    )

    assert first["batchId"] == second["batchId"]
    assert first["createdProblemCount"] == 2
    assert second["createdProblemCount"] == 0

    conn = sqlite3.connect(Path(db_path))
    try:
        rows = conn.execute(
            "SELECT order_index, question FROM homework_problems WHERE batch_id = ? ORDER BY order_index ASC",
            (first["batchId"],),
        ).fetchall()
    finally:
        conn.close()

    assert [r[1] for r in rows] == ["월-1) Q1", "월-2) Q2"]
