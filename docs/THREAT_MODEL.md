---
title: Threat Model (STRIDE)
owner: Security
status: draft
last_updated: 2025-11-04
---

# Assets & Boundaries
- Session cookie; SQLite DB; problem datasets; progress snapshots.

# STRIDE Highlights
- Spoofing: cookie theft → use httponly, sameSite=lax, secure in prod.
- Tampering: rate limits on POSTs; input validation via Pydantic.
- Repudiation: structured logs with request-id; audit where applicable.
- Information Disclosure: no PII in logs; X-Robots-Tag noindex.
- DoS: cap counts; timeouts; pagination.
- Elevation: role checks for teacher/parent features (future).

# Controls & Actions
- Secret management via env; no hardcoded secrets.
- Add dependency scans (pip-audit, npm audit) in CI.
