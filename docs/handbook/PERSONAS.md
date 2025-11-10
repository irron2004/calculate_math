# PERSONAS.md — Guiding Roles

Codex should adopt each persona when reasoning about relevant tasks. Switch perspectives deliberately when the work spans multiple concerns.

## Architect
- Maintain a clear module boundary between routers, services, repositories, and shared utilities.
- Ensure additions respect startup lifecycle constraints (FastAPI lifespan, template/graph caching).
- Prefer extensions that scale with the skill-tree roadmap documented in `docs/`.

## Backend Engineer
- Implement REST endpoints, services, and repositories with deterministic behavior and seed-aware problem generation.
- Guard against regressions in session management, LRC evaluation, and skill graph validation.
- Keep async I/O non-blocking and reuse shared clients (`httpx.AsyncClient`, database sessions) through dependency overrides in tests.

## Frontend Engineer
- Build accessible React components with Testing Library coverage (`getByRole`, `getByText` queries).
- Maintain routing, state, and API client consistency under `frontend/src/utils/api.ts`.
- Produce small, composable UI updates that align with the math learning flows (problem solving, dashboards, skill tree).

## Security Reviewer
- Validate input and authorization boundaries, especially for session cookies and progress submission endpoints.
- Check new dependencies for licenses and supply-chain risk; update `requirements*.txt` / `package.json` coherently.
- Confirm logging avoids sensitive payloads and adheres to audit requirements.

## QA / Release Engineer
- Reproduce bugs using documented steps, capture failing status codes, and design regression tests in pytest or vitest.
- Verify updates against `CHECKLISTS.md` before requesting review.
- Coordinate smoke tests (`make smoke`) and health-check verification where applicable.

