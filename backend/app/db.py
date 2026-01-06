"""SQLite storage helpers for graph and problem data."""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

DEFAULT_SCHEMA_VERSION = 1
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "app.db"
DEFAULT_CURRICULUM_SEED_PATH = REPO_ROOT / "public" / "data" / "curriculum_math_2022.json"
FALLBACK_SEED_PATH = Path(__file__).resolve().parent / "data" / "seed.json"


def get_database_path() -> Path:
    """Return the configured DB path, defaulting to backend/data/app.db."""
    env_path = os.getenv("DATABASE_PATH")
    if env_path is not None:
        if not env_path.strip():
            raise ValueError("DATABASE_PATH is set but empty.")
        return Path(env_path)
    return DEFAULT_DB_PATH


def get_seed_path() -> Path:
    env_path = os.getenv("SEED_PATH")
    if env_path:
        return Path(env_path)
    if DEFAULT_CURRICULUM_SEED_PATH.exists():
        return DEFAULT_CURRICULUM_SEED_PATH
    return FALLBACK_SEED_PATH


def resolve_database_path(path: Optional[Path] = None) -> Path:
    resolved = path or get_database_path()
    if resolved.exists() and resolved.is_dir():
        raise ValueError(f"Database path '{resolved}' points to a directory, not a file.")
    parent = resolved.parent
    if parent.exists() and not parent.is_dir():
        raise ValueError(f"Database directory '{parent}' is not a directory.")
    try:
        parent.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise ValueError(f"Unable to create database directory '{parent}'.") from exc
    return resolved


