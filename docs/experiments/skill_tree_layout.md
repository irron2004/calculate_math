# Skill Tree Layout Experiment Plan

## Overview
- **Experiment name:** `skill_tree_layout`
- **Objective:** Determine whether presenting the curriculum skills as a linear checklist ("list" variant) improves learner engagement compared with the current hierarchical tree ("tree" control).
- **Primary audience:** Logged-in learners browsing the `/skills` surface in the React client and visitors to the API consuming the skill tree endpoint.
- **Experiment owner:** Learning Experience team (PM: TBD, Eng: TBD, DS: TBD).

## Hypothesis
> Switching the skill browsing interface from a columnar tree to a compact list will increase the rate at which learners start a guided practice session.

If the hypothesis is true, we expect to observe:
- Higher click-through from the skill browser to session start actions.
- No degradation in browsing completion (time on page, bounce rate) or problem completion metrics.

## Metrics
### North Star / Success
- **Skill session start rate**: `session_started_from_tree` events per unique visitor to the skill page. Expect ≥ +5% relative lift.
- **Skill launch depth**: Average count of skill nodes opened per visit (derived from `skill_viewed` events). Expect no regression; small improvements indicate better discoverability.

### Guardrails
- **Time to first action**: Median seconds between page load and first `skill_viewed`/`session_started_from_tree` event. Must remain within ±5% of control.
- **Practice completion rate**: Percentage of sessions that submit ≥1 answer (from backend attempt logs). Must not decrease by more than 2 percentage points.
- **Error/monitoring signals**: 4xx/5xx rate on `/api/v1/skills/tree` must stay within historical baseline.

### Logging Sources
- Frontend analytics (`window.analytics.trackEvent`) capturing exposure and interaction metadata.
- Backend structured logs (`calculate_service.experiments` logger) emitting assignment metadata on every API response.

## Rollout Strategy
- **Allocation:** Deterministic hash bucketing targeting 50% treatment (`list`), 50% control (`tree`). Configurable via `SKILL_TREE_LIST_ROLLOUT` environment variable.
- **Persistence:** Variant stored in `exp_skill_tree_layout` cookie (30-day TTL) to keep user experience consistent across sessions and devices that share the cookie.
- **Override:** Staff can QA via query parameter or header overrides (if enabled in future iterations; not part of v1).

## Experiment Design
| Variant | Description | UI expectations |
| --- | --- | --- |
| `tree` (control) | Existing tiered columns grouped by concept. | 3-column layout, emphasis on concept grouping. |
| `list` (treatment) | New compact list sorted alphabetically with inline metadata and explicit CTA buttons. | Single column cards with quick-start buttons, data attributes for monitoring. |

Both variants keep identical data sources and navigation flows to prevent confounding factors.

## Assignment Plumbing
1. `assign_skill_tree_variant` helper in the FastAPI router computes the variant from rollout + hashed subject and emits:
   - `X-Experiment-Skill-Tree-Layout` response header.
   - `exp_skill_tree_layout` HttpOnly cookie for persistence.
   - `experiment` block in JSON payload (`name`, `variant`, `source`, `bucket`, `rollout`, `request_id`).
2. Frontend reads the payload and renders the matching UI. Exposure is logged through `trackExperimentExposure` with the metadata from the backend.
3. Analytics dashboards can filter by variant using the shared experiment name.

## Monitoring Plan
- **Backend:**
  - Add log-based alert if the ratio of `variant='tree'` vs `variant='list'` deviates >10% from expected rollout for ≥5 minutes.
  - Track 4xx/5xx rates on `/api/v1/skills/tree` segmented by variant header.
- **Frontend:**
  - Capture `experiment_exposure` events including `surface=skill_tree_page`. Build Looker/Amplitude chart to confirm exposure counts align with backend assignment volume.
  - Inspect DOM via synthetic checks to ensure `data-experiment-variant` attribute matches the assigned variant.

## Launch Checklist
1. ✅ Ship backend & frontend plumbing behind configurable rollout.
2. ✅ Validate logging in staging (headers, cookies, analytics payloads).
3. ☐ Dry-run analysis script with sample data to confirm schema.
4. ☐ Enable 10% treatment for smoke test; monitor for 1 hour.
5. ☐ Ramp to 50% if guardrails stable; notify stakeholders.

## Analysis Approach
- Primary analysis uses two-sample t-test (or non-parametric alternative) comparing session start rates between variants over a fixed observation window (minimum N = 3k exposures per arm).
- Complement with Bayesian credible intervals on lift to communicate uncertainty.
- Segment by learner tenure (new vs returning) to detect heterogeneous effects.
- Summarize findings in experiment notebook and archive in `/docs/experiments/results/skill_tree_layout.md` post-analysis.

## Rollback Criteria
- Guardrail violations (time to first action or completion rate) beyond thresholds.
- Significant rise in API error rate or analytics exposure mismatches.
- Qualitative feedback from support indicating confusion or degraded usability.

Upon rollback, disable experiment by setting rollout to 0 and redeploy. Retain logs for future iterations.
