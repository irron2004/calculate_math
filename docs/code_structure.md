# Calculate Math Code Structure

## Overview
- **Purpose**: Serve arithmetic practice content via FastAPI with optional React frontend at `/math/`.
- **Entry point**: `app/__init__.py` builds the FastAPI instance, sets up caching lifecycles, mounts static assets, and wires routers.
- **Deployable unit**: Root `Dockerfile` builds both the backend (Python) and frontend (React) bundles; `make run` or `docker compose` starts services locally.

## Application Startup
- `app/__init__.py`
  - `create_app()` reads configuration (`app/config.py`), builds shared caches, and populates `app.state`.
  - Lifespan handler refreshes problem/template caches and repositories on startup; teardown clears them.
  - Mounts `/static` for bundled JS and `/math/` for the React build when `frontend/dist` exists.
  - Middleware: `RequestContextMiddleware` (from `app/instrumentation.py`) tracks `X-Request-ID` and telemetry.
- `app/main.py` is the minimal `uvicorn` entrypoint for CLI execution.

## Configuration & Data Sources
- `app/config.py`: reads environment variables (.env auto-loaded), providing paths to problem data, templates, DAG graph, and SQLite files.
- `app/problem_bank.py`, `app/template_engine.py`: load JSON definitions for problems and templates, caching them in memory.
- `app/skills_loader.py`, `app/dag_loader.py`, `app/curriculum_graph.py`: parse skill-tree graphs and DAG progress models.
- `app/progress_store.py`, `app/repositories.py`: wrap persistence (SQLite, JSON) for attempts, sessions, and progress snapshots.

## Routers & APIs
- Routers live in `app/routers/`. Each module exposes `router` (FastAPI `APIRouter`) and sometimes `get_router()` for template injection.
  - `pages.py`: server-rendered HTML routes (`/`, `/home`, `/skills`, `/problems`). Home redirects to `/math/` if the React bundle is available.
  - `problems.py`, `practice.py`: generate problem sets and practice sessions.
  - `skills.py`: `/api/v1/skills/*` endpoints using feature flags (`app/feature_flags.py`) to serve tree/list variants.
  - `bridge.py`, `curriculum.py`, `dag.py`, `metrics.py`, `invites.py`: supporting APIs for progress, curriculum navigation, metrics, and invites.
  - `health.py`: liveness/readiness endpoints.
- Dependencies (`app/dependencies/*`) provide authentication helpers and shared state access.
- Schemas and services under `app/schemas/` and `app/services/` model API payloads and domain logic (skill projections, metrics, problem generation).

## Instrumentation & Telemetry
- `app/instrumentation.py` configures OpenTelemetry exporters and attaches middleware to propagate trace context and request IDs.
- `app/feature_flags.py` assigns experiment variants (skill tree layout) via deterministic bucketing and cookies/headers.

## Frontend (React + Vite)
- Location: `frontend/`
  - `src/` contains React components (dashboards, games, skill tree graph), contexts, and utilities.
  - `utils/api.ts` centralizes REST calls with `VITE_API_BASE_URL`.
  - `vite.config.ts` sets base path to `/math/`.
  - `Dockerfile` builds static assets; the root Dockerfile reuses this logic in its first stage.

## Build & Deployment
- **Docker multi-stage**:
  1. `node:18-alpine` builds `frontend/dist`.
  2. `python:3.11-slim` installs backend deps, copies FastAPI code + React build, and launches `uvicorn`.
- `docker-compose.yml` orchestrates separate backend/frontend containers for local development with port mapping (`8000`, `5173`).
- `Makefile` shortcuts (`make dev`, `make run`, `make smoke`, `make test`) manage virtualenv setup and testing.

## Testing Strategy
- Backend tests: `tests/` (pytest). `tests/test_pages.py` exercises redirects and HTML rendering; other files cover APIs, DAG logic, and repositories.
- Shared fixtures live in `testing_utils/` and `tests/conftest.py`.
- Frontend tests: `frontend/src/__tests__/` (Vitest + Testing Library).

## Supporting Docs & Scripts
- `docs/` directory hosts product specs, architecture notes, and now this structure guide.
- `scripts/` contains data tooling (graph validation, template generation).
- `tools/` and `.codex/` provide CLI automation helpers for Codex workflows.

## Suggested Mapping Workflow
1. Start at `app/__init__.py` to understand lifecycle and router wiring.
2. Inspect `app/routers/` for request flows; cross-reference services and schemas for domain logic.
3. Review `app/config.py` for runtime settings and data file locations.
4. Traverse `frontend/src/` alongside `/math/` routes to see which API endpoints power the React UI.
5. Use `tests/` as executable documentation for API behaviors and cache management.
