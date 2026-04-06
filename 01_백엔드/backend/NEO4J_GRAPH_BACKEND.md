# Neo4j Graph Backend

This backend can run graph and problem retrieval on Neo4j while keeping the rest of the application on SQLite.

## Environment Variables

Set these in `backend/.env`:

- `GRAPH_STORAGE_BACKEND=neo4j`
- `NEO4J_URI=bolt://localhost:7687`
- `NEO4J_USERNAME=neo4j`
- `NEO4J_PASSWORD=<your-password>`
- `NEO4J_DATABASE=neo4j`
- `NEO4J_BOOTSTRAP_FROM_SQLITE=0`

`NEO4J_BOOTSTRAP_FROM_SQLITE=1` copies graph versions, nodes, edges, and problems from SQLite at startup.

## One-Time Migration

Run a one-time migration from existing SQLite data:

```bash
python backend/scripts/migrate_graph_to_neo4j.py --sqlite-path backend/data/app.db
```

If `--sqlite-path` is omitted, the script uses `DATABASE_PATH`.

## Cutover Sequence

1. Start Neo4j and set Neo4j environment variables.
2. Run `migrate_graph_to_neo4j.py` once.
3. Set `GRAPH_STORAGE_BACKEND=neo4j`.
4. Keep `NEO4J_BOOTSTRAP_FROM_SQLITE=0` after cutover.
5. Start backend and verify:
   - `GET /api/graph/draft`
   - `GET /api/graph/published`
   - `GET /api/problems?nodeId=<id>`

## Rollback

Set `GRAPH_STORAGE_BACKEND=sqlite` and restart the backend.
