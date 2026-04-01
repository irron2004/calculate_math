def test_recommendation_item_model():
    from app.models import RecommendationItem
    item = RecommendationItem(nodeId="n1", reason="최근 3번 틀렸어요", score=3.0)
    assert item.nodeId == "n1"
    assert item.reason == "최근 3번 틀렸어요"
    assert item.score == 3.0


def test_recommendations_response_model():
    from app.models import RecommendationsResponse, RecommendationItem
    resp = RecommendationsResponse(
        items=[
            RecommendationItem(nodeId="n1", reason="최근 3번 틀렸어요", score=3.0),
            RecommendationItem(nodeId="n2", reason="오랫동안 안 풀었어요", score=1.4),
        ]
    )
    assert len(resp.items) == 2
    assert resp.items[0].nodeId == "n1"


def test_compute_recommendations_empty():
    """No sessions, no profile → no recommendations."""
    import os, tempfile
    from app.db import get_connection, init_db
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        path = f.name
    conn = get_connection(path)
    init_db(conn)
    from app.api import _compute_recommendations
    result = _compute_recommendations("user1", None, conn)
    conn.close()
    os.unlink(path)
    assert result == []


def _seed_user(conn, username: str) -> None:
    """Seed a user row required by student_profiles FK."""
    import uuid
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT OR IGNORE INTO users
           (id, username, email, name, grade, password_hash, role, status, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (str(uuid.uuid4()), username, f"{username}@test.com", username, "3",
         "x", "student", "active", now, now),
    )
    conn.commit()


def _seed_placement_graph(conn, grade: int, node_ids: list[str]) -> None:
    """Seed a published graph with CourseStep nodes for grade."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    gv_id = f"gv-placement-grade{grade}"
    conn.execute(
        "INSERT INTO graph_versions (id, graph_id, status, schema_version, created_at) VALUES (?,?,?,?,?)",
        (gv_id, "g1", "published", 1, now),
    )
    for i, nid in enumerate(node_ids):
        conn.execute(
            "INSERT INTO nodes (graph_version_id, id, node_type, label, order_value) VALUES (?,?,?,?,?)",
            (gv_id, nid, "course_step", f"Node {nid}", float(i + 1)),
        )
    conn.commit()


def test_compute_recommendations_new_user_with_placement():
    """New user with placement profile → grade-based recommendations."""
    import os, tempfile, json
    from datetime import datetime, timezone
    from app.db import get_connection, init_db
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        path = f.name
    conn = get_connection(path)
    init_db(conn)

    node_ids = ["MATH-2022-G-3-NA-001", "MATH-2022-G-3-NA-002"]
    _seed_placement_graph(conn, 3, node_ids)
    _seed_user(conn, "alice")

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO student_profiles
           (student_id, survey_json, placement_json, estimated_level, weak_tags_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?)""",
        ("alice", "{}", "{}", "E3-2", "[]", now, now),
    )
    conn.commit()

    from app.api import _compute_recommendations
    result = _compute_recommendations("user-alice", "alice", conn)
    conn.close()
    os.unlink(path)

    assert len(result) == 2
    assert all(r["reason"] == "학년에 맞는 첫 단원이에요" for r in result)
    assert {r["nodeId"] for r in result} == set(node_ids)


def test_compute_recommendations_placement_no_match():
    """Placement grade has no nodes → empty results."""
    import os, tempfile
    from datetime import datetime, timezone
    from app.db import get_connection, init_db
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        path = f.name
    conn = get_connection(path)
    init_db(conn)

    # Seed grade 4 nodes, but profile says grade 3
    _seed_placement_graph(conn, 4, ["MATH-2022-G-4-NA-001"])
    _seed_user(conn, "bob")

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO student_profiles
           (student_id, survey_json, placement_json, estimated_level, weak_tags_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?)""",
        ("bob", "{}", "{}", "E3-1", "[]", now, now),
    )
    conn.commit()

    from app.api import _compute_recommendations
    result = _compute_recommendations("user-bob", "bob", conn)
    conn.close()
    os.unlink(path)

    assert result == []
