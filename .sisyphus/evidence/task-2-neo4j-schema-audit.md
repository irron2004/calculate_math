# Task 2 Neo4j Schema Audit

## Timestamp
- 2026-03-19 (Asia/Seoul)

## Authoritative schema target
- Target document: `backend/CURRICULUM_GRAPH_SCHEMA_V2.md`
- Runtime implementation: `backend/app/neo4j_graph.py` (`Neo4jGraphStore._ensure_schema`)
- Decision: schema expectation aligned to runtime GraphVersion/GraphNode/Problem contract.

## Live execution path
- Runner: Railway SSH to `calculate_math_neo4j`
- CLI: `cypher-shell`
- Auth: `neo4j` with service-local password
- Connectivity proof: `.sisyphus/evidence/task-7-neo4j-shell-smoke.txt`

## Required constraints/indexes (aligned contract)
- `graph_version_id` (UNIQUENESS on `GraphVersion.id`)
- `graph_node_key` (UNIQUENESS on `GraphNode.key`)
- `problem_id` (UNIQUENESS on `Problem.id`)
- `graph_version_status` (INDEX on `GraphVersion.status`)
- `graph_node_version` (INDEX on `GraphNode(graph_version_id, node_id)`)
- `problem_node_order` (INDEX on `Problem(node_id, order_value)`)

## Live query evidence
- Constraints dump: `.sisyphus/evidence/task-2-show-constraints.txt`
- Indexes dump: `.sisyphus/evidence/task-2-show-indexes.txt`

## Presence matrix
| Requirement | Live Status | Notes |
|---|---|---|
| `graph_version_id` | PRESENT | `UNIQUENESS` on `GraphVersion.id` |
| `graph_node_key` | PRESENT | `UNIQUENESS` on `GraphNode.key` |
| `problem_id` | PRESENT | `UNIQUENESS` on `Problem.id` |
| `graph_version_status` | PRESENT | RANGE index online |
| `graph_node_version` | PRESENT | RANGE index online |
| `problem_node_order` | PRESENT | RANGE index online |

## Result
- Required list extracted: COMPLETE (6/6)
- Live verification: EXECUTED
- Schema audit verdict: PASS

## Historical note
- Earlier local-session blocker files (`task-2-cypher-shell-check.txt`, `task-2-neo4j-env-check.txt`) are retained as historical context only; they are no longer active blockers after Railway runner execution.
