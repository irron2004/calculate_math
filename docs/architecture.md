# Architecture

- FE: React/Vite (optionally React Flow), served via dev server in local and static hosting in production
- BE: FastAPI + Uvicorn, routers under `app/routers/*`, entry `app/main.py`
- Data: `docs/dag.md` (마커 JSON/mermaid/표) → `scripts/dag_to_skills.py` → `app/data/skills.json`
- Validation: `scripts/validate_skills.py` schema/consistency checks (acyclic, refs)
- Error policy: RFC 9457 Problem Details, success = plain JSON
- Observability: `app/instrumentation.py` (OpenTelemetry wiring present)

### Endpoints (핵심)
- Health: `GET /health`, `/healthz`, `/readyz`
- Problems: `GET /api/problems`, `GET /api/problems/generate?category=add&seed=1`
- Sessions: `POST /api/v1/sessions`
- Metrics: `GET /api/v1/metrics/me`
- Skills: `GET /api/v1/skills/tree`, `POST /api/v1/skills/progress`

### Build/Deploy Notes
- CI에서 docs → skills.json 생성/검증 후 pytest 실행
- 배포 전 빌드 단계에서 skills.json 생성/검증(누락 방지)
- `/api/v1/skills/tree`는 데이터 누락 시 503 Problem Details를 반환

