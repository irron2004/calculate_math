from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient


def _table_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).fetchall()
    return {str(row[0]) for row in rows}


def test_problem_bank_tables_exist(client: tuple[TestClient, Any]) -> None:
    _test_client, db_path = client

    conn = sqlite3.connect(Path(db_path))
    try:
        tables = _table_names(conn)
    finally:
        conn.close()

    assert "homework_import_batches" in tables
    assert "homework_problems" in tables
    assert "homework_labels" in tables
    assert "homework_problem_labels" in tables
