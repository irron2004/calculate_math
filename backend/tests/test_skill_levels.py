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


# ── _update_skill_levels tests ────────────────────────────────────────────────

def _seed_teaches_edge(db, node_id: str, skill_id: str) -> str:
    """Insert a published graph_version + teaches edge into the temp DB."""
    gv_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO graph_versions (id, graph_id, status, schema_version, created_at, published_at) "
        "VALUES (?,?,?,?,?,?)",
        (gv_id, "test-graph", "published", 1, now, now),
    )
    edge_id = f"teaches:{node_id}->{skill_id}"
    db.execute(
        "INSERT INTO edges (graph_version_id, id, edge_type, source, target) VALUES (?,?,?,?,?)",
        (gv_id, edge_id, "teaches", node_id, skill_id),
    )
    db.commit()
    return gv_id


def test_update_skill_levels_creates_level_1(db):
    from app.api import _update_skill_levels

    _seed_teaches_edge(db, "MATH-2022-G-2-NA-001", "AS.ADD_SUB")
    _update_skill_levels(db, "user-A", "MATH-2022-G-2-NA-001")
    db.commit()

    row = db.execute(
        "SELECT level FROM student_skill_levels WHERE user_id='user-A' AND skill_id='AS.ADD_SUB'"
    ).fetchone()
    assert row is not None
    assert row["level"] == 1


def test_update_skill_levels_increments_existing(db):
    from app.api import _update_skill_levels

    _seed_teaches_edge(db, "MATH-2022-G-2-NA-001", "AS.ADD_SUB")
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO student_skill_levels (user_id, skill_id, level, updated_at) VALUES (?,?,?,?)",
        ("user-B", "AS.ADD_SUB", 1, now),
    )
    db.commit()

    _update_skill_levels(db, "user-B", "MATH-2022-G-2-NA-001")
    db.commit()

    row = db.execute(
        "SELECT level FROM student_skill_levels WHERE user_id='user-B' AND skill_id='AS.ADD_SUB'"
    ).fetchone()
    assert row["level"] == 2


def test_update_skill_levels_caps_at_3(db):
    from app.api import _update_skill_levels

    _seed_teaches_edge(db, "MATH-2022-G-2-NA-001", "AS.ADD_SUB")
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO student_skill_levels (user_id, skill_id, level, updated_at) VALUES (?,?,?,?)",
        ("user-C", "AS.ADD_SUB", 3, now),
    )
    db.commit()

    _update_skill_levels(db, "user-C", "MATH-2022-G-2-NA-001")
    db.commit()

    row = db.execute(
        "SELECT level FROM student_skill_levels WHERE user_id='user-C' AND skill_id='AS.ADD_SUB'"
    ).fetchone()
    assert row["level"] == 3  # must not exceed 3


# ── GET /skill-levels query logic tests ──────────────────────────────────────

def test_get_skill_levels_empty(db):
    rows = db.execute(
        "SELECT skill_id, level FROM student_skill_levels WHERE user_id=? AND level > 0",
        ("new-user",),
    ).fetchall()
    assert rows == []


def test_get_skill_levels_only_nonzero(db):
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO student_skill_levels (user_id, skill_id, level, updated_at) VALUES (?,?,?,?)",
        ("u5", "AS.ADD_SUB", 0, now),
    )
    db.execute(
        "INSERT INTO student_skill_levels (user_id, skill_id, level, updated_at) VALUES (?,?,?,?)",
        ("u5", "AS.MUL_DIV", 2, now),
    )
    db.commit()
    rows = db.execute(
        "SELECT skill_id, level FROM student_skill_levels WHERE user_id=? AND level > 0",
        ("u5",),
    ).fetchall()
    levels = {r["skill_id"]: r["level"] for r in rows}
    assert levels == {"AS.MUL_DIV": 2}
    assert "AS.ADD_SUB" not in levels


