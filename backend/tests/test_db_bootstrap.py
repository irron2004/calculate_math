from __future__ import annotations

from pathlib import Path

import pytest

from app.db import DEFAULT_DB_PATH, connect, get_database_path, resolve_database_path


def test_get_database_path_default(monkeypatch):
    monkeypatch.delenv("DATABASE_PATH", raising=False)
    assert get_database_path() == DEFAULT_DB_PATH


def test_get_database_path_override(monkeypatch, tmp_path: Path):
    override_path = tmp_path / "override.db"
    monkeypatch.setenv("DATABASE_PATH", str(override_path))
    assert get_database_path() == override_path


def test_connect_creates_db_file(tmp_path: Path):
    db_path = tmp_path / "bootstrap.db"
    assert not db_path.exists()

    conn = connect(db_path)
    conn.close()

    assert db_path.exists()


def test_connection_cycle(tmp_path: Path):
    db_path = tmp_path / "cycle.db"

    conn = connect(db_path)
    conn.execute("SELECT 1")
    conn.close()

    conn = connect(db_path)
    conn.execute("SELECT 1")
    conn.close()


def test_resolve_database_path_rejects_directory(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path))
    with pytest.raises(ValueError, match="directory"):
        resolve_database_path()


def test_resolve_database_path_rejects_file_parent(monkeypatch, tmp_path: Path):
    parent = tmp_path / "not_a_dir"
    parent.write_text("nope", encoding="utf-8")
    monkeypatch.setenv("DATABASE_PATH", str(parent / "db.sqlite"))
    with pytest.raises(ValueError, match="not a directory"):
        resolve_database_path()


def test_resolve_database_path_rejects_empty_env(monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", " ")
    with pytest.raises(ValueError, match="DATABASE_PATH is set but empty"):
        resolve_database_path()


def test_database_path_exposed_on_app_state(client):
    test_client, db_path = client
    assert test_client.app.state.database_path == str(db_path)
