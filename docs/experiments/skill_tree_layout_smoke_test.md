# Skill Tree Layout · 10% Smoke Test Runbook

## Objectives
- Roll out the `skill_tree_layout` experiment to **10%** of traffic for one hour.
- Confirm analytics plumbing captures exposures and downstream engagement signals without errors.
- Validate guardrail metrics before ramping to the full 50% rollout.

## Prerequisites
- Backend deployed with `app.feature_flags.assign_skill_tree_variant` and logging already validated (see checklist items 1–3).
- Access to deployment configuration (e.g. Fly.io, Render, Kubernetes) where environment variables can be set.
- Monitoring dashboards for:
  - Experiment exposure counts (`experiment_exposure`, grouped by `variant`).
  - Session start events (`session_started_from_tree`).
  - API error rates for `/api/v1/skills/tree`.

## Step-by-step
1. **Set rollout to 10%.**
   - Update the runtime environment variable and restart the service(s):
     ```bash
     export SKILL_TREE_LIST_ROLLOUT=10
     # redeploy / restart command specific to your platform
     ```
   - If using infra manifests, ensure the value is scoped to staging/prod appropriately and document the change.
2. **Warm up the experiment.**
   - Hit `/api/v1/skills/tree` via the React client or API client to confirm both variants appear in responses.
   - Check response headers/cookies: `X-Experiment-Skill-Tree-Layout` and `exp_skill_tree_layout` should reflect either `tree` or `list`.
3. **Verify analytics ingestion.**
   - Pull a 5–10 minute sample from Segment/Amplitude exports and run:
     ```bash
     python scripts/analyze_skill_tree_layout.py path/to/export.jsonl --expected-variant tree --expected-variant list
     ```
   - Confirm both variants register exposures and that the script prints non-zero session-start counts (or at least zeros without schema errors during quiet periods).
4. **Monitor for one hour.**
   - Track the following guardrails in 10-minute intervals:
     - Exposure balance within ±3 percentage points of the 10/90 split.
     - `session_started_from_tree` count for treatment not below the control baseline by >5%.
     - 4xx/5xx error rate on `/api/v1/skills/tree` unchanged relative to control window.
   - Use on-call dashboards or ad-hoc SQL to capture screenshots/links for the experiment log.
5. **Record results.**
   - Log start/end timestamps, dashboards reviewed, and any anomalies in the experiment notebook or shared channel.
   - If guardrails hold, proceed to checklist item 5 (ramp to 50%). If issues arise, roll back by setting `SKILL_TREE_LIST_ROLLOUT=0` and investigate before reattempting.

## Rollback Procedure
- Set `SKILL_TREE_LIST_ROLLOUT=0` and redeploy.
- Invalidate QA cookies by clearing `exp_skill_tree_layout` on affected clients.
- Annotate monitoring dashboards with the rollback timestamp.

## Artifacts
- Analytics dry-run helper: `scripts/analyze_skill_tree_layout.py`
- Sample data for local validation: `docs/experiments/sample_data/skill_tree_layout_sample.jsonl`

