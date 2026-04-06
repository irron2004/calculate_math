from __future__ import annotations

from pathlib import Path
from typing import Any

from app.db import (
    backfill_homework_label_structures,
    create_homework_label,
)


def test_homework_label_backfill_dry_run_counts_only_hwset_labels(
    client: tuple[Any, Path],
) -> None:
    _test_client, db_path = client

    create_homework_label(
        key="hwset-high-2-exponential-inequality",
        label="고2 지수부등식",
        kind="preset",
        created_by="pytest",
        path=Path(db_path),
    )
    create_homework_label(
        key="source-0372",
        label="원본 0372",
        kind="custom",
        created_by="pytest",
        path=Path(db_path),
    )

    result = backfill_homework_label_structures(path=Path(db_path), dry_run=True)

    assert result == {
        "scanned": 2,
        "created": 1,
        "skipped": 1,
        "mapped": 1,
        "proposed": 0,
        "unmapped": 0,
    }


def test_homework_label_backfill_actual_run_creates_structure_and_event(
    client: tuple[Any, Path],
) -> None:
    _test_client, db_path = client

    label = create_homework_label(
        key="hwset-high-2-logarithm",
        label="고2 로그",
        kind="preset",
        created_by="pytest",
        path=Path(db_path),
    )

    result = backfill_homework_label_structures(path=Path(db_path), dry_run=False)

    assert result == {
        "scanned": 1,
        "created": 1,
        "skipped": 0,
        "mapped": 1,
        "proposed": 0,
        "unmapped": 0,
    }

    import sqlite3

    conn = sqlite3.connect(db_path)
    try:
        structure = conn.execute(
            "SELECT label_slug, source_key, mapping_status FROM homework_label_structures WHERE label_id = ?",
            (label["id"],),
        ).fetchone()
        event = conn.execute(
            "SELECT event_type, actor_id, to_status FROM homework_label_mapping_events WHERE label_id = ?",
            (label["id"],),
        ).fetchone()
    finally:
        conn.close()

    assert structure == (
        "high-2-logarithm",
        "hwset-high-2-logarithm",
        "mapped",
    )
    assert event == (
        "backfilled",
        "backfill_homework_label_structures",
        "mapped",
    )
