from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

import pytest

from app.graph_storage import (
    get_graph_storage_backend,
    prepare_graph_storage,
    should_bootstrap_graph_from_sqlite,
    shutdown_graph_storage,
)


@pytest.fixture(autouse=True)
def _cleanup_graph_store() -> Generator[None, None, None]:
    shutdown_graph_storage()
    yield
    shutdown_graph_storage()


def test_graph_storage_backend_defaults_to_sqlite(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("GRAPH_STORAGE_BACKEND", raising=False)
    assert get_graph_storage_backend() == "sqlite"


def test_graph_storage_backend_accepts_neo4j(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GRAPH_STORAGE_BACKEND", "neo4j")
    assert get_graph_storage_backend() == "neo4j"


def test_graph_storage_backend_rejects_unknown(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GRAPH_STORAGE_BACKEND", "unknown")
    with pytest.raises(ValueError, match="GRAPH_STORAGE_BACKEND"):
        get_graph_storage_backend()


def test_bootstrap_flag_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NEO4J_BOOTSTRAP_FROM_SQLITE", "1")
    assert should_bootstrap_graph_from_sqlite() is True

    monkeypatch.setenv("NEO4J_BOOTSTRAP_FROM_SQLITE", "true")
    assert should_bootstrap_graph_from_sqlite() is True

    monkeypatch.setenv("NEO4J_BOOTSTRAP_FROM_SQLITE", "0")
    assert should_bootstrap_graph_from_sqlite() is False


def test_prepare_graph_storage_noop_for_sqlite(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("GRAPH_STORAGE_BACKEND", "sqlite")
    result = prepare_graph_storage(tmp_path / "test.db")
    assert result is None


def test_prepare_graph_storage_neo4j_requires_env(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("GRAPH_STORAGE_BACKEND", "neo4j")
    monkeypatch.delenv("NEO4J_URI", raising=False)
    monkeypatch.delenv("NEO4J_USERNAME", raising=False)
    monkeypatch.delenv("NEO4J_PASSWORD", raising=False)
    with pytest.raises(ValueError, match="NEO4J_URI"):
        prepare_graph_storage(tmp_path / "test.db")
