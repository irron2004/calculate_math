# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**calculate_math (수학 모험)** is a skill-graph-based math learning platform. A single giant graph spans from basic addition to calculus, organized into four branches from the 2022 Korean curriculum: 수와 연산(NA), 변화와 관계(RR), 도형과 측정(GM), 자료와 가능성(DP). Learning order is determined by skill connections, not grade levels. Nodes are maximally granular (e.g., 1-digit addition → 2-digit addition → 3-digit addition). MVP covers elementary grades 1–4 and high school grade 2.

Students navigate the graph, solve problems, and receive homework. Authors edit and publish curriculum graphs.

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

### Homework admin lookup conventions

For **student homework status lookup**, **submission checking**, and **submitted answer inspection**, prefer the existing admin daily-check APIs:

- `GET /api/homework/admin/students/{student_id}/daily-summary`
  - Use for: what homework the student should have completed by `asOf`, whether it was submitted, late-submitted, or overdue.
- `GET /api/homework/admin/students/{student_id}/assignments/{assignment_id}/submission-status`
  - Use for: re-checking submission presence/status for one assignment.
- `GET /api/homework/admin/submissions/{submission_id}/answer-check`
  - Use for: inspecting submitted problems, student answers, correct answers, and objective auto-check results.

Reference design doc:
- `03_문서/docs/homework_daily_answer_check_v1_be_owner_output.md`

Do not add a new ad-hoc lookup API for these use cases unless the existing admin lookup surface is proven insufficient.

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

## 하네스: 수학 모험 (calculate_math)

**목표:** 교육 연구 중심의 스킬 그래프 기반 수학 학습 서비스를 7명 에이전트 팀(연구원 4 + 개발자 2 + 조교 1)으로 조율.

**트리거:** 커리큘럼 그래프 설계, 문제 출제/숙제 세트, 진단 taxonomy, 주간 KPI 분석, 백엔드·프론트 구현, 숙제 운영 작업 요청 시 `math-adventure-harness` 스킬을 사용하라. 단순 파일 읽기·단일 질문은 직접 응답.

**에이전트·스킬:** `.claude/agents/`, `.claude/skills/` 참조. 오케스트레이터는 `.claude/skills/math-adventure-harness/`.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-23 | 초기 구성 (연구원 4 + 개발 2 + 조교 1) | 전체 | 연구 중심 프로젝트 하네스 신규 구축 |
