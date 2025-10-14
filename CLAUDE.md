# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Calculate Math Service is an educational FastAPI + React application providing elementary math problems with a skill-tree-based learning system. The service offers problem generation, session management, and a bipartite graph-based curriculum structure mapping skills to course steps.

## Architecture

### Backend (FastAPI)
- **Monolithic FastAPI app** with router-based modularization
- **Template-based problem generation**: Concepts and templates defined in JSON, instantiated via `TemplateEngine` with seed-based deterministic generation
- **Bipartite skill graph**: Skills (atomic abilities) and course steps (learning units) connected via `requires`/`teaches`/`enables` edges in `graph.bipartite.json`
- **SQLite repositories**: `AttemptRepository`, `UserRepository`, `SessionRepository`, `LRCRepository` for persistence
- **OpenTelemetry instrumentation**: Tracing/metrics with OTLP export; `X-Request-ID` propagation via custom middleware
- **Lifespan startup**: Problem bank, template engine, DAG progress store, and bipartite graph loaded at startup and cached in `app.state`

### Frontend (React + TypeScript)
- **Vite-based dev server** with `/math` base path for deployment
- **React Router** for navigation (`/`, `/login`, `/math`, `/skills`, `/student-dashboard`, etc.)
- **MathGame component**: 20-problem sessions with real-time feedback and step navigation
- **SkillTreePage + SkillTreeGraph**: Interactive visualization of bipartite skill graph with lens-based coloring

### Data Flow
1. **Problem generation**: `TemplateEngine.instantiate(template_id, seed=...)` → `ItemInstance` with prompt/answer/options
2. **Session creation**: `POST /api/v1/sessions` → generates 20 problems from selected concept/step
3. **LRC evaluation**: `POST /api/v1/lrc/evaluate` → aggregates accuracy/RT/rubric → returns pass/fail + recommendation
4. **Skill tree**: Bipartite graph loaded from `graph.bipartite.json` → rendered as interactive graph with skill/course nodes and edges

## Common Commands

### Backend
```bash
# Development setup
make dev                    # Install dev dependencies (requirements-dev.txt)
make run                    # Start uvicorn dev server at :8000 with reload

# Testing
make test                   # Run pytest with coverage
pytest tests/routers/       # Test specific router module
pytest -k test_template     # Run tests matching pattern

# Linting
make lint                   # Validate skill graph DAG + compile app/
python scripts/validate_skill_graph.py  # Validate bipartite graph
```

### Frontend
```bash
cd frontend
npm install                 # Install dependencies
npm run dev                 # Vite dev server at :5173
npm run build               # TypeScript check + production build
npm test                    # Run vitest tests
npm run lint                # ESLint check
```

### Scripts
- `scripts/validate_skill_graph.py`: Validates bipartite graph structure (cycles, missing nodes, edge constraints)
- `scripts/check_skill_tree_assets.py`: Verifies skill IDs against frontend config
- `scripts/dag_to_skills.py`: Converts DAG format to bipartite skill graph

## Key Modules and Patterns

### Backend Core
- `app/__init__.py`: Creates FastAPI app with lifespan context, mounts static files, includes all routers
- `app/config.py`: Dataclass-based settings from environment vars; `.env` file auto-loaded
- `app/template_engine.py`: `TemplateEngine` class for loading concepts/templates from JSON; `instantiate()` generates problems with safe expression evaluation (allowlist of operators/functions)
- `app/problem_bank.py`: Legacy problem bank (being phased out in favor of template engine)
- `app/bipartite_loader.py`: Loads and caches bipartite graph from `graph.bipartite.json`
- `app/repositories.py`: SQLite CRUD for attempts/users/sessions/LRC results with thread-safe locking

### Backend Routers
- `routers/problems.py`: Legacy problem API (`/api/problems`, `/api/problems/generate`)
- `routers/practice.py`: Session management (`POST /api/v1/sessions`, `GET /api/v1/sessions/{id}`)
- `routers/curriculum.py`: Template engine API (`/api/v1/concepts`, `/api/v1/templates`)
- `routers/skills.py`: Skill tree API (`GET /api/v1/skills/graph`) + HTML page (`/skills`)
- `routers/health.py`: Health/readiness/liveness endpoints for monitoring
- `routers/pages.py`: Jinja-based HTML pages (`/`, `/problems`)

### Frontend Core
- `src/App.tsx`: React Router setup with routes for login, dashboards, math game, skill tree
- `src/components/MathGame.tsx`: Main problem-solving UI; fetches session from `/api/v1/sessions`, submits answers, shows feedback
- `src/components/SkillTreePage.tsx`: Skill tree overview with search/filter/graph toggle
- `src/components/SkillTreeGraph.tsx`: D3-based force-directed graph visualization of bipartite skill graph
- `src/utils/api.ts`: Axios-based API client with `/math-api/api` base URL

### Data Models
- **ConceptNode**: Metadata for a learning concept (id, name, lens, prerequisites, summary, stage_span)
- **ProblemTemplate**: Template for problem generation (parameters, computed_values, prompt, explanation, answer_expression, distractor_expressions)
- **ItemInstance**: Generated problem instance (prompt, explanation, answer, options, variables, template_id)
- **Bipartite Graph**: `nodes` (skills with type="skill", course steps with type="course_step") + `edges` (type: "requires", "teaches", "enables")

