diff --git a/app/routers/practice.py b/app/routers/practice.py
index 177e804..e4de8c9 100644
--- a/app/routers/practice.py
+++ b/app/routers/practice.py
@@ -1,24 +1,34 @@
-from __future__ import annotations
-
-import hashlib
-import random
-import time
+from __future__ import annotations
+
+import hashlib
+import logging
+import random
+import time
 from dataclasses import dataclass
 from enum import Enum
 from typing import List, Optional
-
-from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
-from pydantic import BaseModel, Field
-
-from ..dependencies.auth import (
-    SessionTokenService,
-    get_current_user,
-    get_session_token_service,
-    get_user_repository,
-)
-from ..repositories import UserRecord, UserRepository
-
+ 
+from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
+from pydantic import BaseModel, Field
+
+from ..config import Settings, get_settings
+from ..dependencies.auth import (
+    SessionTokenService,
+    get_current_user,
+    get_session_token_service,
+    get_user_repository,
+)
+from ..repositories import UserRecord, UserRepository
+from ..security.passwords import (
+    hash_password as secure_hash_password,
+    is_argon_hash,
+    needs_rehash,
+    verify_password,
+)
+from ..security.rate_limiter import SlidingWindowRateLimiter
+
 router = APIRouter(prefix="/api", tags=["practice"])
