# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**calculate_math** is a curriculum visualization and learning platform for Korean math education. Students navigate a graph-based curriculum map, solve problems, and receive homework assignments. Authors edit and publish curriculum graphs.

**Stack:** Vite + React 18 + ReactFlow (frontend) · FastAPI + SQLite/Neo4j (backend)

## Commands

### Frontend (`curriculum-viewer/`)

```bash
npm run dev              # Dev server on :5173, proxies /api → :8000
npm run build            # TypeScript check + Vite build
npm run test             # Vitest (unit, jsdom)
npm run test:watch       # Vitest in watch mode
npm run test:e2e         # Playwright (starts both servers automatically)
npm run validate:data    # Validate curriculum JSON schema
```

### Backend (`backend/`)

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pytest                   # Backend tests (uses tmp SQLite, DISABLE_RATE_LIMITS=1)
```

### Full verification

```bash
make verify   # test → build → validate:data
make smoke    # validate:data → build (no tests)
```

### Docker

```bash
docker-compose up        # Full stack (backend :8000 + frontend :5173)
```

## Architecture

### Frontend (`curriculum-viewer/src/`)

Three nested context providers wrap the app:

1. **AuthProvider** — JWT auth, user state, student/author mode toggle. Tokens in sessionStorage.
2. **CurriculumProvider** — Fetches published graph from `/api/graph/published`, validates schema, builds lookup index.
3. **RepositoryProvider** — Creates graph/problem/session repositories for data access.

Components consume these via `useAuth()`, `useCurriculum()`, `useRepositories()` hooks.

**Key routes:**
- `/map` — ReactFlow graph visualization (student view)
- `/learn/:nodeId` — Learning content + scratchpad
- `/eval/:sessionId` — Problem solving assessment
- `/author/*` — Graph editing, validation, publishing (admin only)
- `/homework/:id` — Homework submission

**Graph rendering:** ReactFlow + Dagre layout. Node types: subject, grade, domain, standard. Learning status colors: CLEARED (green), AVAILABLE (blue), IN_PROGRESS (amber), LOCKED (gray).

### Backend (`backend/app/`)

- `main.py` — FastAPI app with lifespan, CORS, slowapi rate limiting
- `api.py` — All route handlers (auth, graph, homework, grades, stickers)
- `db.py` — SQLite operations and schema initialization
- `auth.py` — JWT (HS256) + bcrypt authentication
- `graph_storage.py` — Abstraction over SQLite or Neo4j graph backends
- `neo4j_graph.py` — Neo4j graph operations (optional)
- `graph_patch.py` — Graph editing operations

**Graph versioning:** Draft graphs are edited by authors, then published as immutable snapshots that students see.

### Data

- `public/data/curriculum_math_2022.json` — Curriculum seed data
- `backend/data/app.db` — SQLite database (runtime)

## Environment

Copy `.env.example` to `.env`. Key variables:

- `JWT_SECRET` — Required for auth
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_AUTH_EMAIL` — Bootstrap admin user
- `GRAPH_STORAGE_BACKEND` — `sqlite` (default) or `neo4j`
- `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` — If using Neo4j
- `CORS_ORIGINS` — Frontend URL for production
- `DISABLE_RATE_LIMITS` — Set to `1` for tests/dev
- `DATABASE_PATH` — SQLite path (default: `backend/data/app.db`)

## Testing

**Frontend tests** use Vitest + @testing-library/react + jsdom. Setup in `src/setupTests.ts` polyfills ResizeObserver for ReactFlow.

**Backend tests** use pytest with FastAPI TestClient. Each test gets a temp SQLite DB via `tmp_path` fixture. Rate limits auto-disabled.

**E2E tests** (Playwright) run serially, timeout 90s, use a separate DB at `/tmp/calculate-math-e2e.db`.

## Neo4j Schema (when using Neo4j backend)

Documented in `backend/CURRICULUM_GRAPH_SCHEMA_V2.md`. Nodes: `:GraphVersion`, `:GraphNode`, `:Problem`. Migration script: `scripts/migrate_graph_to_neo4j.py`.
