import os
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


def test_study_sessions_table_exists(db):
    cur = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='study_sessions'"
    )
    assert cur.fetchone() is not None


def test_study_responses_table_exists(db):
    cur = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='study_responses'"
    )
    assert cur.fetchone() is not None


def test_insert_study_session(db):
    now = datetime.now(timezone.utc).isoformat()
    session_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO study_sessions (id, user_id, node_id, status, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?)",
        (session_id, "user1", "node1", "DRAFT", now, now),
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM study_sessions WHERE id=?", (session_id,)
    ).fetchone()
    assert row is not None
    assert row["status"] == "DRAFT"
    assert row["grading_json"] is None


def test_insert_study_response(db):
    now = datetime.now(timezone.utc).isoformat()
    session_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO study_sessions (id, user_id, node_id, status, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?)",
        (session_id, "user1", "node1", "SUBMITTED", now, now),
    )
    response_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO study_responses (id, session_id, problem_id, input_raw, created_at) "
        "VALUES (?,?,?,?,?)",
        (response_id, session_id, "prob1", "42", now),
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM study_responses WHERE id=?", (response_id,)
    ).fetchone()
    assert row is not None
    assert row["input_raw"] == "42"
    assert row["is_correct"] is None