+login_logger = logging.getLogger("calculate_service.api.login")
@@
-class SessionResponse(BaseModel):
-    session_id: int
-    problems: List[SessionProblem]
-
-
-def _hash_password(raw: str) -> str:
-    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
-
-
-def _set_session_cookie(
-    response: Response, session_service: SessionTokenService, token: str
-) -> None:
-    response.set_cookie(
-        key=session_service.cookie_name,
-        value=token,
-        httponly=True,
-        secure=session_service.cookie_secure,
-        samesite="lax",
-        max_age=session_service.ttl_seconds,
-    )
+class SessionResponse(BaseModel):
+    session_id: int
+    problems: List[SessionProblem]
+
+
+def _hash_legacy_password(raw: str) -> str:
+    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
+
+
+def _resolve_settings(request: Request) -> Settings:
+    stored = getattr(request.app.state, "settings", None)
+    if isinstance(stored, Settings):
+        return stored
+    return get_settings()
+
+
+def _get_login_rate_limiter(
+    request: Request,
+    *,
+    settings: Settings,
+) -> SlidingWindowRateLimiter:
+    limiter = getattr(request.app.state, "login_rate_limiter", None)
+    if isinstance(limiter, SlidingWindowRateLimiter):
+        return limiter
+    limiter = SlidingWindowRateLimiter(
+        max_attempts=settings.login_rate_limit_attempts,
+        window_seconds=settings.login_rate_limit_window_seconds,
+    )
+    request.app.state.login_rate_limiter = limiter
+    return limiter
+
+
+def _verify_and_upgrade_password(
+    *,
+    password: str,
+    record: UserRecord,
+    repository: UserRepository,
+    pepper: str,
+) -> bool:
+    stored_hash = record.password_hash
+    if is_argon_hash(stored_hash):
+        if not verify_password(password, stored_hash, pepper=pepper):
+            return False
+        if needs_rehash(stored_hash):
+            repository.update_password_hash(
+                record.id,
+                secure_hash_password(password, pepper=pepper),
+            )
+        return True
+
+    if _hash_legacy_password(password) != stored_hash:
+        return False
+    repository.update_password_hash(
+        record.id,
+        secure_hash_password(password, pepper=pepper),
+    )
+    return True
+
+
+def _set_session_cookie(
+    response: Response,
+    request: Request,
+    session_service: SessionTokenService,
+    token: str,
+) -> None:
+    if session_service.cookie_secure and request.url.scheme != "https":
+        raise HTTPException(
+            status_code=status.HTTP_400_BAD_REQUEST,
+            detail={"message": "HTTPS 연결에서만 로그인할 수 있습니다."},
+        )
+    response.set_cookie(
+        key=session_service.cookie_name,
+        value=token,
+        httponly=True,
+        secure=session_service.cookie_secure,
+        samesite=session_service.cookie_samesite,
+        max_age=session_service.ttl_seconds,
+    )
@@
-@router.post("/v1/login", response_model=LoginResponse)
-async def login(
-    payload: LoginRequest,
-    response: Response,
-    request: Request,
-    repository: UserRepository = Depends(get_user_repository),
-    session_service: SessionTokenService = Depends(get_session_token_service),
-) -> LoginResponse:
-    normalized_nickname = payload.nickname.strip()
-    if not normalized_nickname:
-        raise HTTPException(
-            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
-            detail={"message": "닉네임을 입력해주세요."},
-        )
-
-    existing = repository.get_by_nickname(normalized_nickname)
-    password_hash = _hash_password(payload.password)
-
-    if existing is None:
-        created = repository.create_user(
-            nickname=normalized_nickname,
-            password_hash=password_hash,
-            role="student",
-        )
-        session_token, session_record = session_service.issue_session(
-            user_id=created.id,
-            user_agent=request.headers.get("user-agent"),
-        )
-        _set_session_cookie(response, session_service, session_token)
-        return LoginResponse(
-            user_id=created.id,
-            nickname=created.nickname,
-            role=created.role,
-            message="새 계정이 생성되었습니다",
-            session_token=session_token,
-            expires_at=session_record.expires_at.timestamp(),
-        )
-
-    if existing.password_hash != password_hash:
-        raise HTTPException(
-            status_code=status.HTTP_401_UNAUTHORIZED,
-            detail={"message": "비밀번호가 일치하지 않습니다."},
-        )
-
-    session_token, session_record = session_service.issue_session(
-        user_id=existing.id,
-        user_agent=request.headers.get("user-agent"),
-    )
-    _set_session_cookie(response, session_service, session_token)
-    return LoginResponse(
-        user_id=existing.id,
-        nickname=existing.nickname,
-        role=existing.role,
-        message="로그인 성공",
-        session_token=session_token,
-        expires_at=session_record.expires_at.timestamp(),
-    )
+@router.post("/v1/login", response_model=LoginResponse)
+async def login(
+    payload: LoginRequest,
+    response: Response,
+    request: Request,
+    repository: UserRepository = Depends(get_user_repository),
+    session_service: SessionTokenService = Depends(get_session_token_service),
+) -> LoginResponse:
+    normalized_nickname = payload.nickname.strip()
+    if not normalized_nickname:
+        raise HTTPException(
+            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
+            detail={"message": "닉네임을 입력해주세요."},
+        )
+
+    settings = _resolve_settings(request)
+    limiter = _get_login_rate_limiter(request, settings=settings)
+    client_ip = request.client.host if request.client else "unknown"
+    if not limiter.allow(client_ip):
+        login_logger.warning("login rate limit exceeded", extra={"client_ip": client_ip})
+        raise HTTPException(
+            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
+            detail={"message": "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요."},
+        )
+
+    existing = repository.get_by_nickname(normalized_nickname)
+    pepper = settings.password_pepper
+
+    if existing is None:
+        created = repository.create_user(
+            nickname=normalized_nickname,
+            password_hash=secure_hash_password(payload.password, pepper=pepper),
+            role="student",
+        )
+        session_token, session_record = session_service.issue_session(
+            user_id=created.id,
+            user_agent=request.headers.get("user-agent"),
+        )
+        _set_session_cookie(response, request, session_service, session_token)
+        return LoginResponse(
+            user_id=created.id,
+            nickname=created.nickname,
+            role=created.role,
+            message="새 계정이 생성되었습니다",
+            session_token=session_token,
+            expires_at=session_record.expires_at.timestamp(),
+        )
+
+    if not _verify_and_upgrade_password(
+        password=payload.password,
+        record=existing,
+        repository=repository,
+        pepper=pepper,
+    ):
+        raise HTTPException(
+            status_code=status.HTTP_401_UNAUTHORIZED,
+            detail={"message": "비밀번호가 일치하지 않습니다."},
+        )
+
+    session_token, session_record = session_service.issue_session(
+        user_id=existing.id,
+        user_agent=request.headers.get("user-agent"),
+    )
+    _set_session_cookie(response, request, session_service, session_token)
+    return LoginResponse(
+        user_id=existing.id,
+        nickname=existing.nickname,
+        role=existing.role,
+        message="로그인 성공",
+        session_token=session_token,
+        expires_at=session_record.expires_at.timestamp(),
+    )
