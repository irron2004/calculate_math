from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.db import connect


def _insert_graph_version(conn, *, status: str, published_at: str | None, nodes: list[dict]) -> None:
    graph_version_id = str(uuid4())
    conn.execute(
        """
        INSERT INTO graph_versions (
            id,
            graph_id,
            status,
            schema_version,
            created_at,
            published_at,
            problem_set_version_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            graph_version_id,
            "test-graph",
            status,
            1,
            datetime.now(timezone.utc).isoformat(),
            published_at,
            None,
        ),
    )
    for node in nodes:
        conn.execute(
            """
            INSERT INTO nodes (
                graph_version_id,
                id,
                node_type,
                label,
                text,
                meta_json,
                order_value
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                graph_version_id,
                node["id"],
                node.get("nodeType", "skill"),
                node["label"],
                node.get("text"),
                "{}",
                node.get("order"),
            ),
        )
    conn.commit()


def test_draft_graph_includes_schema(client):
    test_client, _ = client

    response = test_client.get("/api/graph/draft")

    assert response.status_code == 200
    payload = response.json()
    assert "schemaVersion" in payload
    assert isinstance(payload.get("nodes"), list)
    assert len(payload["nodes"]) > 0
    assert isinstance(payload.get("edges"), list)


def test_published_missing_returns_404(client):
    test_client, db_path = client

    conn = connect(db_path)
    conn.execute("DELETE FROM graph_versions WHERE status = 'published'")
    conn.commit()
    conn.close()

    response = test_client.get("/api/graph/published")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PUBLISHED_NOT_FOUND"


def test_published_returns_latest(client):
    test_client, db_path = client

    conn = connect(db_path)
    published_at = datetime(2099, 1, 1, tzinfo=timezone.utc).isoformat()
    _insert_graph_version(
        conn,
        status="published",
        published_at=published_at,
        nodes=[{"id": "NEW-NODE", "label": "Newest"}],
    )
    conn.close()

    response = test_client.get("/api/graph/published")

    assert response.status_code == 200
    payload = response.json()
    node_ids = {node["id"] for node in payload["nodes"]}
    assert "NEW-NODE" in node_ids
