from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.db import (
    create_homework_label,
    import_homework_problem_batch,
    list_homework_problem_ids_for_batch,
    list_homework_problems_admin,
    set_homework_problem_labels,
)


def test_problem_bank_label_linking_and_filtering(
    client: tuple[TestClient, Any],
) -> None:
    _test_client, db_path = client

    payload = {
        "title": "t",
        "problems": [
            {"type": "subjective", "question": "Q1", "answer": "A"},
            {
                "type": "objective",
                "question": "Q2",
                "options": ["A", "B"],
                "answer": "A",
            },
        ],
    }
    imported = import_homework_problem_batch(
        week_key="2026-W04",
        day_key="mon",
        payload=payload,
        imported_by="admin",
        expected_problem_count=2,
        path=Path(db_path),
    )
    batch_id = imported["batchId"]
    problem_ids = list_homework_problem_ids_for_batch(batch_id, path=Path(db_path))
    assert len(problem_ids) == 2

    label = create_homework_label(
        key="divide_basic",
        label="나눗셈-기초",
        kind="preset",
        created_by="admin",
        path=Path(db_path),
    )
    assert label["key"] == "divide_basic"

    set_homework_problem_labels(
        problem_id=problem_ids[0],
        label_keys=["divide_basic"],
        path=Path(db_path),
    )

    filtered = list_homework_problems_admin(
        label_key="divide_basic",
        path=Path(db_path),
    )
    assert len(filtered) == 1
    assert filtered[0]["id"] == problem_ids[0]


def test_set_labels_rejects_unknown_label_keys(client: tuple[TestClient, Any]) -> None:
    _test_client, db_path = client

    payload = {
        "title": "t",
        "problems": [{"type": "subjective", "question": "Q1"}],
    }
    imported = import_homework_problem_batch(
        week_key="2026-W04",
        day_key="mon",
        payload=payload,
        imported_by="admin",
        expected_problem_count=1,
        path=Path(db_path),
    )
    problem_id = list_homework_problem_ids_for_batch(
        imported["batchId"], path=Path(db_path)
    )[0]

    with pytest.raises(ValueError, match="Unknown label"):
        set_homework_problem_labels(
            problem_id=problem_id,
            label_keys=["nope"],
            path=Path(db_path),
        )
