---
title: BE Refactor Checklist (Phase‑1)
author: BE Lead
date: 2025-11-11
status: active
type: be-refactor
---

# P0 — Namespaces, PD, Contracts
- Unify problems endpoints under `/api/v1/problems/*` (deprecate `/api/problems`).
- Centralize RFC9457 Problem Details factory (`app/core/errors.py`) + global handlers.
- `/api/v1/skills/tree`: add `graph_version` and ETag; respond 304 on `If-None-Match`.
- `/api/v1/problems/generate`: include `constraints_passed`, `difficulty_hint`.
- Pydantic v2 idioms: `model_validate()`/`model_dump()` (replace `parse_obj`/`dict`).

# P1 — Progress, Cache, OpenAPI, Logs
- `/api/v1/skills/progress`: idempotency key (session), race‑proof update.
- Cache & perf: p95<300ms@100RPS for `/skills/tree` with in‑mem cache by version.
- OpenAPI skeleton + spectral CI; FE types generation pipeline.
- Attempt log schema (seed/variant); emit session/boss/remedial events.

# P2 — Hardening
- Rate limits (problems/progress); auth polish.
- PD taxonomy doc; dashboards; runbooks & SLOs.

