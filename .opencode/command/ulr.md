---
description: "Start Ultra Research (ULR) document-first process"
argument-hint: "[topic-or-problem]"
---

<command-instruction>
Activate the Ultra Research (ULR) process.

## Objective

Run a round-based, document-first research workflow that converges to a reproducible experiment plan.

## Required Artifacts

Create/update these files at the end of every round:
- .sisyphus/ulr/<topic>/brief.md
- .sisyphus/ulr/<topic>/research_log.md
- .sisyphus/ulr/<topic>/hypotheses.md
- .sisyphus/ulr/<topic>/experiment_plan.md
- .sisyphus/ulr/<topic>/decision_log.md
- (optional) .sisyphus/ulr/<topic>/ulr.state.json

## Spec

Use `docs/ulr-ultra-research-plan.md` as the source of truth.

Non-negotiable rules:
- Every claim must include an evidence tag: [evidence: experiment|literature|codebase|reasoning]
- Every round must record KEEP / HOLD / KILL decisions for hypotheses
- Round 3 MUST produce an executable experiment plan (inputs, metrics, baseline, procedure, pass/fail)
- No round may end without updating the artifact files

## Round Protocol (0-3)

Round 0: Brief lock
- Define the problem, success criteria, constraints, and available assets.
- Create the research doc skeleton.

Round 1: Diverge (parallel)
- Explorer generates 8-15 hypotheses.
- Each hypothesis includes a minimal falsifiable experiment.

Round 2: Critique
- Reality Checker: feasibility cut (time/asset/risk/complexity) -> KEEP/HOLD/KILL.
- Evidence Auditor: supporting/refuting/missing evidence.

Round 3: Converge
- Chair converges to top 1-2 directions.
- Finalize experiment_plan.md.

Optional Round 4+: Handoff
- Generate prioritized TODOs for implementation mode (ULW).

## Wave Shape

- Wave 1: Explorer (+ optional librarian/asset scout)
- Wave 2: Reality Checker + Evidence Auditor
- Wave 3: Chair synthesis + document updates
</command-instruction>

<user-request>
$ARGUMENTS
</user-request>
