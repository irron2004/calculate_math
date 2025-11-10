---
title: API Contracts Overview (Phase‑1)
author: BE Lead
date: 2025-11-11
status: active
type: be-api
---

# Endpoints (v1)
- `GET /api/v1/skills/tree`
  - Returns: `graph_version`, projection (nodes/edges/skills/palette/groups), `progress`, `unlocked`, optional `ui_graph` snapshot.
  - Headers: `ETag: <graph_version>`; support `If-None-Match` → 304 Not Modified.
  - Errors: RFC 9457 (401/404/422/500) with `request_id`.
- `POST /api/v1/skills/progress`
  - Body: session summary (course_step_id, attempts, correct, session_key?)
  - Returns: `new_unlocked_ids`, updated `progress`.
  - Idempotent on `session_key`.
- `GET /api/v1/problems/generate`
  - Query: `op, digits, count, seed`
  - Returns: `items[], operation, digits, seed, constraints_passed, difficulty_hint`.

# Problem Details (RFC 9457)
- Use a central builder: `{type,title,status,detail,instance,request_id}`.
- Map validation/auth/data‑not‑found consistently.

# OpenAPI
- `api/openapi.yaml` (skeleton in Week 1) and `docs/api/api_spec_v1.0.md` reference.
- CI: spectral lint; FE types generation pipeline.

# Versioning & Cache
- Graph version: UTC+SHA8 embedded in `skills.ui.json` during build.
- ETag: mirror graph_version, cache per version in memory.

