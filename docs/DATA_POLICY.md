---
title: Data Policy
owner: Security
status: draft
last_updated: 2025-11-04
---

# Data Classes
- Auth/session (non-PII nickname) — protect cookies; minimal retention.
- Attempts & progress — non-PII, avoid personal identifiers.

# Retention
- Sessions: TTL per config; inactive cleanup.
- Logs: retain minimal metadata; no PII.

# Encryption & Masking
- TLS in transit; mask tokens in logs; never log passwords.

# Access
- Least privilege for runtime; avoid exposing DB files.
