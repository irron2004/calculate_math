# Security Hardening Report — 2025-12-02-1

## Authentication Storage
- Password hashing now uses Argon2id (`libargon2`) with 64 MiB memory cost, pepper sourced from `PASSWORD_PEPPER`, and automatic rehashing when parameters tighten.
- Legacy SHA-256 hashes continue to verify but are transparently upgraded on successful login; persisted credentials therefore migrate without downtime.

## Session Management
- `SESSION_COOKIE_SECURE` defaults to `True` and cookies are issued with `SameSite=strict` plus `HttpOnly`.
- `_set_session_cookie` enforces HTTPS transport when `session_cookie_secure=True`, preventing insecure issuance during misconfigured deployments.
- Session TTL shortened to 60 minutes by default to minimize replay windows.

## Abuse & Observability
- Sliding-window login rate limiter (default 6 attempts per minute) blocks credential stuffing attempts per IP.
- Structured error payloads expose `fallback_reason` metadata for missing UI graphs, improving telemetry correlation on `/api/v1/skills/tree`.

## Validation & Tests
- Added regression tests covering UI graph fallback scenarios, Argon2 migration, rate limiting, and HTTPS cookie enforcement (`tests/test_skills_router.py`, `tests/test_api.py`).

These changes close the spoofing and repudiation risks called out in the senior engineer report and prepare documentation (see `docs/THREAT_MODEL.md`).
