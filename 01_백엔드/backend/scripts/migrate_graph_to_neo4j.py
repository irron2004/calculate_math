from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db import get_database_path, resolve_database_path
from app.neo4j_graph import Neo4jGraphStore


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sqlite-path", default=None)
    args = parser.parse_args()

    sqlite_path = (
        resolve_database_path(Path(args.sqlite_path))
        if args.sqlite_path
        else resolve_database_path(get_database_path())
    )

    store = Neo4jGraphStore.from_env()
    try:
        stats = store.bootstrap_from_sqlite(sqlite_path)
    finally:
        store.close()

    print(
        "Neo4j migration complete: "
        f"graphVersions={stats['graphVersions']} "
        f"nodes={stats['nodes']} "
        f"edges={stats['edges']} "
        f"problems={stats['problems']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
