from __future__ import annotations

from app.db import connect


def _get_any_node_id(db_path):
    conn = connect(db_path)
    row = conn.execute("SELECT id FROM nodes LIMIT 1").fetchone()
    conn.close()
    assert row is not None
    return row["id"]


def _insert_problem(conn, *, problem_id: str, node_id: str, order_value: int) -> None:
    conn.execute(
        """
        INSERT INTO problems (id, node_id, order_value, prompt, grading_json, answer_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (problem_id, node_id, order_value, "Test prompt", "{}", "{}"),
    )


def test_list_problems_sorted(client):
    test_client, db_path = client
    node_id = _get_any_node_id(db_path)

    conn = connect(db_path)
    _insert_problem(conn, problem_id="P-TEST-2", node_id=node_id, order_value=2)
    _insert_problem(conn, problem_id="P-TEST-1", node_id=node_id, order_value=1)
    conn.commit()
    conn.close()

    response = test_client.get("/api/problems", params={"nodeId": node_id})

    assert response.status_code == 200
    payload = response.json()
    orders = [problem["order"] for problem in payload]
    assert orders == sorted(orders)


def test_list_problems_node_not_found(client):
    test_client, _ = client

    response = test_client.get("/api/problems", params={"nodeId": "NO-SUCH-NODE"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NODE_NOT_FOUND"
