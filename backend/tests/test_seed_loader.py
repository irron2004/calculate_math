from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.db import connect, init_db, seed_db
from app.main import create_app


def test_seed_loader_populates_nodes_and_draft(client):
    _, db_path = client

    conn = connect(db_path)
    node_count = conn.execute("SELECT COUNT(*) AS count FROM nodes").fetchone()["count"]
    draft_count = conn.execute(
        "SELECT COUNT(*) AS count FROM graph_versions WHERE status = 'draft'"
    ).fetchone()["count"]
    conn.close()

    assert node_count > 0
    assert draft_count > 0

    reopen = connect(db_path)
    reopened_count = reopen.execute("SELECT COUNT(*) AS count FROM nodes").fetchone()["count"]
    reopen.close()
    assert reopened_count == node_count


def test_schema_version_row_exists(client):
    _, db_path = client

    conn = connect(db_path)
    row = conn.execute("SELECT version FROM schema_version WHERE id = 1").fetchone()
    conn.close()

    assert row is not None


def _insert_graph_version(
    conn, *, status: str, published_at: str | None, nodes: list[dict]
) -> None:
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


def test_graph_data_persists_across_app_restart(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "restart.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))

    app_v1 = create_app()
    with TestClient(app_v1) as client_v1:
        response = client_v1.get("/api/graph/draft")
        assert response.status_code == 200
        draft_payload_v1 = response.json()

    conn = connect(db_path)
    count_after_seed = conn.execute("SELECT COUNT(*) AS count FROM graph_versions").fetchone()[
        "count"
    ]
    published_at = datetime(2099, 1, 1, tzinfo=timezone.utc).isoformat()
    _insert_graph_version(
        conn,
        status="published",
        published_at=published_at,
        nodes=[{"id": "PERSIST-NODE", "label": "Persisted"}],
    )
    conn.close()

    conn = connect(db_path)
    count_before_restart = conn.execute("SELECT COUNT(*) AS count FROM graph_versions").fetchone()[
        "count"
    ]
    conn.close()
    assert count_before_restart == count_after_seed + 1

    app_v2 = create_app()
    with TestClient(app_v2) as client_v2:
        response = client_v2.get("/api/graph/draft")
        assert response.status_code == 200
        assert response.json() == draft_payload_v1

        response = client_v2.get("/api/graph/published")
        assert response.status_code == 200
        published_payload = response.json()
        published_node_ids = {node["id"] for node in published_payload["nodes"]}
        assert "PERSIST-NODE" in published_node_ids

    conn = connect(db_path)
    count_after_restart = conn.execute("SELECT COUNT(*) AS count FROM graph_versions").fetchone()[
        "count"
    ]
    conn.close()

    assert count_after_restart == count_before_restart


def test_seed_loader_rejects_duplicate_nodes(tmp_path: Path):
    db_path = tmp_path / "test.db"
    seed_path = tmp_path / "seed.json"
    init_db(db_path)

    payload = {
        "schemaVersion": 1,
        "graphId": "test",
        "draft": {
            "nodes": [
                {"id": "node-1", "label": "Node 1"},
                {"id": "node-1", "label": "Node 1 Duplicate"},
            ],
            "edges": [],
        },
    }
    seed_path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ValueError, match="Duplicate node id"):
        seed_db(db_path, seed_path=seed_path)


def test_seed_loader_rejects_duplicate_edges(tmp_path: Path):
    db_path = tmp_path / "test.db"
    seed_path = tmp_path / "seed.json"
    init_db(db_path)

    payload = {
        "schemaVersion": 1,
        "graphId": "test",
        "draft": {
            "nodes": [
                {"id": "node-1", "label": "Node 1"},
                {"id": "node-2", "label": "Node 2"},
            ],
            "edges": [
                {"id": "edge-1", "edgeType": "prereq", "source": "node-1", "target": "node-2"},
                {"id": "edge-1", "edgeType": "prereq", "source": "node-1", "target": "node-2"},
            ],
        },
    }
    seed_path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ValueError, match="Duplicate edge id"):
        seed_db(db_path, seed_path=seed_path)
