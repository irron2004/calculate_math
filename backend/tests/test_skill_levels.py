import os
import sqlite3
import tempfile
import uuid
from datetime import datetime, timezone

import pytest
from app.db import get_connection, init_db


@pytest.fixture
def db():
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        path = f.name
    conn = get_connection(path)
    init_db(conn)
    yield conn
    conn.close()
    os.unlink(path)


# ── Table schema tests ────────────────────────────────────────────────────────

def test_student_skill_levels_table_exists(db):
    tables = [
        r["name"]
        for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    ]
    assert "student_skill_levels" in tables


def test_student_skill_levels_primary_key(db):
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO student_skill_levels (user_id, skill_id, level, updated_at) VALUES (?,?,?,?)",
        ("u1", "AS.ADD_SUB", 1, now),
    )
    db.commit()
    with pytest.raises(Exception):
        db.execute(
            "INSERT INTO student_skill_levels (user_id, skill_id, level, updated_at) VALUES (?,?,?,?)",
            ("u1", "AS.ADD_SUB", 2, now),
        )
        db.commit()


def test_student_skill_levels_default_level(db):
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO student_skill_levels (user_id, skill_id, updated_at) VALUES (?,?,?)",
        ("u2", "AS.MUL_DIV", now),
    )
    db.commit()
    row = db.execute(
        "SELECT level FROM student_skill_levels WHERE user_id='u2' AND skill_id='AS.MUL_DIV'"
    ).fetchone()
    assert row["level"] == 0
