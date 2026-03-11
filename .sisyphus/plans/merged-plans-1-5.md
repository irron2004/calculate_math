# Plan: merged-plans-1-5

## TL;DR

> Execute these 5 existing work plans as a single coordinated work session, with explicit overlap/ordering guardrails:
> 1) `homework-log-rendering-fix`
> 2) `homework-due-date-extend-1w`
> 3) `research-graph-readability`
> 4) `homework-problem-bank-assignment`
> 5) `opencode-ultra-research-process`

This plan is a **merged orchestrator**: it keeps one top-level TODO list for progress tracking, while each workstream’s detailed steps and QA scenarios remain in its original plan file.

---

## Context

### User Request
- Merge plan #1-#5 into one combined execution plan.

### Included Workstreams (source plans)
- Workstream A: Math-friendly rendering across all screens
  - Source: `.sisyphus/plans/homework-log-rendering-fix.md`
- Workstream B: Admin “extend due date by 1 week” button
  - Source: `.sisyphus/plans/homework-due-date-extend-1w.md`
- Workstream C: Research graph overview-first readability
  - Source: `.sisyphus/plans/research-graph-readability.md`
- Workstream D: Homework problem bank + per-student assignment
  - Source: `.sisyphus/plans/homework-problem-bank-assignment.md`
- Workstream E: OpenCode Ultra Research Process (ULR) plugin hardening
  - Source: `.sisyphus/plans/opencode-ultra-research-process.md`

---

## Cross-Workstream Overlaps (Guardrails)

These files are touched by multiple workstreams; avoid parallel edits here unless you intentionally batch changes in one PR/commit.

- `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx`
  - Touched by: Workstream A (formatting) + Workstream B (due date button)
  - Guardrail: land Workstream B UI wiring first (or in the same batch), then apply Workstream A formatting changes to the same view to avoid merge churn.

- `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`
  - Touched by: Workstream C (overview/editor mode) + Workstream A (prompt formatting)
  - Guardrail: implement Workstream C structural changes first; then integrate prompt formatting while updating/repairing tests.

- `curriculum-viewer/src/pages/AuthorHomeworkPage.tsx` and `curriculum-viewer/src/lib/homework/types.ts`
  - Touched by: Workstream D (problem bank + types split) + Workstream A (author previews)
  - Guardrail: types/contracts from Workstream D should land before Workstream A’s preview changes that rely on those types.

---

## Verification Strategy (Global)

Each workstream already contains its own per-task QA scenarios; the combined run must additionally pass these global checks:

### Frontend
```bash
cd curriculum-viewer
npm run test
npm run build
npm run test:e2e
```

### Backend (only if Workstream D/B touches backend)
```bash
pytest backend/tests -q
```

### OpenCode plugin
```bash
cd .plugins/oh-my-opencode-ulr
bun test
bun run typecheck
```

---

## Execution Strategy

### Parallelization Rule
- Run different workstreams in parallel **only** when they do not touch the overlap files listed above.
- Use the source plans’ internal wave structure as the default.

### Suggested High-Level Order (to minimize conflicts)
1) Workstream E (plugin) in parallel with everything (independent)
2) Workstream D foundation/backend contracts early (types + DTO separation)
3) Workstream C structural page changes (AuthorResearchGraphPage)
4) Workstream A renderer + CSS early; apply page formatting after D/C land for overlap files
5) Workstream B (due date button) coordinated with A for AuthorHomeworkStatusPage

---

## TODOs

- [x] 1. Workstream E — Execute ULR plugin plan end-to-end

  Source: `.sisyphus/plans/opencode-ultra-research-process.md`

  Acceptance:
  - All TODO checkboxes in the source plan completed
  - `cd .plugins/oh-my-opencode-ulr && bun test` PASS
  - `cd .plugins/oh-my-opencode-ulr && bun run typecheck` PASS

- [x] 2. Workstream D — Execute problem bank + per-student assignment plan end-to-end

  Source: `.sisyphus/plans/homework-problem-bank-assignment.md`

  Acceptance:
  - All TODO checkboxes in the source plan completed
  - Student API responses do not contain `answer`
  - Backend + frontend tests PASS (per source plan)

- [x] 3. Workstream C — Execute research graph readability plan end-to-end

  Source: `.sisyphus/plans/research-graph-readability.md`

  Acceptance:
  - Overview mode is default
  - Unit tests PASS (per source plan)
  - (If added) Playwright smoke PASS

- [x] 4. Workstream A — Execute math-friendly rendering plan end-to-end

  Source: `.sisyphus/plans/homework-log-rendering-fix.md`

  Acceptance:
  - Renderer supports `log_...`, `^...`, and stacked fractions with guardrails
  - Applied consistently across all required screens
  - Vitest + Playwright smoke PASS

- [x] 5. Workstream B — Execute due date +7d extension plan end-to-end

  Source: `.sisyphus/plans/homework-due-date-extend-1w.md`

  Acceptance:
  - Button appears only when at least one student is unsubmitted
  - Clicking extends assignment-level dueAt by +7 days via existing PATCH
  - Frontend + backend regression tests PASS (per source plan)

- [x] 6. Cross-Workstream Integration Pass

  **What to do**:
  - Re-run the overlap-file list and ensure all overlapping changes were integrated without regressions.
  - Run the global verification commands in this merged plan.

  Acceptance:
  - All global verification commands PASS
  - No unresolved TODOs remain in any source plan

---

## Final Verification Wave (Merged)

- [x] F1. End-to-end repo verification

  **What to do**:
  - Run the global verification commands and capture logs.
  - Smoke the two public, no-login routes:
    - `https://math.ruahverce.com/onboarding/placement` (fraction rendering)
    - `https://math.ruahverce.com/author/research-graph` (overview default; if auth required, verify locally via Playwright)

  Evidence:
  - `.sisyphus/evidence/f1-merged-verification.txt`
