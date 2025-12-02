diff --git a/tests/test_api.py b/tests/test_api.py
index 16701ff..058bb86 100644
--- a/tests/test_api.py
+++ b/tests/test_api.py
@@ -1,13 +1,15 @@
-from __future__ import annotations
-
-import importlib
-import json
-import sys
-from datetime import datetime, timezone
-from pathlib import Path
-
-import httpx
-import pytest
+from __future__ import annotations
+
+import importlib
+import json
+import sys
+from dataclasses import replace
+from datetime import datetime, timezone
+from pathlib import Path
+import hashlib
+
+import httpx
+import pytest
@@
 problem_bank_module = _load_module("app.problem_bank")
 config_module = _load_module("app.config")
 repositories_module = _load_module("app.repositories")
 progress_store_module = _load_module("app.progress_store")
+rate_limiter_module = _load_module("app.security.rate_limiter")
 create_app = calculate_service_module.create_app
 list_categories = problem_bank_module.list_categories
 reset_problem_cache = problem_bank_module.reset_cache
 get_settings = config_module.get_settings
 AttemptRepository = repositories_module.AttemptRepository
 SessionRepository = repositories_module.SessionRepository
+UserRepository = repositories_module.UserRepository
+SlidingWindowRateLimiter = rate_limiter_module.SlidingWindowRateLimiter
 template_engine_module = _load_module("app.template_engine")
 reset_template_engine = template_engine_module.reset_engine
 reset_progress_store = progress_store_module.reset_progress_store
@@
-    monkeypatch.setenv("PROBLEM_DATA_PATH", str(problems_path))
-    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
-    monkeypatch.setenv("SESSION_TOKEN_SECRET", "integration-secret")
-    monkeypatch.setenv("DAG_PROGRESS_PATH", str(progress_path))
-
-    get_settings.cache_clear()  # type: ignore[attr-defined]
+    monkeypatch.setenv("PROBLEM_DATA_PATH", str(problems_path))
+    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
+    monkeypatch.setenv("SESSION_TOKEN_SECRET", "integration-secret")
+    monkeypatch.setenv("DAG_PROGRESS_PATH", str(progress_path))
+    monkeypatch.setenv("PASSWORD_PEPPER", "test-pepper")
+    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
+    monkeypatch.setenv("SESSION_COOKIE_SAMESITE", "lax")
+    monkeypatch.setenv("LOGIN_RATE_LIMIT_ATTEMPTS", "6")
+    monkeypatch.setenv("LOGIN_RATE_LIMIT_WINDOW_SECONDS", "60")
+
+    get_settings.cache_clear()  # type: ignore[attr-defined]
@@
 async def test_create_session_honours_arithmetic_config(client) -> None:
     token, login_response = await _login_and_get_token(client)
     assert login_response.status_code == 200
@@
     data = response.json()
     assert len(data["problems"]) == 5
     sample = data["problems"][0]
     assert sample["operator"] == "mul"
     assert sample["left"] * sample["right"] == sample["answer"]
+
+
+async def test_login_rehashes_legacy_passwords(client, dataset) -> None:
+    repository = UserRepository(dataset["attempts_path"])
+    legacy_hash = hashlib.sha256("legacy-password".encode("utf-8")).hexdigest()
+    repository.create_user(
+        nickname="legacy-user",
+        password_hash=legacy_hash,
+        role="student",
+    )
+
+    response = await client.post(
+        "/api/v1/login",
+        json={"nickname": "legacy-user", "password": "legacy-password"},
+    )
+    assert response.status_code == 200
+    refreshed = repository.get_by_nickname("legacy-user")
+    assert refreshed is not None
+    assert refreshed.password_hash.startswith("$argon2")
+
+
+async def test_login_rate_limit_blocks_after_multiple_failures(app, client) -> None:
+    creation = await client.post(
+        "/api/v1/login",
+        json={"nickname": "rate-user", "password": "correct"},
+    )
+    assert creation.status_code == 200
+
+    app.state.login_rate_limiter = SlidingWindowRateLimiter(max_attempts=2, window_seconds=60)
+
+    for _ in range(2):
+        failure = await client.post(
+            "/api/v1/login",
+            json={"nickname": "rate-user", "password": "wrong"},
+        )
+        assert failure.status_code == 401
+
+    blocked = await client.post(
+        "/api/v1/login",
+        json={"nickname": "rate-user", "password": "wrong"},
+    )
+    assert blocked.status_code == 429
+    assert blocked.json()["detail"]["message"].startswith("로그인 시도가 너무 많습니다")
+
+
+async def test_login_requires_https_when_secure_cookie(app, client) -> None:
+    settings = app.state.settings
+    app.state.settings = replace(settings, session_cookie_secure=True)
+    try:
+        response = await client.post(
+            "/api/v1/login",
+            json={"nickname": "https-user", "password": "secret"},
+        )
+        assert response.status_code == 400
+        detail = response.json()["detail"]["message"]
+        assert "HTTPS" in detail
+    finally:
+        app.state.settings = settings
