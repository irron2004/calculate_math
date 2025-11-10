---
title: MQG-P1 Quality Gates — Problems API
author: BE Lead
date: 2025-11-11
status: active
type: be-quality
---

Gates (Phase 1 minimum)
- In-session duplicate guard: 0% duplicates (recent N=50 seeds blacklist per user).
- Property tests: >= 100 draws/template; value/range/precision checks pass >= 99.5%.
- Constraints and invariants: e.g., sum/area invariants when applicable.
- Manual uniqueness sampling: 10% of templates per release.
- Structured logs: `attempt_id, user_id_pseudo, item_id(template+seed), correct, rt_ms, skills[], variant_params, constraints_passed`.

CI integration
- Dedicated job that runs property tests and fails the PR on regression.
- Attach a short report artifact (template id, checks, pass rates).
- Block merge on failures; require re-run after fixes.

API contract additions
- `/api/v1/problems/generate` response includes:
  - `seed`: number
  - `constraints_passed`: boolean
  - `difficulty_hint`: string (`easy|medium|hard`)

