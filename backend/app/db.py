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
LOCAL_CURRICULUM_SEED_PATH = Path(__file__).resolve().parent / "data" / "curriculum_math_2022.json"
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
    if LOCAL_CURRICULUM_SEED_PATH.exists():
        return LOCAL_CURRICULUM_SEED_PATH
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

        CREATE TABLE IF NOT EXISTS homework_assignments (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            problems_json TEXT NOT NULL,
            due_at TEXT,
            scheduled_at TEXT,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS homework_assignment_targets (
            assignment_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            assigned_at TEXT NOT NULL,
            PRIMARY KEY (assignment_id, student_id),
            FOREIGN KEY (assignment_id) REFERENCES homework_assignments(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS homework_submissions (
            id TEXT PRIMARY KEY,
            assignment_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            answers_json TEXT NOT NULL,
            submitted_at TEXT NOT NULL,
            review_status TEXT NOT NULL DEFAULT 'pending',
            reviewed_at TEXT,
            reviewed_by TEXT,
            problem_reviews_json TEXT,
            FOREIGN KEY (assignment_id) REFERENCES homework_assignments(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS homework_submission_files (
            id TEXT PRIMARY KEY,
            submission_id TEXT NOT NULL,
            stored_path TEXT NOT NULL,
            original_name TEXT NOT NULL,
            content_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (submission_id) REFERENCES homework_submissions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            grade TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT
        );

        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            revoked_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS student_profiles (
            student_id TEXT PRIMARY KEY,
            survey_json TEXT,
            placement_json TEXT,
            estimated_level TEXT,
            weak_tags_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES users(username) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS praise_stickers (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            count INTEGER NOT NULL,
            reason TEXT NOT NULL,
            reason_type TEXT NOT NULL,
            homework_id TEXT,
            granted_by TEXT,
            granted_at TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES users(username) ON DELETE CASCADE
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_student_profiles_student_id ON student_profiles(student_id);
        CREATE INDEX IF NOT EXISTS idx_praise_stickers_student_id ON praise_stickers(student_id);
        CREATE INDEX IF NOT EXISTS idx_praise_stickers_student_granted_at ON praise_stickers(student_id, granted_at);
        """
    )
    _ensure_homework_review_columns(conn)
    _ensure_homework_scheduled_at_column(conn)
    _ensure_user_columns(conn)
    _ensure_refresh_token_columns(conn)
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


def _get_table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {row["name"] for row in rows}


def _ensure_homework_review_columns(conn: sqlite3.Connection) -> None:
    """Ensure homework_submissions has review tracking columns."""
    columns = _get_table_columns(conn, "homework_submissions")
    expected = {
        "review_status": "review_status TEXT NOT NULL DEFAULT 'pending'",
        "reviewed_at": "reviewed_at TEXT",
        "reviewed_by": "reviewed_by TEXT",
        "problem_reviews_json": "problem_reviews_json TEXT",
    }
    for name, definition in expected.items():
        if name in columns:
            continue
        conn.execute(f"ALTER TABLE homework_submissions ADD COLUMN {definition}")
    conn.execute("UPDATE homework_submissions SET review_status = 'pending' WHERE review_status IS NULL")


def _ensure_homework_scheduled_at_column(conn: sqlite3.Connection) -> None:
    """Ensure homework_assignments has scheduled_at column."""
    columns = _get_table_columns(conn, "homework_assignments")
    if "scheduled_at" not in columns:
        conn.execute("ALTER TABLE homework_assignments ADD COLUMN scheduled_at TEXT")


def _ensure_user_columns(conn: sqlite3.Connection) -> None:
    """Ensure users table has required columns."""
    columns = _get_table_columns(conn, "users")
    if not columns:
        return
    expected = {
        "id": "id TEXT PRIMARY KEY",
        "username": "username TEXT NOT NULL UNIQUE",
        "email": "email TEXT NOT NULL UNIQUE",
        "name": "name TEXT NOT NULL",
        "grade": "grade TEXT NOT NULL",
        "password_hash": "password_hash TEXT NOT NULL",
        "role": "role TEXT NOT NULL",
        "status": "status TEXT NOT NULL DEFAULT 'active'",
        "created_at": "created_at TEXT NOT NULL",
        "updated_at": "updated_at TEXT NOT NULL",
        "last_login_at": "last_login_at TEXT",
    }
    for name, definition in expected.items():
        if name in columns:
            continue
        conn.execute(f"ALTER TABLE users ADD COLUMN {definition}")


def _ensure_refresh_token_columns(conn: sqlite3.Connection) -> None:
    """Ensure refresh_tokens table has required columns."""
    columns = _get_table_columns(conn, "refresh_tokens")
    if not columns:
        return
    expected = {
        "id": "id TEXT PRIMARY KEY",
        "user_id": "user_id TEXT NOT NULL",
        "token_hash": "token_hash TEXT NOT NULL",
        "expires_at": "expires_at TEXT NOT NULL",
        "created_at": "created_at TEXT NOT NULL",
        "revoked_at": "revoked_at TEXT",
    }
    for name, definition in expected.items():
        if name in columns:
            continue
        conn.execute(f"ALTER TABLE refresh_tokens ADD COLUMN {definition}")


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


# ============================================================
# User/Auth Functions
# ============================================================


def create_user(
    *,
    username: str,
    email: str,
    name: str,
    grade: str,
    password_hash: str,
    role: str = "student",
    status: str = "active",
    path: Optional[Path] = None,
) -> str:
    conn = connect(path)
    try:
        user_id = str(uuid4())
        now = _now_iso()
        conn.execute(
            """
            INSERT INTO users
                (id, username, email, name, grade, password_hash, role, status, created_at, updated_at, last_login_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, username, email, name, grade, password_hash, role, status, now, now, None),
        )
        conn.commit()
        return user_id
    except sqlite3.IntegrityError as exc:
        message = str(exc)
        if "users.username" in message:
            raise ValueError("USERNAME_EXISTS") from exc
        if "users.email" in message:
            raise ValueError("EMAIL_EXISTS") from exc
        raise
    finally:
        conn.close()


def get_user_by_username(username: str, path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT id, username, email, name, grade, password_hash, role, status,
                   created_at, updated_at, last_login_at
            FROM users
            WHERE username = ?
            """,
            (username,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_email(email: str, path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT id, username, email, name, grade, password_hash, role, status,
                   created_at, updated_at, last_login_at
            FROM users
            WHERE email = ?
            """,
            (email,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id: str, path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT id, username, email, name, grade, password_hash, role, status,
                   created_at, updated_at, last_login_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_users(
    *,
    role: Optional[str] = None,
    status: Optional[str] = None,
    path: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    conn = connect(path)
    try:
        conditions = []
        params: list[Any] = []
        if role:
            conditions.append("role = ?")
            params.append(role)
        if status:
            conditions.append("status = ?")
            params.append(status)
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = conn.execute(
            f"""
            SELECT id, username, email, name, grade, role, status, created_at, updated_at, last_login_at
            FROM users
            {where_clause}
            ORDER BY created_at DESC
            """,
            params,
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def update_last_login(user_id: str, path: Optional[Path] = None) -> None:
    conn = connect(path)
    try:
        now = _now_iso()
        conn.execute(
            "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?",
            (now, now, user_id),
        )
        conn.commit()
    finally:
        conn.close()


def update_user_password(user_id: str, password_hash: str, path: Optional[Path] = None) -> bool:
    conn = connect(path)
    try:
        now = _now_iso()
        result = conn.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
            (password_hash, now, user_id),
        )
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()


def store_refresh_token(
    *,
    user_id: str,
    token_hash: str,
    expires_at: str,
    path: Optional[Path] = None,
) -> str:
    conn = connect(path)
    try:
        token_id = str(uuid4())
        conn.execute(
            """
            INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (token_id, user_id, token_hash, expires_at, _now_iso(), None),
        )
        conn.commit()
        return token_id
    finally:
        conn.close()


def get_refresh_token_by_hash(token_hash: str, path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT id, user_id, token_hash, expires_at, created_at, revoked_at
            FROM refresh_tokens
            WHERE token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def revoke_refresh_token(token_hash: str, path: Optional[Path] = None) -> bool:
    conn = connect(path)
    try:
        result = conn.execute(
            "UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
            (_now_iso(), token_hash),
        )
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()


def revoke_all_refresh_tokens(user_id: str, path: Optional[Path] = None) -> int:
    conn = connect(path)
    try:
        result = conn.execute(
            "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            (_now_iso(), user_id),
        )
        conn.commit()
        return result.rowcount
    finally:
        conn.close()


def cleanup_expired_refresh_tokens(path: Optional[Path] = None) -> int:
    """Delete refresh tokens that have expired or been revoked more than 7 days ago."""
    conn = connect(path)
    try:
        now = _now_iso()
        result = conn.execute(
            """
            DELETE FROM refresh_tokens
            WHERE expires_at < ?
               OR (revoked_at IS NOT NULL AND revoked_at < datetime(?, '-7 days'))
            """,
            (now, now),
        )
        conn.commit()
        return result.rowcount
    finally:
        conn.close()


def ensure_admin_user(
    *,
    username: str,
    password_hash: str,
    email: str,
    name: str,
    grade: str,
    path: Optional[Path] = None,
) -> bool:
    """Ensure an admin user exists. Returns True if created."""
    existing = get_user_by_username(username, path)
    if existing:
        return False
    create_user(
        username=username,
        email=email,
        name=name,
        grade=grade,
        password_hash=password_hash,
        role="admin",
        status="active",
        path=path,
    )
    return True


# ============================================================
# Student Profile Functions
# ============================================================


def get_student_profile(student_id: str, path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT student_id, survey_json, placement_json, estimated_level, weak_tags_json, created_at, updated_at
            FROM student_profiles
            WHERE student_id = ?
            """,
            (student_id,),
        ).fetchone()
        if not row:
            return None

        survey = json.loads(row["survey_json"]) if row["survey_json"] else None
        placement = json.loads(row["placement_json"]) if row["placement_json"] else None
        weak_tags = json.loads(row["weak_tags_json"]) if row["weak_tags_json"] else []

        if not isinstance(weak_tags, list):
            weak_tags = []

        return {
            "studentId": row["student_id"],
            "survey": survey or {},
            "placement": placement or {},
            "estimatedLevel": row["estimated_level"],
            "weakTagsTop3": weak_tags[:3],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
    finally:
        conn.close()


def upsert_student_profile(
    *,
    student_id: str,
    survey: Dict[str, Any],
    placement: Dict[str, Any],
    estimated_level: str,
    weak_tags_top3: List[str],
    path: Optional[Path] = None,
) -> None:
    conn = connect(path)
    try:
        now = _now_iso()
        existing = conn.execute(
            "SELECT 1 FROM student_profiles WHERE student_id = ?",
            (student_id,),
        ).fetchone()

        survey_json = json.dumps(survey or {}, ensure_ascii=False)
        placement_json = json.dumps(placement or {}, ensure_ascii=False)
        weak_tags_json = json.dumps(list(weak_tags_top3 or [])[:3], ensure_ascii=False)

        if existing:
            conn.execute(
                """
                UPDATE student_profiles
                SET survey_json = ?, placement_json = ?, estimated_level = ?, weak_tags_json = ?, updated_at = ?
                WHERE student_id = ?
                """,
                (survey_json, placement_json, estimated_level, weak_tags_json, now, student_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO student_profiles
                    (student_id, survey_json, placement_json, estimated_level, weak_tags_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (student_id, survey_json, placement_json, estimated_level, weak_tags_json, now, now),
            )
        conn.commit()
    finally:
        conn.close()


def list_students_with_profiles(path: Optional[Path] = None) -> List[Dict[str, Any]]:
    conn = connect(path)
    try:
        rows = conn.execute(
            """
            SELECT
                u.username,
                u.name,
                u.grade,
                u.email,
                sp.estimated_level,
                sp.weak_tags_json,
                sp.created_at AS profile_created_at,
                sp.updated_at AS profile_updated_at
            FROM users u
            LEFT JOIN student_profiles sp ON sp.student_id = u.username
            WHERE u.role = 'student' AND u.status = 'active'
            ORDER BY u.created_at DESC
            """
        ).fetchall()

        results: List[Dict[str, Any]] = []
        for row in rows:
            profile = None
            if row["profile_updated_at"]:
                weak_tags = json.loads(row["weak_tags_json"]) if row["weak_tags_json"] else []
                if not isinstance(weak_tags, list):
                    weak_tags = []
                profile = {
                    "estimatedLevel": row["estimated_level"],
                    "weakTagsTop3": weak_tags[:3],
                    "createdAt": row["profile_created_at"],
                    "updatedAt": row["profile_updated_at"],
                }

            results.append(
                {
                    "id": row["username"],
                    "name": row["name"],
                    "grade": row["grade"],
                    "email": row["email"],
                    "profile": profile,
                }
            )

        return results
    finally:
        conn.close()


# ============================================================
# Praise Sticker Functions
# ============================================================


def _row_to_praise_sticker(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "studentId": row["student_id"],
        "count": row["count"],
        "reason": row["reason"],
        "reasonType": row["reason_type"],
        "homeworkId": row["homework_id"],
        "grantedBy": row["granted_by"],
        "grantedAt": row["granted_at"],
    }


def create_praise_sticker(
    *,
    student_id: str,
    count: int,
    reason: str,
    reason_type: str,
    homework_id: Optional[str] = None,
    granted_by: Optional[str] = None,
    granted_at: Optional[str] = None,
    path: Optional[Path] = None,
) -> Dict[str, Any]:
    conn = connect(path)
    try:
        sticker_id = str(uuid4())
        granted_at_value = granted_at or _now_iso()
        conn.execute(
            """
            INSERT INTO praise_stickers (
                id,
                student_id,
                count,
                reason,
                reason_type,
                homework_id,
                granted_by,
                granted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (sticker_id, student_id, count, reason, reason_type, homework_id, granted_by, granted_at_value),
        )
        conn.commit()
        return {
            "id": sticker_id,
            "studentId": student_id,
            "count": count,
            "reason": reason,
            "reasonType": reason_type,
            "homeworkId": homework_id,
            "grantedBy": granted_by,
            "grantedAt": granted_at_value,
        }
    finally:
        conn.close()


def list_praise_stickers(student_id: str, path: Optional[Path] = None) -> List[Dict[str, Any]]:
    conn = connect(path)
    try:
        rows = conn.execute(
            """
            SELECT id, student_id, count, reason, reason_type, homework_id, granted_by, granted_at
            FROM praise_stickers
            WHERE student_id = ?
            ORDER BY granted_at DESC, id DESC
            """,
            (student_id,),
        ).fetchall()
        return [_row_to_praise_sticker(row) for row in rows]
    finally:
        conn.close()


def get_praise_sticker_summary(
    student_id: str,
    *,
    path: Optional[Path] = None,
) -> Dict[str, Any]:
    conn = connect(path)
    try:
        recent_rows = conn.execute(
            """
            SELECT id, student_id, count, reason, reason_type, homework_id, granted_by, granted_at
            FROM praise_stickers
            WHERE student_id = ?
            ORDER BY granted_at DESC, id DESC
            """,
            (student_id,),
        ).fetchall()
        total_count = sum(row["count"] for row in recent_rows)
        return {
            "totalCount": total_count,
            "recent": [_row_to_praise_sticker(row) for row in recent_rows],
        }
    finally:
        conn.close()


def has_praise_sticker_for_homework(
    student_id: str,
    homework_id: str,
    *,
    reason_type: str = "homework_excellent",
    path: Optional[Path] = None,
) -> bool:
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT 1
            FROM praise_stickers
            WHERE student_id = ? AND homework_id = ? AND reason_type = ?
            LIMIT 1
            """,
            (student_id, homework_id, reason_type),
        ).fetchone()
        return row is not None
    finally:
        conn.close()


# ============================================================
# Homework Functions
# ============================================================


def create_homework_assignment(
    title: str,
    problems: List[Dict[str, Any]],
    created_by: str,
    target_student_ids: List[str],
    description: Optional[str] = None,
    due_at: Optional[str] = None,
    scheduled_at: Optional[str] = None,
    path: Optional[Path] = None,
) -> str:
    """Create a new homework assignment and assign it to students."""
    normalized_due_at = due_at.strip() if due_at and due_at.strip() else None
    normalized_description = description.strip() if description and description.strip() else None
    normalized_scheduled_at = scheduled_at.strip() if scheduled_at and scheduled_at.strip() else None
    normalized_student_ids: List[str] = []
    seen: set[str] = set()
    for raw_student_id in target_student_ids:
        student_id = raw_student_id.strip()
        if not student_id or student_id in seen:
            continue
        normalized_student_ids.append(student_id)
        seen.add(student_id)
    if not normalized_student_ids:
        raise ValueError("No valid student ids provided")

    conn = connect(path)
    try:
        assignment_id = str(uuid4())
        created_at = _now_iso()
        problems_json = json.dumps(problems, ensure_ascii=False)

        conn.execute(
            """
            INSERT INTO homework_assignments (id, title, description, problems_json, due_at, scheduled_at, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (assignment_id, title, normalized_description, problems_json, normalized_due_at, normalized_scheduled_at, created_by, created_at),
        )

        for student_id in normalized_student_ids:
            conn.execute(
                """
                INSERT INTO homework_assignment_targets (assignment_id, student_id, assigned_at)
                VALUES (?, ?, ?)
                """,
                (assignment_id, student_id, created_at),
            )

        conn.commit()
        return assignment_id
    finally:
        conn.close()


_MISSING = object()


def update_homework_assignment(
    assignment_id: str,
    title: Optional[str] | object = _MISSING,
    due_at: Optional[str] | object = _MISSING,
    path: Optional[Path] = None,
) -> bool:
    """Update homework assignment title and/or due date."""
    updates: list[str] = []
    params: list[Any] = []

    if title is not _MISSING:
        updates.append("title = ?")
        params.append(title)

    if due_at is not _MISSING:
        updates.append("due_at = ?")
        params.append(due_at)

    if not updates:
        return False

    params.append(assignment_id)

    conn = connect(path)
    try:
        result = conn.execute(
            f"""
            UPDATE homework_assignments
            SET {", ".join(updates)}
            WHERE id = ?
            """,
            params,
        )
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()


def delete_homework_assignment(
    assignment_id: str, path: Optional[Path] = None
) -> bool:
    """Delete a homework assignment and its related records."""
    conn = connect(path)
    try:
        result = conn.execute(
            "DELETE FROM homework_assignments WHERE id = ?",
            (assignment_id,),
        )
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()


def list_homework_assignments_for_student(
    student_id: str, path: Optional[Path] = None
) -> List[Dict[str, Any]]:
    """List all homework assignments for a student.

    Only shows assignments that are either:
    - Not scheduled (scheduled_at is NULL)
    - Scheduled time has passed (scheduled_at <= current time)
    """
    conn = connect(path)
    try:
        now = _now_iso()
        rows = conn.execute(
            """
            SELECT
                ha.id,
                ha.title,
                ha.description,
                ha.problems_json,
                ha.due_at,
                ha.scheduled_at,
                ha.created_at,
                hs.id AS submission_id,
                hs.submitted_at AS submitted_at,
                hs.review_status AS review_status,
                CASE WHEN hs.id IS NOT NULL THEN 1 ELSE 0 END AS submitted
            FROM homework_assignments ha
            INNER JOIN homework_assignment_targets hat ON ha.id = hat.assignment_id
            LEFT JOIN homework_submissions hs ON hs.id = (
                SELECT id
                FROM homework_submissions
                WHERE assignment_id = ha.id AND student_id = ?
                ORDER BY submitted_at DESC
                LIMIT 1
            )
            WHERE hat.student_id = ?
              AND (ha.scheduled_at IS NULL OR ha.scheduled_at <= ?)
            ORDER BY ha.created_at DESC
            """,
            (student_id, student_id, now),
        ).fetchall()

        return [
            {
                "id": row["id"],
                "title": row["title"],
                "description": row["description"],
                "problems": json.loads(row["problems_json"]),
                "dueAt": row["due_at"],
                "scheduledAt": row["scheduled_at"],
                "createdAt": row["created_at"],
                "submitted": bool(row["submitted"]),
                "submissionId": row["submission_id"],
                "submittedAt": row["submitted_at"],
                "reviewStatus": row["review_status"] or ("pending" if row["submission_id"] else None),
            }
            for row in rows
        ]
    finally:
        conn.close()


def get_homework_assignment(
    assignment_id: str, student_id: str, path: Optional[Path] = None
) -> Optional[Dict[str, Any]]:
    """Get a single homework assignment with submission status for a student."""
    conn = connect(path)
    try:
        # Check if student is assigned to this homework
        target_row = conn.execute(
            """
            SELECT 1 FROM homework_assignment_targets
            WHERE assignment_id = ? AND student_id = ?
            """,
            (assignment_id, student_id),
        ).fetchone()

        if not target_row:
            return None

        row = conn.execute(
            """
            SELECT id, title, description, problems_json, due_at, scheduled_at, created_at
            FROM homework_assignments
            WHERE id = ?
            """,
            (assignment_id,),
        ).fetchone()

        if not row:
            return None

        # Hide scheduled assignments until scheduled time
        scheduled_at = row["scheduled_at"]
        if scheduled_at:
            now = _now_iso()
            if scheduled_at > now:
                return None

        # Check for existing submission
        submission_row = conn.execute(
            """
            SELECT id, answers_json, submitted_at, review_status, reviewed_at, reviewed_by, problem_reviews_json
            FROM homework_submissions
            WHERE assignment_id = ? AND student_id = ?
            ORDER BY submitted_at DESC
            LIMIT 1
            """,
            (assignment_id, student_id),
        ).fetchone()

        submission = None
        if submission_row:
            # Get submission files
            file_rows = conn.execute(
                """
                SELECT id, original_name, content_type, size_bytes
                FROM homework_submission_files
                WHERE submission_id = ?
                """,
                (submission_row["id"],),
            ).fetchall()

            submission = {
                "id": submission_row["id"],
                "answers": json.loads(submission_row["answers_json"]),
                "submittedAt": submission_row["submitted_at"],
                "files": [
                    {
                        "id": f["id"],
                        "originalName": f["original_name"],
                        "contentType": f["content_type"],
                        "sizeBytes": f["size_bytes"],
                    }
                    for f in file_rows
                ],
                "reviewStatus": submission_row["review_status"] or "pending",
                "reviewedAt": submission_row["reviewed_at"],
                "reviewedBy": submission_row["reviewed_by"],
                "problemReviews": (
                    json.loads(submission_row["problem_reviews_json"])
                    if submission_row["problem_reviews_json"]
                    else {}
                ),
            }

        return {
            "id": row["id"],
            "title": row["title"],
            "description": row["description"],
            "problems": json.loads(row["problems_json"]),
            "dueAt": row["due_at"],
            "createdAt": row["created_at"],
            "submission": submission,
        }
    finally:
        conn.close()


def check_homework_submission_exists(
    assignment_id: str, student_id: str, path: Optional[Path] = None
) -> bool:
    """Check if a student has already submitted for an assignment."""
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT review_status
            FROM homework_submissions
            WHERE assignment_id = ? AND student_id = ?
            ORDER BY submitted_at DESC
            LIMIT 1
            """,
            (assignment_id, student_id),
        ).fetchone()
        if row is None:
            return False
        review_status = row["review_status"] or "pending"
        return review_status != "returned"
    finally:
        conn.close()


def create_homework_submission(
    assignment_id: str,
    student_id: str,
    answers: Dict[str, str],
    path: Optional[Path] = None,
) -> str:
    """Create a new homework submission."""
    conn = connect(path)
    try:
        submission_id = str(uuid4())
        submitted_at = _now_iso()
        answers_json = json.dumps(answers, ensure_ascii=False)

        conn.execute(
            """
            INSERT INTO homework_submissions
            (id, assignment_id, student_id, answers_json, submitted_at, review_status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (submission_id, assignment_id, student_id, answers_json, submitted_at, "pending"),
        )

        conn.commit()
        return submission_id
    finally:
        conn.close()


def save_homework_submission_file(
    submission_id: str,
    stored_path: str,
    original_name: str,
    content_type: str,
    size_bytes: int,
    path: Optional[Path] = None,
) -> str:
    """Save a file record for a homework submission."""
    conn = connect(path)
    try:
        file_id = str(uuid4())
        created_at = _now_iso()

        conn.execute(
            """
            INSERT INTO homework_submission_files
            (id, submission_id, stored_path, original_name, content_type, size_bytes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (file_id, submission_id, stored_path, original_name, content_type, size_bytes, created_at),
        )

        conn.commit()
        return file_id
    finally:
        conn.close()


def get_homework_submission_for_review(
    submission_id: str, path: Optional[Path] = None
) -> Optional[Dict[str, Any]]:
    """Get a submission with assignment problems for review validation."""
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT
                hs.id,
                hs.assignment_id,
                hs.student_id,
                hs.answers_json,
                hs.submitted_at,
                hs.review_status,
                hs.reviewed_at,
                hs.reviewed_by,
                hs.problem_reviews_json,
                ha.title AS assignment_title,
                ha.problems_json,
                ha.due_at
            FROM homework_submissions hs
            INNER JOIN homework_assignments ha ON hs.assignment_id = ha.id
            WHERE hs.id = ?
            """,
            (submission_id,),
        ).fetchone()

        if not row:
            return None

        return {
            "id": row["id"],
            "assignmentId": row["assignment_id"],
            "studentId": row["student_id"],
            "answers": json.loads(row["answers_json"]),
            "submittedAt": row["submitted_at"],
            "reviewStatus": row["review_status"] or "pending",
            "reviewedAt": row["reviewed_at"],
            "reviewedBy": row["reviewed_by"],
            "problemReviews": (
                json.loads(row["problem_reviews_json"])
                if row["problem_reviews_json"]
                else {}
            ),
            "assignmentTitle": row["assignment_title"],
            "problems": json.loads(row["problems_json"]),
            "dueAt": row["due_at"],
        }
    finally:
        conn.close()


def update_homework_submission_review(
    submission_id: str,
    review_status: str,
    problem_reviews: Dict[str, Any],
    reviewed_by: str,
    path: Optional[Path] = None,
) -> bool:
    """Update review status and comments for a submission."""
    conn = connect(path)
    try:
        reviewed_at = _now_iso()
        problem_reviews_json = (
            json.dumps(problem_reviews, ensure_ascii=False) if problem_reviews else None
        )
        result = conn.execute(
            """
            UPDATE homework_submissions
            SET review_status = ?, reviewed_at = ?, reviewed_by = ?, problem_reviews_json = ?
            WHERE id = ?
            """,
            (review_status, reviewed_at, reviewed_by, problem_reviews_json, submission_id),
        )
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()


def get_homework_submission_with_files(
    submission_id: str, path: Optional[Path] = None
) -> Optional[Dict[str, Any]]:
    """Get a submission with its files for email notification."""
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT
                hs.id,
                hs.assignment_id,
                hs.student_id,
                hs.answers_json,
                hs.submitted_at,
                ha.title AS assignment_title,
                ha.problems_json
            FROM homework_submissions hs
            INNER JOIN homework_assignments ha ON hs.assignment_id = ha.id
            WHERE hs.id = ?
            """,
            (submission_id,),
        ).fetchone()

        if not row:
            return None

        file_rows = conn.execute(
            """
            SELECT id, stored_path, original_name, content_type, size_bytes
            FROM homework_submission_files
            WHERE submission_id = ?
            """,
            (submission_id,),
        ).fetchall()

        return {
            "id": row["id"],
            "assignmentId": row["assignment_id"],
            "studentId": row["student_id"],
            "answers": json.loads(row["answers_json"]),
            "problems": json.loads(row["problems_json"]),
            "submittedAt": row["submitted_at"],
            "assignmentTitle": row["assignment_title"],
            "files": [
                {
                    "id": f["id"],
                    "storedPath": f["stored_path"],
                    "originalName": f["original_name"],
                    "contentType": f["content_type"],
                    "sizeBytes": f["size_bytes"],
                }
                for f in file_rows
            ],
        }
    finally:
        conn.close()


def list_all_students(path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """List all active students from the users table."""
    conn = connect(path)
    try:
        rows = conn.execute(
            """
            SELECT id, username, email, name, grade, role, status, created_at, updated_at, last_login_at
            FROM users
            WHERE role = 'student' AND status = 'active'
            ORDER BY name ASC, username ASC
            """
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


# ============================================================
# Admin Homework Functions
# ============================================================


def list_all_homework_assignments_admin(
    path: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    """Admin: List all homework assignments with submission statistics."""
    conn = connect(path)
    try:
        now = _now_iso()
        rows = conn.execute(
            """
            SELECT
                ha.id,
                ha.title,
                ha.description,
                ha.problems_json,
                ha.due_at,
                ha.scheduled_at,
                ha.created_by,
                ha.created_at,
                (
                    SELECT COUNT(*)
                    FROM homework_assignment_targets hat
                    WHERE hat.assignment_id = ha.id
                ) AS total_students,
                (
                    SELECT COUNT(DISTINCT hs.student_id)
                    FROM homework_submissions hs
                    WHERE hs.assignment_id = ha.id
                ) AS submitted_count,
                (
                    SELECT COUNT(DISTINCT hs.student_id)
                    FROM homework_submissions hs
                    WHERE hs.assignment_id = ha.id AND hs.review_status = 'pending'
                ) AS pending_count,
                (
                    SELECT COUNT(DISTINCT hs.student_id)
                    FROM homework_submissions hs
                    WHERE hs.assignment_id = ha.id AND hs.review_status = 'approved'
                ) AS approved_count,
                (
                    SELECT COUNT(DISTINCT hs.student_id)
                    FROM homework_submissions hs
                    WHERE hs.assignment_id = ha.id AND hs.review_status = 'returned'
                ) AS returned_count,
                CASE
                    WHEN ha.scheduled_at IS NOT NULL AND ha.scheduled_at > ? THEN 1
                    ELSE 0
                END AS is_scheduled
            FROM homework_assignments ha
            ORDER BY ha.created_at DESC
            """,
            (now,),
        ).fetchall()

        return [
            {
                "id": row["id"],
                "title": row["title"],
                "description": row["description"],
                "problems": json.loads(row["problems_json"]),
                "dueAt": row["due_at"],
                "scheduledAt": row["scheduled_at"],
                "createdBy": row["created_by"],
                "createdAt": row["created_at"],
                "totalStudents": row["total_students"],
                "submittedCount": row["submitted_count"],
                "pendingCount": row["pending_count"],
                "approvedCount": row["approved_count"],
                "returnedCount": row["returned_count"],
                "isScheduled": bool(row["is_scheduled"]),
            }
            for row in rows
        ]
    finally:
        conn.close()


def get_homework_assignment_admin(
    assignment_id: str, path: Optional[Path] = None
) -> Optional[Dict[str, Any]]:
    """Admin: Get assignment detail with all student submission summaries."""
    conn = connect(path)
    try:
        # Get assignment
        assignment_row = conn.execute(
            """
            SELECT id, title, description, problems_json, due_at, scheduled_at, created_by, created_at
            FROM homework_assignments
            WHERE id = ?
            """,
            (assignment_id,),
        ).fetchone()

        if not assignment_row:
            return None

        # Get all assigned students with their latest submission status
        student_rows = conn.execute(
            """
            SELECT
                hat.student_id,
                hat.assigned_at,
                hs.id AS submission_id,
                hs.submitted_at,
                hs.review_status,
                hs.reviewed_at,
                hs.reviewed_by
            FROM homework_assignment_targets hat
            LEFT JOIN homework_submissions hs ON hs.id = (
                SELECT id
                FROM homework_submissions
                WHERE assignment_id = hat.assignment_id AND student_id = hat.student_id
                ORDER BY submitted_at DESC
                LIMIT 1
            )
            WHERE hat.assignment_id = ?
            ORDER BY hat.student_id
            """,
            (assignment_id,),
        ).fetchall()

        students = [
            {
                "studentId": row["student_id"],
                "assignedAt": row["assigned_at"],
                "submissionId": row["submission_id"],
                "submittedAt": row["submitted_at"],
                "reviewStatus": row["review_status"] or (None if not row["submission_id"] else "pending"),
                "reviewedAt": row["reviewed_at"],
                "reviewedBy": row["reviewed_by"],
            }
            for row in student_rows
        ]

        return {
            "id": assignment_row["id"],
            "title": assignment_row["title"],
            "description": assignment_row["description"],
            "problems": json.loads(assignment_row["problems_json"]),
            "dueAt": assignment_row["due_at"],
            "scheduledAt": assignment_row["scheduled_at"],
            "createdBy": assignment_row["created_by"],
            "createdAt": assignment_row["created_at"],
            "students": students,
        }
    finally:
        conn.close()


def get_submission_admin(
    submission_id: str, path: Optional[Path] = None
) -> Optional[Dict[str, Any]]:
    """Admin: Get full submission detail including answers, files, and reviews."""
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT
                hs.id,
                hs.assignment_id,
                hs.student_id,
                hs.answers_json,
                hs.submitted_at,
                hs.review_status,
                hs.reviewed_at,
                hs.reviewed_by,
                hs.problem_reviews_json,
                ha.title AS assignment_title,
                ha.description AS assignment_description,
                ha.problems_json,
                ha.due_at
            FROM homework_submissions hs
            INNER JOIN homework_assignments ha ON hs.assignment_id = ha.id
            WHERE hs.id = ?
            """,
            (submission_id,),
        ).fetchone()

        if not row:
            return None

        # Get files
        file_rows = conn.execute(
            """
            SELECT id, stored_path, original_name, content_type, size_bytes, created_at
            FROM homework_submission_files
            WHERE submission_id = ?
            ORDER BY created_at
            """,
            (submission_id,),
        ).fetchall()

        files = [
            {
                "id": f["id"],
                "storedPath": f["stored_path"],
                "originalName": f["original_name"],
                "contentType": f["content_type"],
                "sizeBytes": f["size_bytes"],
                "createdAt": f["created_at"],
            }
            for f in file_rows
        ]

        return {
            "id": row["id"],
            "assignmentId": row["assignment_id"],
            "studentId": row["student_id"],
            "answers": json.loads(row["answers_json"]),
            "submittedAt": row["submitted_at"],
            "reviewStatus": row["review_status"] or "pending",
            "reviewedAt": row["reviewed_at"],
            "reviewedBy": row["reviewed_by"],
            "problemReviews": (
                json.loads(row["problem_reviews_json"])
                if row["problem_reviews_json"]
                else {}
            ),
            "assignmentTitle": row["assignment_title"],
            "assignmentDescription": row["assignment_description"],
            "problems": json.loads(row["problems_json"]),
            "dueAt": row["due_at"],
            "files": files,
        }
    finally:
        conn.close()


def get_submission_file(
    file_id: str, path: Optional[Path] = None
) -> Optional[Dict[str, Any]]:
    """Admin: Get file info for download."""
    conn = connect(path)
    try:
        row = conn.execute(
            """
            SELECT id, submission_id, stored_path, original_name, content_type, size_bytes
            FROM homework_submission_files
            WHERE id = ?
            """,
            (file_id,),
        ).fetchone()

        if not row:
            return None

        return {
            "id": row["id"],
            "submissionId": row["submission_id"],
            "storedPath": row["stored_path"],
            "originalName": row["original_name"],
            "contentType": row["content_type"],
            "sizeBytes": row["size_bytes"],
        }
    finally:
        conn.close()


def get_pending_homework_count(
    student_id: str, path: Optional[Path] = None
) -> Dict[str, int]:
    """Get count of actionable homework for a student (not submitted or returned)."""
    conn = connect(path)
    try:
        # Count assignments where student hasn't submitted or submission was returned
        now = _now_iso()
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total_assigned,
                SUM(CASE
                    WHEN hs.id IS NULL THEN 1
                    ELSE 0
                END) AS not_submitted,
                SUM(CASE
                    WHEN hs.review_status = 'returned' THEN 1
                    ELSE 0
                END) AS returned,
                SUM(CASE
                    WHEN hs.review_status = 'pending' THEN 1
                    ELSE 0
                END) AS pending_review,
                SUM(CASE
                    WHEN hs.review_status = 'approved' THEN 1
                    ELSE 0
                END) AS approved
            FROM homework_assignment_targets hat
            LEFT JOIN homework_submissions hs ON hs.id = (
                SELECT id
                FROM homework_submissions
                WHERE assignment_id = hat.assignment_id AND student_id = hat.student_id
                ORDER BY submitted_at DESC
                LIMIT 1
            )
            INNER JOIN homework_assignments ha ON ha.id = hat.assignment_id
            WHERE hat.student_id = ?
              AND (ha.scheduled_at IS NULL OR ha.scheduled_at <= ?)
            """,
            (student_id, now),
        ).fetchone()

        return {
            "totalAssigned": row["total_assigned"] or 0,
            "notSubmitted": row["not_submitted"] or 0,
            "returned": row["returned"] or 0,
            "pendingReview": row["pending_review"] or 0,
            "approved": row["approved"] or 0,
            "actionRequired": (row["not_submitted"] or 0) + (row["returned"] or 0),
        }
    finally:
        conn.close()