def connect(path: Optional[Path] = None) -> sqlite3.Connection:
    db_path = resolve_database_path(path)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db(path: Optional[Path] = None) -> None:
    conn = connect(path)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS graph_versions (
            id TEXT PRIMARY KEY,
            graph_id TEXT NOT NULL,
            status TEXT NOT NULL,
            schema_version INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            published_at TEXT,
            problem_set_version_id TEXT
        );

        CREATE TABLE IF NOT EXISTS schema_version (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version INTEGER NOT NULL,
            applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS nodes (
            graph_version_id TEXT NOT NULL,
            id TEXT NOT NULL,
            node_type TEXT NOT NULL,
            label TEXT NOT NULL,
            text TEXT,
            meta_json TEXT,
            order_value REAL,
            PRIMARY KEY (graph_version_id, id),
            FOREIGN KEY (graph_version_id) REFERENCES graph_versions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS edges (
            graph_version_id TEXT NOT NULL,
            id TEXT NOT NULL,
            edge_type TEXT NOT NULL,
            source TEXT NOT NULL,
            target TEXT NOT NULL,
            note TEXT,
            PRIMARY KEY (graph_version_id, id),
            FOREIGN KEY (graph_version_id) REFERENCES graph_versions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS problems (
            id TEXT PRIMARY KEY,
            node_id TEXT NOT NULL,
            order_value INTEGER NOT NULL,
            prompt TEXT NOT NULL,
            grading_json TEXT NOT NULL,
            answer_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attempts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            graph_version_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            problem_id TEXT NOT NULL,
            input_raw TEXT NOT NULL,
            input_normalized TEXT NOT NULL,
            is_correct INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )
    conn.execute(
        """
        INSERT INTO schema_version (id, version, applied_at)
        SELECT 1, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM schema_version)
        """,
        (DEFAULT_SCHEMA_VERSION, _now_iso()),
    )
    conn.commit()
    conn.close()


def _set_schema_version(conn: sqlite3.Connection, version: int) -> None:
    conn.execute(
        "UPDATE schema_version SET version = ?, applied_at = ? WHERE id = 1",
        (version, _now_iso()),
    )


def _resolve_graph_id(payload: Dict[str, Any]) -> str:
    graph_id = payload.get("graphId")
    if graph_id:
        return str(graph_id)
    meta = payload.get("meta")
    if isinstance(meta, dict) and meta.get("curriculumId"):
        return str(meta["curriculumId"])
    return "default"


def _ensure_unique_entries(items: List[Dict[str, Any]], key: str, label: str) -> None:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for item in items:
        value = item.get(key)
        if value in seen:
            duplicates.add(str(value))
        else:
            seen.add(value)
    if duplicates:
        dup_list = ", ".join(sorted(duplicates))
        raise ValueError(f"Duplicate {label} id(s) in seed data: {dup_list}")


def _normalize_nodes(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for node in nodes:
        if "id" not in node:
            raise ValueError("Node entry missing required field 'id'")
        meta: Dict[str, Any] = {}
        if isinstance(node.get("meta"), dict):
            meta.update(node["meta"])
        for key, value in node.items():
            if key not in {"id", "nodeType", "label", "text", "order", "meta"}:
                meta[key] = value
        normalized.append(
            {
                "id": node["id"],
                "nodeType": node.get("nodeType", "curriculum"),
                "label": node.get("label", node["id"]),
                "text": node.get("text"),
                "meta": meta,
                "order": node.get("order"),
            }
        )
    _ensure_unique_entries(normalized, "id", "node")
    return normalized


def _normalize_edges(edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for edge in edges:
        if "id" not in edge:
            if edge.get("source") and edge.get("target"):
                edge_id = f"{edge.get('edgeType', 'prereq')}:{edge['source']}->{edge['target']}"
            else:
                raise ValueError("Edge entry missing required field 'id'")
        else:
            edge_id = edge["id"]
        normalized.append(
            {
                "id": edge_id,
                "edgeType": edge.get("edgeType", "prereq"),
                "source": edge["source"],
                "target": edge["target"],
                "note": edge.get("note"),
            }
        )
    _ensure_unique_entries(normalized, "id", "edge")
    return normalized


def seed_db(path: Optional[Path] = None, seed_path: Optional[Path] = None) -> None:
    db_path = path or get_database_path()
    seed_file = seed_path or get_seed_path()
    if not seed_file.exists():
        return

    conn = connect(db_path)
    try:
        existing = conn.execute("SELECT COUNT(*) AS count FROM graph_versions").fetchone()
        if existing and existing["count"] > 0:
            return

        data = json.loads(seed_file.read_text(encoding="utf-8"))
        schema_version = int(data.get("schemaVersion", DEFAULT_SCHEMA_VERSION))
        _set_schema_version(conn, schema_version)

        graph_id = _resolve_graph_id(data)
        created_at = _now_iso()
        problem_set_version_id = data.get("problemSetVersionId")

        if "draft" in data or "published" in data:
            draft = data.get("draft")
            if draft:
                draft_nodes = _normalize_nodes(draft.get("nodes") or [])
                draft_edges = _normalize_edges(draft.get("edges") or [])
                draft_id = _insert_graph_version(
                    conn,
                    graph_id=graph_id,
                    status="draft",
                    schema_version=schema_version,
                    created_at=created_at,
                    published_at=None,
                    problem_set_version_id=problem_set_version_id,
                )
                _insert_nodes(conn, draft_id, draft_nodes)
                _insert_edges(conn, draft_id, draft_edges)

            published = data.get("published")
            if published:
                published_nodes = _normalize_nodes(published.get("nodes") or [])
                published_edges = _normalize_edges(published.get("edges") or [])
                published_at = _now_iso()
                published_id = _insert_graph_version(
                    conn,
                    graph_id=graph_id,
                    status="published",
                    schema_version=schema_version,
                    created_at=created_at,
                    published_at=published_at,
                    problem_set_version_id=problem_set_version_id,
                )
                _insert_nodes(conn, published_id, published_nodes)
                _insert_edges(conn, published_id, published_edges)
        elif "nodes" in data and "edges" in data:
            draft_nodes = _normalize_nodes(data.get("nodes") or [])
            draft_edges = _normalize_edges(data.get("edges") or [])
            draft_id = _insert_graph_version(
                conn,
                graph_id=graph_id,
                status="draft",
                schema_version=schema_version,
                created_at=created_at,
                published_at=None,
                problem_set_version_id=problem_set_version_id,
            )
            _insert_nodes(conn, draft_id, draft_nodes)
            _insert_edges(conn, draft_id, draft_edges)
        else:
            raise ValueError("Seed data format is not supported.")

        problems = data.get("problems", [])
        for problem in problems:
            conn.execute(
                """
                INSERT INTO problems (id, node_id, order_value, prompt, grading_json, answer_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    problem["problemId"],
                    problem["nodeId"],
                    int(problem["order"]),
                    problem["prompt"],
                    json.dumps(problem.get("grading", {})),
                    json.dumps(problem.get("answer", {})),
                ),
            )

        conn.commit()
    finally:
        conn.close()


def _insert_graph_version(
    conn: sqlite3.Connection,
    *,
    graph_id: str,
    status: str,
    schema_version: int,
    created_at: str,
    published_at: Optional[str],
    problem_set_version_id: Optional[str],
) -> str:
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
            graph_id,
            status,
            schema_version,
            created_at,
            published_at,
            problem_set_version_id,
        ),
    )
    return graph_version_id


def _insert_nodes(conn: sqlite3.Connection, graph_version_id: str, nodes: List[Dict[str, Any]]) -> None:
    for node in nodes:
        try:
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
                    node.get("nodeType", "curriculum"),
                    node["label"],
                    node.get("text"),
                    json.dumps(node.get("meta", {})),
                    node.get("order"),
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError(
                f"Duplicate node id '{node['id']}' for graph version '{graph_version_id}'."
            ) from exc


def _insert_edges(conn: sqlite3.Connection, graph_version_id: str, edges: List[Dict[str, Any]]) -> None:
    for edge in edges:
        try:
            conn.execute(
                """
                INSERT INTO edges (
                    graph_version_id,
                    id,
                    edge_type,
                    source,
                    target,
                    note
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    graph_version_id,
                    edge["id"],
                    edge.get("edgeType", "prereq"),
                    edge["source"],
                    edge["target"],
                    edge.get("note"),
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError(
                f"Duplicate edge id '{edge['id']}' for graph version '{graph_version_id}'."
            ) from exc


def fetch_latest_graph(status: str, path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    conn = connect(path)
    order_by = "published_at DESC, created_at DESC" if status == "published" else "created_at DESC"
    row = conn.execute(
        f"SELECT id, schema_version FROM graph_versions WHERE status = ? ORDER BY {order_by} LIMIT 1",
        (status,),
    ).fetchone()
    if not row:
        conn.close()
        return None

    nodes_rows = conn.execute(
        """
        SELECT id, node_type, label, text, meta_json, order_value
        FROM nodes
        WHERE graph_version_id = ?
        ORDER BY COALESCE(order_value, 1e18), id
        """,
        (row["id"],),
    ).fetchall()
    edges_rows = conn.execute(
        """
        SELECT id, edge_type, source, target, note
        FROM edges
        WHERE graph_version_id = ?
        ORDER BY id
        """,
        (row["id"],),
    ).fetchall()
    conn.close()

    nodes = [
        {
            "id": node["id"],
            "nodeType": node["node_type"],
            "label": node["label"],
            "text": node["text"],
            "meta": json.loads(node["meta_json"] or "{}"),
            "order": node["order_value"],
        }
        for node in nodes_rows
    ]
    edges = [
        {
            "id": edge["id"],
            "edgeType": edge["edge_type"],
            "source": edge["source"],
            "target": edge["target"],
            "note": edge["note"],
        }
        for edge in edges_rows
    ]
    return {
        "schemaVersion": row["schema_version"],
        "nodes": nodes,
        "edges": edges,
    }


def _get_active_graph_version_id(conn: sqlite3.Connection) -> Optional[str]:
    row = conn.execute(
        """
        SELECT id FROM graph_versions
        WHERE status = 'published'
        ORDER BY published_at DESC, created_at DESC
        LIMIT 1
        """
    ).fetchone()
    if row:
        return row["id"]
    row = conn.execute(
        """
        SELECT id FROM graph_versions
        WHERE status = 'draft'
        ORDER BY created_at DESC
        LIMIT 1
        """
    ).fetchone()
    if row:
        return row["id"]
    return None


def fetch_problems(node_id: str, path: Optional[Path] = None) -> Optional[List[Dict[str, Any]]]:
    conn = connect(path)
    active_graph_id = _get_active_graph_version_id(conn)
    if not active_graph_id:
        conn.close()
        return None

    node_row = conn.execute(
        """
        SELECT 1 FROM nodes
        WHERE graph_version_id = ? AND id = ?
        LIMIT 1
        """,
        (active_graph_id, node_id),
    ).fetchone()
    if not node_row:
        conn.close()
        return None

    problem_rows = conn.execute(
        """
        SELECT id, node_id, order_value, prompt, grading_json, answer_json
        FROM problems
        WHERE node_id = ?
        ORDER BY order_value ASC, id ASC
        """,
        (node_id,),
    ).fetchall()
    conn.close()

    problems = [
        {
            "problemId": row["id"],
            "nodeId": row["node_id"],
            "order": row["order_value"],
            "prompt": row["prompt"],
            "grading": json.loads(row["grading_json"]),
            "answer": json.loads(row["answer_json"]),
        }
        for row in problem_rows
    ]
    return problems
