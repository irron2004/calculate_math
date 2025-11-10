---
title: Test Strategy
owner: QA
status: draft
last_updated: 2025-11-04
---

# Scope & Targets
- Unit tests (backend services, repositories) → ≥70% coverage.
- Integration (FastAPI routes via httpx.AsyncClient).
- FE unit tests (Vitest/RTL) for key components.
- (Optional) e2e smoke (Playwright): login → create session → fetch problems.

# Environments
- Local dev (make dev; npm run dev)
- CI: pytest -q, CI=1 npm test -- --run

# Gate
- Lint/format pass; core e2e pass; zero high vulnerabilities; openAPI synced.
