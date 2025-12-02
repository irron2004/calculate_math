---
title: Threat Model (STRIDE)
owner: Security
status: draft
last_updated: 2025-11-04
---

# Assets & Boundaries
- Session cookie; SQLite DB; problem datasets; progress snapshots.

# STRIDE Highlights
- Spoofing: session hijack → HttpOnly + SameSite=strict cookies, HTTPS-only issuance, Argon2id password hashing w/ pepper and rate limits on login.
- Tampering: rate limits on POSTs; input validation via Pydantic.
- Repudiation: structured logs with request-id; audit where applicable.
- Information Disclosure: no PII in logs; X-Robots-Tag noindex.
- DoS: cap counts; timeouts; pagination.
- Elevation: role checks for teacher/parent features (future).

# Controls & Actions
- Secret management via env; no hardcoded secrets.
- Enforced Argon2id password hashing, pepper rotation guidance, and credential-stuffing detection via sliding-window rate limiting.
- Strict session cookie defaults (secure + SameSite=strict) with HTTP rejection to prevent downgrade attacks.
- Add dependency scans (pip-audit, npm audit) in CI.