def test_get_skill_levels_multiple_skills(db):
    now = datetime.now(timezone.utc).isoformat()
    for skill, level in [("AS.ADD_SUB", 1), ("AS.PLACE_VALUE", 3), ("AS.DECIMAL", 2)]:
        db.execute(
            "INSERT INTO student_skill_levels (user_id, skill_id, level, updated_at) VALUES (?,?,?,?)",
            ("u6", skill, level, now),
        )
    db.commit()
    rows = db.execute(
        "SELECT skill_id, level FROM student_skill_levels WHERE user_id=? AND level > 0",
        ("u6",),
    ).fetchall()
    levels = {r["skill_id"]: r["level"] for r in rows}
    assert levels == {"AS.ADD_SUB": 1, "AS.PLACE_VALUE": 3, "AS.DECIMAL": 2}


def test_update_skill_levels_no_teaches_edge_is_noop(db):
    from app.api import _update_skill_levels

    gv_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO graph_versions (id, graph_id, status, schema_version, created_at, published_at) "
        "VALUES (?,?,?,?,?,?)",
        (gv_id, "test-graph", "published", 1, now, now),
    )
    db.commit()

    _update_skill_levels(db, "user-D", "CS.NO_TEACHES")
    db.commit()

    rows = db.execute(
        "SELECT * FROM student_skill_levels WHERE user_id='user-D'"
    ).fetchall()
    assert rows == []


# ── Recommendation skill-readiness tests ──────────────────────────────────────

def _seed_requires_skill_edge(db, cs_node_id: str, as_skill_id: str) -> str:
    """Seed graph_versions + requires_skill edge (AS→CS) for recommendation tests."""
    gv_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO graph_versions (id, graph_id, status, schema_version, created_at, published_at) "
        "VALUES (?,?,?,?,?,?)",
        (gv_id, "test-graph", "published", 1, now, now),
    )
    edge_id = f"requires_skill:{as_skill_id}->{cs_node_id}"
    db.execute(
        "INSERT INTO edges (graph_version_id, id, edge_type, source, target) VALUES (?,?,?,?,?)",
        (gv_id, edge_id, "requires_skill", as_skill_id, cs_node_id),
    )
    db.commit()
    return gv_id


def _seed_dummy_session(db, user_id: str, node_id: str = "CS.OTHER"):
    """Seed a non-cleared study session so _compute_recommendations has rows."""
    sid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO study_sessions (id, user_id, node_id, status, grading_json, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?,?)",
        (sid, user_id, node_id, "SUBMITTED",
         '{"cleared":false,"correctCount":0,"totalCount":1,"accuracy":0,"perProblem":{}}',
         now, now),
    )
    resp_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO study_responses (id, session_id, problem_id, input_raw, input_normalized, "
        "is_correct, time_spent_ms, scratchpad_strokes_json, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (resp_id, sid, "p1", "1", "1", 0, 1000, None, now),
    )
    db.commit()


def test_recommendation_skill_readiness_appears_when_skill_ready(db):
    from app.api import _compute_recommendations

    _seed_requires_skill_edge(db, "CS.FRAC_INTRO", "AS.ADD_SUB")
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO student_skill_levels (user_id, skill_id, level, updated_at) VALUES (?,?,?,?)",
        ("user-rec", "AS.ADD_SUB", 1, now),
    )
    db.commit()
    _seed_dummy_session(db, "user-rec")

    items = _compute_recommendations("user-rec", db, limit=10)
    node_ids = [i["nodeId"] for i in items]
    reasons = {i["nodeId"]: i["reason"] for i in items}

    assert "CS.FRAC_INTRO" in node_ids
    assert reasons["CS.FRAC_INTRO"] == "선수 스킬 준비됐어요"


def test_recommendation_skill_readiness_absent_when_skill_not_ready(db):
    from app.api import _compute_recommendations

    _seed_requires_skill_edge(db, "CS.FRAC_INTRO2", "AS.MUL_DIV")
    # Do NOT insert student_skill_levels — skill level stays 0
    _seed_dummy_session(db, "user-rec2")

    items = _compute_recommendations("user-rec2", db, limit=10)
    node_ids = [i["nodeId"] for i in items]
    assert "CS.FRAC_INTRO2" not in node_ids
