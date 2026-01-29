from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Generator, Tuple

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
# Ensure backend/ is on sys.path when pytest rootdir is the repo root.
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import create_app


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[Tuple[TestClient, Path], None, None]:
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "admin")
    monkeypatch.setenv("ADMIN_AUTH_EMAIL", "admin@example.com")
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client, db_path
