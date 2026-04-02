# Task 7 sqlite-neo4j migration parity and idempotency verification

## Execution status
- Status: EXECUTED (LIVE)
- Runtime: Railway service `calculate_math` + Neo4j service `calculate_math_neo4j`
- Migration entrypoint used: `python -c "... from app.neo4j_graph import Neo4jGraphStore ... bootstrap_from_sqlite(...)"`
  - Note: `backend/scripts/migrate_graph_to_neo4j.py` is not present in deployed image path (`/app`), so module bootstrap path was used.

## Run logs
- Run 1 output: `.sisyphus/evidence/task-7-migration-run1.log`
  - `{'graphVersions': 2, 'nodes': 6, 'edges': 4, 'problems': 3}`
- Run 2 output: `.sisyphus/evidence/task-7-migration-run2.log`
  - `{'graphVersions': 2, 'nodes': 6, 'edges': 4, 'problems': 3}`

## Count snapshots (Neo4j)
- Run 1: `.sisyphus/evidence/task-7-counts-run1.txt`
  - `graphVersions=2, graphNodes=6, problems=3, graphEdges=4, hasNodeRels=6`
- Run 2: `.sisyphus/evidence/task-7-counts-run2.txt`
  - `graphVersions=2, graphNodes=6, problems=3, graphEdges=4, hasNodeRels=6`

## Idempotency assertion
- Logical counts are identical between run1 and run2.
- No growth detected in core entities (`GraphVersion`, `GraphNode`, `Problem`, `GRAPH_EDGE`).

## Current verdict
- PASS (idempotency confirmed for deployed data set)
