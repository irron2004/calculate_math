from __future__ import annotations

import importlib
import json
import os
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_NEO4J_DATABASE = "neo4j"


def _connect_sqlite(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _graph_node_key(graph_version_id: str, node_id: str) -> str:
    return f"{graph_version_id}\u0000{node_id}"


def _loads_json_object(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value:
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        if isinstance(parsed, dict):
            return parsed
    return {}


@dataclass(frozen=True)
class Neo4jConfig:
    uri: str
    username: str
    password: str
    database: str = DEFAULT_NEO4J_DATABASE

    @classmethod
    def from_env(cls) -> "Neo4jConfig":
        uri = os.getenv("NEO4J_URI", "").strip()
        username = os.getenv("NEO4J_USERNAME", "").strip()
        password = os.getenv("NEO4J_PASSWORD", "").strip()
        database = os.getenv("NEO4J_DATABASE", DEFAULT_NEO4J_DATABASE).strip()

        missing: list[str] = []
        if not uri:
            missing.append("NEO4J_URI")
        if not username:
            missing.append("NEO4J_USERNAME")
        if not password:
            missing.append("NEO4J_PASSWORD")

        if missing:
            missing_vars = ", ".join(missing)
            raise ValueError(
                f"Neo4j graph backend requires environment variable(s): {missing_vars}"
            )

        if not database:
            database = DEFAULT_NEO4J_DATABASE

        return cls(uri=uri, username=username, password=password, database=database)


class Neo4jGraphStore:
    def __init__(self, config: Neo4jConfig):
        try:
            GraphDatabase = importlib.import_module("neo4j").GraphDatabase
        except Exception as exc:
            raise RuntimeError(
                "neo4j package is required for GRAPH_STORAGE_BACKEND=neo4j"
            ) from exc

        self._driver = GraphDatabase.driver(
            config.uri,
            auth=(config.username, config.password),
        )
        self._database = config.database
        self._driver.verify_connectivity()
        self._ensure_schema()

    @classmethod
    def from_env(cls) -> "Neo4jGraphStore":
        return cls(Neo4jConfig.from_env())

    def close(self) -> None:
        self._driver.close()

    def _run_write(
        self, query: str, parameters: Optional[Dict[str, Any]] = None
    ) -> None:
        with self._driver.session(database=self._database) as session:
            session.run(query, parameters or {}).consume()

    def _run_read(
        self, query: str, parameters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        with self._driver.session(database=self._database) as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    def _ensure_schema(self) -> None:
        queries = [
            "CREATE CONSTRAINT graph_version_id IF NOT EXISTS FOR (gv:GraphVersion) REQUIRE gv.id IS UNIQUE",
            "CREATE CONSTRAINT graph_node_key IF NOT EXISTS FOR (n:GraphNode) REQUIRE n.key IS UNIQUE",
            "CREATE CONSTRAINT problem_id IF NOT EXISTS FOR (p:Problem) REQUIRE p.id IS UNIQUE",
            "CREATE INDEX graph_version_status IF NOT EXISTS FOR (gv:GraphVersion) ON (gv.status)",
            "CREATE INDEX graph_node_version IF NOT EXISTS FOR (n:GraphNode) ON (n.graph_version_id, n.node_id)",
            "CREATE INDEX problem_node_order IF NOT EXISTS FOR (p:Problem) ON (p.node_id, p.order_value)",
        ]
        for query in queries:
            self._run_write(query)

    def _fetch_latest_graph_version(self, status: str) -> Optional[Dict[str, Any]]:
        rows = self._run_read(
            """
            MATCH (gv:GraphVersion {status: $status})
            RETURN gv.id AS id,
                   gv.schema_version AS schema_version,
                   gv.created_at AS created_at,
                   gv.published_at AS published_at
            ORDER BY CASE
                        WHEN $status = 'published' THEN coalesce(gv.published_at, gv.created_at)
                        ELSE gv.created_at
                     END DESC,
                     gv.created_at DESC
            LIMIT 1
            """,
            {"status": status},
        )
        return rows[0] if rows else None

    def fetch_latest_graph(self, status: str) -> Optional[Dict[str, Any]]:
        version_row = self._fetch_latest_graph_version(status)
        if not version_row:
            return None

        graph_version_id = str(version_row["id"])

        node_rows = self._run_read(
            """
            MATCH (:GraphVersion {id: $graph_version_id})-[:HAS_NODE]->(n:GraphNode)
            RETURN n.node_id AS id,
                   n.node_type AS node_type,
                   n.label AS label,
                   n.text AS text,
                   n.meta_json AS meta_json,
                   n.order_value AS order_value
            ORDER BY coalesce(n.order_value, 1e18), n.node_id
            """,
            {"graph_version_id": graph_version_id},
        )
        edge_rows = self._run_read(
            """
            MATCH (:GraphVersion {id: $graph_version_id})-[:HAS_NODE]->(src:GraphNode)
            MATCH (src)-[e:GRAPH_EDGE {graph_version_id: $graph_version_id}]->(tgt:GraphNode)
            RETURN e.edge_id AS id,
                   e.edge_type AS edge_type,
                   src.node_id AS source,
                   tgt.node_id AS target,
                   e.note AS note
            ORDER BY e.edge_id
            """,
            {"graph_version_id": graph_version_id},
        )

        nodes = [
            {
                "id": row["id"],
                "nodeType": row["node_type"],
                "label": row["label"],
                "text": row.get("text"),
                "meta": _loads_json_object(row.get("meta_json")),
                "order": row.get("order_value"),
            }
            for row in node_rows
        ]
        edges = [
            {
                "id": row["id"],
                "edgeType": row["edge_type"],
                "source": row["source"],
                "target": row["target"],
                "note": row.get("note"),
            }
            for row in edge_rows
        ]
        return {
            "schemaVersion": int(version_row.get("schema_version") or 1),
            "nodes": nodes,
            "edges": edges,
        }

    def _fetch_active_graph_version_id(self) -> Optional[str]:
        published_rows = self._run_read(
            """
            MATCH (gv:GraphVersion {status: 'published'})
            RETURN gv.id AS id
            ORDER BY coalesce(gv.published_at, gv.created_at) DESC, gv.created_at DESC
            LIMIT 1
            """
        )
        if published_rows:
            return str(published_rows[0]["id"])

        draft_rows = self._run_read(
            """
            MATCH (gv:GraphVersion {status: 'draft'})
            RETURN gv.id AS id
            ORDER BY gv.created_at DESC
            LIMIT 1
            """
        )
        if draft_rows:
            return str(draft_rows[0]["id"])
        return None

    def fetch_problems(self, node_id: str) -> Optional[List[Dict[str, Any]]]:
        graph_version_id = self._fetch_active_graph_version_id()
        if not graph_version_id:
            return None

        node_rows = self._run_read(
            """
            MATCH (:GraphVersion {id: $graph_version_id})-[:HAS_NODE]->(n:GraphNode {node_id: $node_id})
            RETURN n.node_id AS node_id
            LIMIT 1
            """,
            {"graph_version_id": graph_version_id, "node_id": node_id},
        )
        if not node_rows:
            return None

        problem_rows = self._run_read(
            """
            MATCH (p:Problem {node_id: $node_id})
            RETURN p.id AS id,
                   p.node_id AS node_id,
                   p.order_value AS order_value,
                   p.prompt AS prompt,
                   p.grading_json AS grading_json,
                   p.answer_json AS answer_json
            ORDER BY p.order_value ASC, p.id ASC
            """,
            {"node_id": node_id},
        )

        return [
            {
                "problemId": row["id"],
                "nodeId": row["node_id"],
                "order": int(row["order_value"]),
                "prompt": row["prompt"],
                "grading": _loads_json_object(row.get("grading_json")),
                "answer": _loads_json_object(row.get("answer_json")),
            }
            for row in problem_rows
        ]

    def bootstrap_from_sqlite(self, sqlite_path: Path) -> Dict[str, int]:
        snapshot = _load_sqlite_snapshot(sqlite_path)
        versions = snapshot["versions"]
        problems = snapshot["problems"]

        for version in versions:
            self._upsert_graph_version(version)
            self._replace_graph_nodes(version["id"], version["nodes"])
            self._replace_graph_edges(version["id"], version["edges"])

        self._replace_problems(problems)
        return {
            "graphVersions": len(versions),
            "nodes": sum(len(version["nodes"]) for version in versions),
            "edges": sum(len(version["edges"]) for version in versions),
            "problems": len(problems),
        }

    def _upsert_graph_version(self, version: Dict[str, Any]) -> None:
        self._run_write(
            """
            MERGE (gv:GraphVersion {id: $id})
            SET gv.graph_id = $graph_id,
                gv.status = $status,
                gv.schema_version = $schema_version,
                gv.created_at = $created_at,
                gv.published_at = $published_at,
                gv.problem_set_version_id = $problem_set_version_id
            """,
            {
                "id": version["id"],
                "graph_id": version["graph_id"],
                "status": version["status"],
                "schema_version": int(version["schema_version"]),
                "created_at": version["created_at"],
                "published_at": version["published_at"],
                "problem_set_version_id": version["problem_set_version_id"],
            },
        )

    def _replace_graph_nodes(
        self, graph_version_id: str, nodes: List[Dict[str, Any]]
    ) -> None:
        self._run_write(
            """
            MATCH (:GraphVersion {id: $graph_version_id})-[:HAS_NODE]->(n:GraphNode {graph_version_id: $graph_version_id})
            DETACH DELETE n
            """,
            {"graph_version_id": graph_version_id},
        )

        if not nodes:
            return

        payload = [
            {
                "key": _graph_node_key(graph_version_id, node["id"]),
                "node_id": node["id"],
                "node_type": node["node_type"],
                "label": node["label"],
                "text": node.get("text"),
                "meta_json": node.get("meta_json") or "{}",
                "order_value": node.get("order_value"),
            }
            for node in nodes
        ]
        self._run_write(
            """
            UNWIND $nodes AS node
            MATCH (gv:GraphVersion {id: $graph_version_id})
            CREATE (n:GraphNode {
                key: node.key,
                graph_version_id: $graph_version_id,
                node_id: node.node_id,
                node_type: node.node_type,
                label: node.label,
                text: node.text,
                meta_json: node.meta_json,
                order_value: node.order_value
            })
            MERGE (gv)-[:HAS_NODE]->(n)
            """,
            {"graph_version_id": graph_version_id, "nodes": payload},
        )

    def _replace_graph_edges(
        self, graph_version_id: str, edges: List[Dict[str, Any]]
    ) -> None:
        self._run_write(
            """
            MATCH ()-[rel:GRAPH_EDGE {graph_version_id: $graph_version_id}]->()
            DELETE rel
            """,
            {"graph_version_id": graph_version_id},
        )

        if not edges:
            return

        payload = [
            {
                "id": edge["id"],
                "edge_type": edge["edge_type"],
                "source_key": _graph_node_key(graph_version_id, edge["source"]),
                "target_key": _graph_node_key(graph_version_id, edge["target"]),
                "note": edge.get("note"),
            }
            for edge in edges
        ]
        self._run_write(
            """
            UNWIND $edges AS edge
            MATCH (src:GraphNode {key: edge.source_key})
            MATCH (tgt:GraphNode {key: edge.target_key})
            MERGE (src)-[rel:GRAPH_EDGE {
                graph_version_id: $graph_version_id,
                edge_id: edge.id
            }]->(tgt)
            SET rel.edge_type = edge.edge_type,
                rel.note = edge.note
            """,
            {"graph_version_id": graph_version_id, "edges": payload},
        )

    def _replace_problems(self, problems: List[Dict[str, Any]]) -> None:
        self._run_write("MATCH (p:Problem) DETACH DELETE p")
        if not problems:
            return

        payload = [
            {
                "id": problem["id"],
                "node_id": problem["node_id"],
                "order_value": int(problem["order_value"]),
                "prompt": problem["prompt"],
                "grading_json": problem["grading_json"],
                "answer_json": problem["answer_json"],
            }
            for problem in problems
        ]

        self._run_write(
            """
            UNWIND $problems AS problem
            CREATE (:Problem {
                id: problem.id,
                node_id: problem.node_id,
                order_value: problem.order_value,
                prompt: problem.prompt,
                grading_json: problem.grading_json,
                answer_json: problem.answer_json
            })
            """,
            {"problems": payload},
        )


def _load_sqlite_snapshot(sqlite_path: Path) -> Dict[str, Any]:
    conn = _connect_sqlite(sqlite_path)
    try:
        version_rows = conn.execute(
            """
            SELECT id, graph_id, status, schema_version, created_at, published_at, problem_set_version_id
            FROM graph_versions
            ORDER BY created_at ASC
            """
        ).fetchall()

        versions: List[Dict[str, Any]] = []
        for version_row in version_rows:
            graph_version_id = str(version_row["id"])
            node_rows = conn.execute(
                """
                SELECT id, node_type, label, text, meta_json, order_value
                FROM nodes
                WHERE graph_version_id = ?
                ORDER BY COALESCE(order_value, 1e18), id
                """,
                (graph_version_id,),
            ).fetchall()
            edge_rows = conn.execute(
                """
                SELECT id, edge_type, source, target, note
                FROM edges
                WHERE graph_version_id = ?
                ORDER BY id
                """,
                (graph_version_id,),
            ).fetchall()

            versions.append(
                {
                    "id": graph_version_id,
                    "graph_id": str(version_row["graph_id"]),
                    "status": str(version_row["status"]),
                    "schema_version": int(version_row["schema_version"]),
                    "created_at": version_row["created_at"],
                    "published_at": version_row["published_at"],
                    "problem_set_version_id": version_row["problem_set_version_id"],
                    "nodes": [
                        {
                            "id": node_row["id"],
                            "node_type": node_row["node_type"],
                            "label": node_row["label"],
                            "text": node_row["text"],
                            "meta_json": node_row["meta_json"] or "{}",
                            "order_value": node_row["order_value"],
                        }
                        for node_row in node_rows
                    ],
                    "edges": [
                        {
                            "id": edge_row["id"],
                            "edge_type": edge_row["edge_type"],
                            "source": edge_row["source"],
                            "target": edge_row["target"],
                            "note": edge_row["note"],
                        }
                        for edge_row in edge_rows
                    ],
                }
            )

        problem_rows = conn.execute(
            """
            SELECT id, node_id, order_value, prompt, grading_json, answer_json
            FROM problems
            ORDER BY order_value ASC, id ASC
            """
        ).fetchall()
        problems = [
            {
                "id": row["id"],
                "node_id": row["node_id"],
                "order_value": row["order_value"],
                "prompt": row["prompt"],
                "grading_json": row["grading_json"],
                "answer_json": row["answer_json"],
            }
            for row in problem_rows
        ]
        return {"versions": versions, "problems": problems}
    finally:
        conn.close()
