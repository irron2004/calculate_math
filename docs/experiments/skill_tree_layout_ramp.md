# Skill Tree Layout · 50% Ramp Plan

## Objectives
- Increase the `skill_tree_layout` experiment rollout from 10% smoke-test traffic to a 50/50 split.
- Ensure long-running monitoring and analytics pipelines stay healthy during the ramp.
- Communicate rollout status and guardrail findings to stakeholders.

## Before You Start
- Smoke test (10% rollout) completed with guardrails passing; notes captured per `skill_tree_layout_smoke_test.md`.
- No open Sev2+ incidents related to `/api/v1/skills/tree` or experiment analytics.
- Stakeholders (Learning Experience PM/DS, On-call ENG) notified of planned ramp window.

## Ramp Procedure
1. **Update rollout configuration.**
   ```bash
   export SKILL_TREE_LIST_ROLLOUT=50
   # redeploy / restart command specific to your platform
   ```
   - If using infrastructure manifests, commit the updated value and tag the deployment.
   - Confirm the environment variable propagates across all instances (API + worker tiers if applicable).
2. **Validate assignment plumbing.**
   - Hit `/api/v1/skills/tree` endpoints for 3–5 unique users (or incognito sessions) and confirm roughly even distribution between `tree` and `list` variants.
   - Check response metadata: `X-Experiment-Skill-Tree-Layout` header and `exp_skill_tree_layout` cookie should alternate between variants.
3. **Analytics spot-check (15 minutes post-deploy).**
   - Export a short analytics sample and run:
     ```bash
     python scripts/analyze_skill_tree_layout.py path/to/export.jsonl --expected-variant tree --expected-variant list
     ```
   - Verify exposure counts for both variants grow at comparable rates and schema validation passes.
4. **Monitor key guardrails for 24 hours following ramp.**
   - **Exposure balance:** Variant exposure ratio stays within ±5 percentage points of the expected 50/50 split.
   - **Session starts:** `session_started_from_tree` treatment variant not below control by >5% relative.
   - **Error rate:** 4xx/5xx on `/api/v1/skills/tree` unchanged from pre-ramp baseline.
   - Log findings (screenshots/links) in the experiment thread or notebook at ~1h, ~6h, and ~24h marks.
5. **Stakeholder communication.**
   - Announce successful ramp in the #calc-design, #calc-content, and experiment owner channels.
   - Outline next planned analysis window and when a go/no-go decision will be made for full rollout or shutdown.

## Rollback Plan
- Set `SKILL_TREE_LIST_ROLLOUT` back to the previous value (usually 0 or 10) and redeploy.
- Notify stakeholders immediately; record the reason for rollback and attach relevant dashboards.
- Capture affected sessions via analytics export for debugging.

## Artifacts & References
- Smoke test runbook: `docs/experiments/skill_tree_layout_smoke_test.md`
- Dry-run validator: `scripts/analyze_skill_tree_layout.py`
- Experiment plan: `docs/experiments/skill_tree_layout.md`

