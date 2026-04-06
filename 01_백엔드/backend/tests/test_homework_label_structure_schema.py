from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from app.db import create_homework_label


def test_homework_label_structure_tables_exist(client: tuple[Any, Path]) -> None:
    _test_client, db_path = client

    conn = sqlite3.connect(db_path)
    try:
        tables = {
            str(row[0])
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
            ).fetchall()
        }
    finally:
        conn.close()

    assert "homework_label_structures" in tables
    assert "homework_label_mapping_events" in tables


def test_homework_label_structure_and_event_tables_accept_registry_link(
    client: tuple[Any, Path],
) -> None:
    _test_client, db_path = client

    label = create_homework_label(
        key="hwset-high-2-exponential-inequality",
        label="고2 지수부등식",
        kind="preset",
        created_by="pytest",
        path=Path(db_path),
    )

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute(
            """
            INSERT INTO homework_label_structures (
                label_id,
                label_slug,
                school_level,
                grade,
                unit_id,
                unit_slug,
                concept_slug,
                difficulty,
                mapping_status,
                mapping_status_changed_at,
                mapped_at,
                source_key,
                source_label,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                label["id"],
                "high-2-exponential-inequality",
                "high",
                2,
                "UNIT-H2-EXP-INEQ",
                "exponential-inequality",
                "system-intersection",
                "mid",
                "mapped",
                "2026-04-06T05:00:00+00:00",
                "2026-04-06T05:00:00+00:00",
                label["key"],
                label["label"],
                "2026-04-06T05:00:00+00:00",
                "2026-04-06T05:00:00+00:00",
            ),
        )
        conn.execute(
            """
            INSERT INTO homework_label_mapping_events (
                id,
                label_id,
                from_status,
                to_status,
                event_type,
                unit_id_before,
                unit_id_after,
                unit_slug_before,
                unit_slug_after,
                actor_type,
                actor_id,
                note,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "event-1",
                label["id"],
                "proposed",
                "mapped",
                "mapped",
                None,
                "UNIT-H2-EXP-INEQ",
                None,
                "exponential-inequality",
                "system",
                "pytest",
                "initial mapping",
                "2026-04-06T05:00:01+00:00",
            ),
        )
        structure_row = conn.execute(
            "SELECT label_slug, unit_id, mapping_status FROM homework_label_structures WHERE label_id = ?",
            (label["id"],),
        ).fetchone()
        event_row = conn.execute(
            "SELECT event_type, to_status FROM homework_label_mapping_events WHERE label_id = ?",
            (label["id"],),
        ).fetchone()
    finally:
        conn.commit()
        conn.close()

    assert structure_row == (
        "high-2-exponential-inequality",
        "UNIT-H2-EXP-INEQ",
        "mapped",
    )
    assert event_row == ("mapped", "mapped")
