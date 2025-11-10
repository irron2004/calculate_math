# WORKFLOWS.md — Repeatable Routines

Follow these end-to-end flows when tackling common tasks. Each workflow assumes the Plan → Commands → Diff → Verify cadence described in `AGENTS.md`.

## Backend Bugfix (API Regression)
1. Document reproduction steps (endpoint, payload, expected vs. actual) in the Plan.
2. Re-run failing curl/pytest commands to capture logs and `X-Request-ID`.
3. Patch the minimal router/service/repository code while preserving deterministic seeds and caching rules.
4. Add pytest coverage under `tests/` that fails before the fix and passes afterward.
5. Update relevant docs (API reference, changelog) and include expected pytest output in the Verify section.

## Frontend Feature or UI Improvement
1. Align on the target route/component and list affected files before editing.
2. Implement the change using TypeScript types located in `frontend/src/types/`, leveraging shared utilities.
3. Write or update vitest specs (`*.test.tsx`) covering rendering, interactions, and error states.
4. Capture screenshots or GIFs for reviewers if the UI changes visibly.
5. Summarize testing expectations (`npm test -- --run`) and link to CHECKLISTS.md items in the PR body.

## Skill Graph / Content Update
1. Modify source materials (`docs/dag.md`, `graph.bipartite.json`, or template JSON) using reproducible scripts (`scripts/dag_to_skills.py`, `scripts/validate_skills.py`).
2. Validate graph consistency and SkillSpec invariants via the provided scripts; note their commands in the Commands section.
3. Adjust backend loaders or cache invalidation logic if the schema shifts.
4. Refresh frontend skill-tree assets or snapshots if node/edge labels changed.
5. Record the new content rationale inside `docs/` and mention coverage impacts (e.g., new snapshot tests) during Verify.

