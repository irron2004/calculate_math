# Task 8 Cross-backend endpoint contract parity diff

## Scope
- Endpoints: `/api/graph/backend`, `/api/graph/published`, `/api/problems?nodeId=...`
- Modes: `GRAPH_STORAGE_BACKEND=sqlite` vs `GRAPH_STORAGE_BACKEND=neo4j`

## Captured in this session
- sqlite mode (Railway `calculate_math`, `GRAPH_STORAGE_BACKEND=sqlite`):
  - `.sisyphus/evidence/task-8-sqlite-backend-status.txt`
  - `.sisyphus/evidence/task-8-sqlite-backend.json`
  - `.sisyphus/evidence/task-8-sqlite-published-status.txt`
  - `.sisyphus/evidence/task-8-sqlite-published.json`
  - `.sisyphus/evidence/task-8-sqlite-problems-known-status.txt`
  - `.sisyphus/evidence/task-8-sqlite-problems-known.json`
  - `.sisyphus/evidence/task-8-sqlite-unknown-status.txt`
  - `.sisyphus/evidence/task-8-sqlite-unknown.json`
- neo4j mode (Railway `calculate_math`, `GRAPH_STORAGE_BACKEND=neo4j`):
  - `.sisyphus/evidence/task-8-neo4j-backend-status.txt`
  - `.sisyphus/evidence/task-8-neo4j-backend.json`
  - `.sisyphus/evidence/task-8-neo4j-published-status.txt`
  - `.sisyphus/evidence/task-8-neo4j-published.json`
  - `.sisyphus/evidence/task-8-neo4j-problems-known-status.txt`
  - `.sisyphus/evidence/task-8-neo4j-problems-known.json`
  - `.sisyphus/evidence/task-8-neo4j-unknown-status.txt`
  - `.sisyphus/evidence/task-8-neo4j-unknown.json`

## Semantic parity matrix
| Check | sqlite observation | neo4j observation | Severity | Status |
|---|---|---|---|---|
| `/api/graph/backend` reachable | `200`, `backend=sqlite`, `ready=true`, `publishedGraphAvailable=true`, `nodeCount=3`, `edgeCount=2` | `200`, `backend=neo4j`, `ready=true`, `publishedGraphAvailable=true`, `nodeCount=3`, `edgeCount=2` | high | PASS |
| `/api/graph/published` contract | `200`, schemaVersion=1, nodes=3, edges=2 | `200`, schemaVersion=1, nodes=3, edges=2 | high | PASS |
| `/api/problems?nodeId=E-3-ADD-001` semantics | `200`, 2 problems (`P-ADD-0001`,`P-ADD-0002`) | `200`, 2 problems (`P-ADD-0001`,`P-ADD-0002`) | high | PASS |
| `/api/problems?nodeId=UNKNOWN_NODE` semantics | `404 NODE_NOT_FOUND` | `404 NODE_NOT_FOUND` | high | PASS |

## Notes
- Ordering-insensitive fields were compared by semantic content (ids/counts/required keys), not raw byte order.
- Service mode was switched to run both backends on the same deployed data source and then restored to neo4j (`task-8-final-backend.json`).

## Current verdict
- PASS (required endpoint contracts are semantically equivalent across sqlite and neo4j)
