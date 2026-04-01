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


def test_study_sessions_has_diagnosis_json_column(db):
    cur = db.execute("PRAGMA table_info(study_sessions)")
    columns = [row["name"] for row in cur.fetchall()]
    assert "diagnosis_json" in columns


def test_diagnosis_json_nullable(db):
    now = datetime.now(timezone.utc).isoformat()
    session_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO study_sessions (id, user_id, node_id, status, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?)",
        (session_id, "u1", "n1", "DRAFT", now, now),
    )
    db.commit()
    row = db.execute(
        "SELECT diagnosis_json FROM study_sessions WHERE id=?", (session_id,)
    ).fetchone()
    assert row is not None
    assert row["diagnosis_json"] is None


def test_diagnosis_json_can_be_set(db):
    import json
    now = datetime.now(timezone.utc).isoformat()
    session_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO study_sessions (id, user_id, node_id, status, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?)",
        (session_id, "u1", "n1", "SUBMITTED", now, now),
    )
    payload = json.dumps({"skillId": "AS.ADD_SUB", "label": "덧셈과 뺄셈"})
    db.execute(
        "UPDATE study_sessions SET diagnosis_json=? WHERE id=?",
        (payload, session_id),
    )
    db.commit()
    row = db.execute(
        "SELECT diagnosis_json FROM study_sessions WHERE id=?", (session_id,)
    ).fetchone()
    assert json.loads(row["diagnosis_json"])["skillId"] == "AS.ADD_SUB"
