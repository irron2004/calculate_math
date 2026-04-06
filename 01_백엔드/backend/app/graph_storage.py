from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, Optional, Literal

from .neo4j_graph import Neo4jGraphStore

GraphStorageBackend = Literal["sqlite", "neo4j"]

_graph_store: Optional[Neo4jGraphStore] = None
_graph_prepared = False
_graph_prepare_stats: Optional[Dict[str, int]] = None


def get_graph_storage_backend() -> GraphStorageBackend:
    raw = os.getenv("GRAPH_STORAGE_BACKEND", "sqlite").strip().lower()
    if raw in {"", "sqlite"}:
        return "sqlite"
    if raw == "neo4j":
        return "neo4j"
    raise ValueError("GRAPH_STORAGE_BACKEND must be either 'sqlite' or 'neo4j'")


def should_bootstrap_graph_from_sqlite() -> bool:
    raw = os.getenv("NEO4J_BOOTSTRAP_FROM_SQLITE", "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _get_neo4j_store() -> Neo4jGraphStore:
    global _graph_store
    if _graph_store is None:
        _graph_store = Neo4jGraphStore.from_env()
    return _graph_store


def get_neo4j_graph_store() -> Neo4jGraphStore:
    backend = get_graph_storage_backend()
    if backend != "neo4j":
        raise ValueError("Neo4j graph store requested while backend is not 'neo4j'")
    return _get_neo4j_store()


def shutdown_graph_storage() -> None:
    global _graph_store
    global _graph_prepared
    global _graph_prepare_stats
    if _graph_store is not None:
        _graph_store.close()
        _graph_store = None
    _graph_prepared = False
    _graph_prepare_stats = None


def prepare_graph_storage(sqlite_path: Path) -> Optional[Dict[str, int]]:
    global _graph_prepared
    global _graph_prepare_stats

    backend = get_graph_storage_backend()
    if backend == "sqlite":
        return None

    if _graph_prepared:
        return _graph_prepare_stats

    store = _get_neo4j_store()
    if should_bootstrap_graph_from_sqlite():
        _graph_prepare_stats = store.bootstrap_from_sqlite(sqlite_path)
        _graph_prepared = True
        return _graph_prepare_stats

    _graph_prepare_stats = {
        "graphVersions": 0,
        "nodes": 0,
        "edges": 0,
        "problems": 0,
    }
    _graph_prepared = True
    return _graph_prepare_stats