### Bipartite Graph Structure
- **Skills** (`AS.*`): Atomic abilities (e.g., `AS.PV.READ`, `AS.ADD.CARRY`) with levels (1-3), XP rewards, and lens tags
- **Course Steps** (`CXX-SY`): Learning units (e.g., `C01-S1`, `C03-S2`) with tier, LRC gates, session config, and misconception tags
- **Edges**:
  - `requires`: Course step requires skill at `min_level` to start
  - `teaches`: Course step teaches skill by `delta_level` upon completion
  - `enables`: Course step unlocks next step(s) in curriculum

## Development Workflow

### Adding a New Problem Template
1. Add concept to `app/data/concepts.json` (if new concept)
2. Add template to `app/data/templates.json` with:
   - `id`, `concept`, `step`, `lens`, `representation`, `context_pack`
   - `parameters` (name → {type, min, max, step})
   - `computed_values` (name → expression string)
   - `answer_expression`, `option_offsets` or `distractor_expressions`
3. Test via `POST /api/v1/templates/{id}/instantiate?seed=42`
4. Add unit test in `tests/services/test_template_engine.py`

### Adding a New Router/Endpoint
1. Create `app/routers/new_router.py` with `APIRouter(prefix="/api/v1/feature", tags=["feature"])`
2. Define Pydantic request/response models in `app/schemas/`
3. Include router in `app/__init__.py`: `app.include_router(new_router.router)`
4. Add tests in `tests/routers/test_new_router.py` using `TestClient`
5. Update README.md with endpoint documentation

### Modifying Bipartite Graph
1. Edit `graph.bipartite.json`:
   - Add/modify skills or course steps in `nodes`
   - Add/modify edges in `edges` (ensure `from`/`to` reference existing node IDs)
2. Run `make validate-dag` (calls `scripts/validate_skill_graph.py`)
3. Restart backend to reload graph cache
4. Verify in frontend skill tree UI

### Frontend Component Changes
1. Components use TypeScript; ensure types are defined in `src/types/`
2. API calls should use `src/utils/api.ts` with error handling
3. Add tests in `src/__tests__/` or co-located `*.test.tsx`
4. For new routes, update `src/App.tsx` router config

## Testing Patterns

### Backend Tests
- Use `TestClient` from FastAPI for endpoint tests
- Mock `app.state` dependencies (template_engine, problem_repository, etc.) via `app.dependency_overrides` or test fixtures
- Test startup with `with TestClient(app):` to trigger lifespan
- Verify `X-Request-ID` header propagation, RFC 9457 error responses, noindex headers

### Frontend Tests
- Vitest + Testing Library for component tests
- Mock API calls with `vi.mock('axios')`
- Test user interactions: renders, clicks, form submissions
- Snapshot tests for complex UI components (skill tree graph, math game)

## Important Constraints

### Security
- Session tokens are JWT signed with `SESSION_TOKEN_SECRET`; never commit secrets
- User passwords hashed (though service is educational and does not handle real PII)
- SQLite database (`app/data/attempts.db`) is local; no network exposure

### Performance
- Problem bank/template engine cached at startup; re-load on file mtime change or `force=True`
- Bipartite graph loaded once at startup; changes require restart
- Use `seed` parameter for deterministic problem generation to enable reproducible tests

### Browser Compatibility
- Frontend targets modern browsers with ES2020+ support
- No IE11 support; Vite dev server uses native ESM

### Known Limitations
- No authentication for most endpoints (educational prototype)
- Skill tree graph visualization may be slow with >200 nodes (use WebGL-based renderer for scale)
- SQLite is single-writer; not suitable for high-concurrency production (use PostgreSQL if scaling)

## Environment Variables

See `.env.example` for full list. Key variables:
- `ENABLE_OPENAPI`: Enable/disable `/docs` endpoint (default: true)
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP collector URL for traces/metrics
- `SESSION_TOKEN_SECRET`: JWT signing secret (change in production)
- `CONCEPT_DATA_PATH`, `TEMPLATE_DATA_PATH`: Override paths for concepts/templates JSON
- `DAG_DATA_PATH`: Override path for bipartite graph JSON
- `SKILL_TREE_LIST_ROLLOUT`: Percentage rollout for skill tree list view (0-100)

## Deployment Notes

- Docker: `Dockerfile` builds Python backend + serves React frontend as static files
- Cloud Run / Cloudflare: Configure `X-Request-ID` header passthrough for tracing
- Health checks: `GET /health`, `GET /readyz`, `GET /healthz`
- Static assets: `/static` for backend, `/math` for frontend (Vite base path)

## Related Documentation

- `README.md`: User-facing quick start and API reference
- `AGENTS.md`: Codex agent contract for repository conventions (in Korean)
- `docs/skill_tree_content_guide.md`: Skill tree content and visual standards
- `docs/skill_tree_diablo_gap_analysis.md`: Diablo-style skill tree gap analysis
