# Curriculum Graph Schema v2 (Runtime Contract)

This document defines the Neo4j runtime schema used by the backend in
`backend/app/neo4j_graph.py`.

## Runtime Model

The deployed model is versioned and stores graph nodes/edges generically.

- `:GraphVersion`
  - Represents one draft/published graph snapshot.
- `:GraphNode`
  - Stores curriculum nodes for a specific graph version.
  - Node semantics are represented by `node_type` (for example: `unit`, `skill`,
    `problem`, `textbookUnit`, `root`).
- `:Problem`
  - Stores assessment items keyed by `id` and attached to `node_id`.

Relationships:

- `(:GraphVersion)-[:HAS_NODE]->(:GraphNode)`
- `(:GraphNode)-[:GRAPH_EDGE {graph_version_id, edge_id, edge_type, note}]->(:GraphNode)`

`GRAPH_EDGE.edge_type` carries semantic edge types (for example: `contains`,
`prereq`, `has_problem`, `measures`).

## Required Properties

`GraphVersion`
- `id: STRING` (primary id)
- `graph_id: STRING`
- `status: STRING` (`draft` or `published`)
- `schema_version: INTEGER`
- `created_at: STRING`
- `published_at: STRING | NULL`
- `problem_set_version_id: STRING | NULL`

`GraphNode`
- `key: STRING` (composite key: `{graph_version_id}\u0000{node_id}`)
- `graph_version_id: STRING`
- `node_id: STRING`
- `node_type: STRING`
- `label: STRING`
- `text: STRING | NULL`
- `meta_json: STRING` (JSON object as string)
- `order_value: REAL | NULL`

`Problem`
- `id: STRING` (primary id)
- `node_id: STRING`
- `order_value: INTEGER`
- `prompt: STRING`
- `grading_json: STRING`
- `answer_json: STRING`

## Required Constraints / Indexes

These are created in `Neo4jGraphStore._ensure_schema()`.

```cypher
CREATE CONSTRAINT graph_version_id IF NOT EXISTS
FOR (gv:GraphVersion) REQUIRE gv.id IS UNIQUE;

CREATE CONSTRAINT graph_node_key IF NOT EXISTS
FOR (n:GraphNode) REQUIRE n.key IS UNIQUE;

CREATE CONSTRAINT problem_id IF NOT EXISTS
FOR (p:Problem) REQUIRE p.id IS UNIQUE;

CREATE INDEX graph_version_status IF NOT EXISTS
FOR (gv:GraphVersion) ON (gv.status);

CREATE INDEX graph_node_version IF NOT EXISTS
FOR (n:GraphNode) ON (n.graph_version_id, n.node_id);

CREATE INDEX problem_node_order IF NOT EXISTS
FOR (p:Problem) ON (p.node_id, p.order_value);
```

## Ingestion Rules

- Use `MERGE` for `GraphVersion` and stable relation keys.
- Replace version-scoped `GraphNode` and `GRAPH_EDGE` data atomically per
  `graph_version_id`.
- Replace `Problem` set atomically on bootstrap.
- Bootstrap path is idempotent for logical counts when source SQLite data is
  unchanged.

## Reference Queries

Latest published graph version:

```cypher
MATCH (gv:GraphVersion {status: 'published'})
RETURN gv.id AS id
ORDER BY coalesce(gv.published_at, gv.created_at) DESC, gv.created_at DESC
LIMIT 1;
```

Published graph nodes and edges:

```cypher
MATCH (:GraphVersion {id: $graphVersionId})-[:HAS_NODE]->(n:GraphNode)
RETURN n.node_id, n.node_type, n.label, n.meta_json
ORDER BY coalesce(n.order_value, 1e18), n.node_id;

MATCH (:GraphVersion {id: $graphVersionId})-[:HAS_NODE]->(src:GraphNode)
MATCH (src)-[e:GRAPH_EDGE {graph_version_id: $graphVersionId}]->(tgt:GraphNode)
RETURN e.edge_id, e.edge_type, src.node_id, tgt.node_id
ORDER BY e.edge_id;
```

Problems by curriculum node id:

```cypher
MATCH (p:Problem {node_id: $nodeId})
RETURN p.id, p.order_value, p.prompt
ORDER BY p.order_value ASC, p.id ASC;
```
