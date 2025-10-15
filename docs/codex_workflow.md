## SOP (Agent Loop)

- Always follow: Plan → Commands → Diff → Verify
- Plan: short steps to reproduce and fix (≤8 lines)
- Commands: shell lines to reproduce → fix → verify
- Diff: unified patches only, minimal changes
- Verify: HTTP status/body, logs, pytest pass/fail counts
- Avoid destructive ops (sudo, mass rm, external network). Request approval first if needed.

## Build & Test (reference)

```bash
# Backend (FastAPI)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
make run      # uvicorn app.main:app on :8000
pytest -q     # executed by CI, local optional

# Frontend (Vite)
cd frontend && npm install
npm run dev   # :5173
```

## Endpoints to Verify

- GET /health, /healthz, /readyz
- GET /api/problems
- GET /api/problems/generate?category=add&seed=1
- POST /api/v1/login {nickname,password} → Set-Cookie
- POST /api/v1/sessions → 20 problems generated
- GET /api/v1/metrics/me
- GET /api/v1/skills/tree, POST /api/v1/skills/progress

## Known Pitfalls

- Pydantic v2 API: use model_dump and v2 semantics
- Tests rely on httpx.AsyncClient + ASGITransport and X-Request-ID propagation
- Skill UI graph validation raises SkillSpecError for inconsistent nodes/edges

## Starter Prompts (paste into Codex)

### A) Health → Reproduce → Fix → Verify

```
SOP를 따르세요. 출력은 반드시 섹션 4개만:

1) Plan
2) Commands (재현→수정→검증)
3) Diff (유니파이드 패치만)
4) Verify (HTTP 코드/본문, pytest 통과/실패 수)

컨텍스트 파일: README.md, app/__init__.py, app/main.py,
app/routers/problems.py, app/routers/practice.py, app/routers/skills.py,
app/routers/health.py, app/status.py, Makefile,
tests/test_api.py, tests/test_skills_router.py, tests/test_pages.py

재현 우선: GET /health → /api/problems → /api/v1/sessions POST.
수정은 최소 변경. 성공 기준은 Verify에 수치로 명확히.
```

### B) Latency/Bottleneck Trace (optional)

```
codex "/api/problems 및 /api/v1/sessions 처리시간을 추적하고 병목을 완화.
필요 시 캐시 힌트/로깅 추가. Verify에 응답시간과 상태코드 수치 포함."
```

### C) Skills Graph Compatibility

```
codex "skills UI 그래프 검증에서 SkillSpecError를 재현하고, 메시지 개선/에지케이스 방어를
최소 변경으로 적용. 수정은 app/routers/skills.py 한정. pytest 통과 후 Verify에 라우트 응답 예시 포함."
```

---

For constraints and expectations, see AGENTS.md.

