---
title: BE 12‑Week Execution Plan (Phase‑1)
author: BE Lead
date: 2025-11-11
status: active
type: be-plan
---

# Scope & Principles
- Phase‑1 scope: C01/C03/C05 × S1/S2, 30 templates, 10–12 weeks.
- Unlock rule: ALL + min_level; Boss pass 80/100; List view is first‑class in FE.
- Data SoT: BE computes `unlocked` + `progress` and owns graph version/ETag.
- Error policy: RFC 9457 Problem Details end‑to‑end; include `request_id`.

# Milestones (by Sprint)
- Sprint 1 (W1–W2): Skeletons
  - DAG validate→build (`graph.bipartite.json` → `app/data/skills.ui.json` with version).
  - OpenAPI skeleton; `/api/v1/skills/tree`, `/api/v1/problems/generate`, `/api/v1/skills/progress` stubs.
  - MQG‑P1 test harness (CI blocking).
  - DoD: FE renders Tree & List from same contract; CI red on DAG/MQG breaches.
- Sprint 2 (W3–W4): Learning loop
  - XP/level engine (cap 3), `new_unlocked_ids`, session/boss/remedial events.
  - SessionEnd support (FE toast→auto‑focus) & boss‑fail remedial CTA context.
- Sprint 3 (W5–W6): Boss/Perf/Conversion
  - Boss flow unlock; /skills/tree p95 < 300ms@100RPS (ETag, cache).
  - Conversion trigger for “S2 second completion”. Parent report v1 API.
- Sprint 4 (W7–W8): Templates/Pilot A
  - `/problems/generate` params/variants; rate limit; MQG‑P1 100% pass.
  - Pilot A export (anonymized attempts with seed/variant logs).
- Sprint 5–6 (W9–W12): Harden/Beta
  - Auth/rate‑limit polish; PD taxonomy; dashboards; runbooks & SLOs.

# Deliverables & DoD
- OpenAPI (`api/openapi.yaml`, `docs/api/api_spec_v1.0.md`): 200 + PD examples; spectral lint in CI.
- `/api/v1/skills/tree`: payload includes `graph_version`; ETag support; validates against OpenAPI.
- `/api/v1/problems/generate`: deterministic by `seed`; returns `constraints_passed` and `difficulty_hint`.
- `/api/v1/skills/progress`: idempotent by session key; returns `new_unlocked_ids`.
- CI: DAG rules (unique/cycle/orphan/tier/ALL), MQG‑P1 suite (dup=0%, ≥99.5% property pass), OpenAPI lint.

# Ownership & Interfaces
- Owners: BE Lead (contracts, PD, cache); BE Dev (MQG/DAG CI, progress service).
- Interfaces: Content (AS tables), FE (types/events), PM/UX (copy, report schema), Growth (AB flags, analytics).

