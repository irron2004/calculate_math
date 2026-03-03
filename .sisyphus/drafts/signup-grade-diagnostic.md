# Draft: Signup Adjacent-Grade Diagnostic

## Requirements (confirmed)
- Signup collects grade; immediately start a short diagnostic without additional survey.
- Diagnostic item selection: adjacent grades only (previous/next grade relative to signup grade).
- Domain: NA (number & operations) only.
- Total questions: 8.
- Edge grades:
  - If previous/next grade doesn't exist (G1/G6), fill missing side using same-grade questions.
- Result: store and show a simple breakdown for previous-grade vs next-grade performance.
- Diagnostic result MUST change placement recommendation / starting content.

## Technical Decisions (tentative unless noted)
- Use existing onboarding placement entrypoint: redirect signup success to `/onboarding/placement`.
- Seed `sessionStorage` key `onboarding:survey:v1` at signup success so Placement flow can run without survey.
- Introduce a diagnostic mode flag in the seeded survey: `diagnosticMode: 'adjacent-grade-na-v1'`.
- Question plan builder:
  - Load problem bank via `loadProblemBank()` from `curriculum-viewer/src/lib/learn/problems.ts`.
  - Build 8-item plan via `buildAdjacentGradeDiagnostic({ grade, problemsByNodeId })`.
- Persistence shape (proposal): store under student profile `placement` payload as
  - `placement.mode = 'adjacent-grade-na-v1'`
  - `placement.adjacent = { pre: { total, correct }, post: { total, correct }, fill: { total, correct } }`

## Deployment Decisions (confirmed)
- Railway is connected via GitHub auto-deploy.
- Production deploys from `main` branch.
- Therefore release path is: feature branch push → PR to `main` → merge to `main` → Railway deploy → production verification/rollback.

## Research Findings / Notes
- Existing flow expects a survey draft in `sessionStorage` (`onboarding:survey:v1`); if missing, it blocks with a “1-minute survey first” UI.
- Problem bank is keyed by v1 curriculum node ids like `MATH-2022-G-{grade}-NA-...`.
- Need enough NA problems for G5/G6 to satisfy 8-question policy.
- Backend profile storage is flexible:
  - `POST /api/student/profile` accepts `placement: Dict[str, Any]` without internal schema validation.
  - DB stores placement as raw JSON blob (`placement_json`).
  - `estimatedLevel` is required by backend request model; placement itself can be `{}`.
- Placement computation + consumption (current behavior):
  - Placement results are computed client-side in `curriculum-viewer/src/pages/PlacementTestPage.tsx` and persisted via `upsertMyStudentProfile()`.
  - `estimatedLevel` format is `E{grade}-{band}` and is used by homework recommendation.
  - Homework recommendations use `estimatedLevel` + `weakTagsTop3` (not `placement` JSON) in `curriculum-viewer/src/lib/homework/recommendation.ts`.
  - Learning node recommendations (`recommendNextNodeIds`) are progress-based in `curriculum-viewer/src/lib/studentLearning/progress.ts` (not driven by `estimatedLevel`).
  - Placement result CTA currently always links to dashboard in `curriculum-viewer/src/pages/PlacementResultPage.tsx`.

## Scope Boundaries
- INCLUDE: adjacent-grade NA-only diagnostic on signup; store & display simple pre/post results.
- EXCLUDE: multi-domain diagnostics, non-adjacent grade sampling, long surveys, adaptive multi-stage testing.

## Open Questions
- Should diagnostic results influence placement recommendation / starting content, or are they informational only?
- Where should results be shown beyond the placement result page (if anywhere)?
