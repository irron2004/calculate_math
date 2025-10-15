# AGENTS.md — Codex 작업 계약서(Repository Agent Contract)

> 이 문서는 **Codex/GPT 코딩 에이전트**가 이 저장소에서 작업할 때 따라야 할 **규칙과 산출물 형식**을 정의합니다.  
> **중요:** 이 저장소는 CI가 자동으로 테스트를 수행합니다. Codex는 로컬에서 테스트를 **직접 실행할 필요가 없습니다.**

---

## 0) 컨텍스트

- OS: **Windows WSL2 (Ubuntu)**. 모든 경로/셸은 Linux 기준으로 작성합니다.
- Python 백엔드: **FastAPI (Python ≥ 3.11)**.
- 프런트엔드: **React + Vite (Node 18+ 권장)**.
- 테스트: **pytest**(백엔드), **Vitest** 또는 **Testing Library**(프런트엔드).
- 품질 도구: **ruff, black, isort, mypy, pre-commit**(가이드라인; 필요 시 도입).
- CI: **GitHub Actions**(lint/test/coverage).  
- 가상환경: 프로젝트 루트의 **`.venv/`** (WSL 내부 디스크; `/mnt/c/...` 금지).

> **Codex는 다음을 가정합니다.**
> - Python 실행 경로: `.venv/bin/python`  
> - 테스트 경로: `tests/`(백엔드), `frontend/**/__tests__/` 또는 `frontend/src/**.test.tsx?`(프런트)  
> - 앱 기본 포트: FastAPI `:8000`, React dev `:5173`  
> - 실제 엔트리: FastAPI `app/main.py` 또는 `make run`

---

## 1) 작업 원칙

1. **작은 단위의, 리뷰 가능한 변경**을 제안합니다. 하나의 PR/패치는 하나의 목적(1 feature/1 fix)만 담습니다.
2. **테스트 코드는 생성/갱신**하지만, **테스트 실행은 CI가 수행**합니다.  
   - 즉, Codex는 테스트 **파일과 스크립트만 추가/수정**하고, “테스트 성공 예상” 섹션으로 근거를 남깁니다.
3. **문서와 타입/주석을 동반**합니다. 공개 함수/핵심 모듈은 Docstring/주석/README 단락을 함께 갱신합니다.
4. **보안·안전 기본 수칙**을 지킵니다.
   - 비밀키/토큰을 커밋하지 않습니다. `.env`/`.envrc`/시크릿은 변경하지 않습니다.
   - 입력값 검증, SQL 파라미터 바인딩, 파일 경로 조작/명령주입 방지 등을 기본 적용합니다.
5. **성능/유지보수성**을 고려합니다. 복잡도 증가 시 리팩터링 제안을 첨부합니다.

---

## 2) 작업 절차(What to change)

### 2.1 백엔드(FastAPI)

- 엔드포인트/서비스/리포지토리 레이어를 분리하고, **Pydantic 모델**을 명확히 정의합니다.
- **테스트 작성**: 신규/변경된 로직은 `tests/`에 단위/라우터 테스트 추가.  
  - 예: `tests/test_api.py`, `tests/test_skills_router.py`, `tests/test_pages.py`
- **문서화**: 변경 사항을 `README.md` 또는 `docs/`에 간단 요약(엔드포인트/스키마/예제).

### 2.2 프런트엔드(React)

- 컴포넌트/훅/상태 관리 코드는 **접근성(a11y)**과 **테스트 가능성**을 고려합니다.
- **테스트 작성**: `__tests__/` 또는 `*.test.tsx` 형태로 렌더/이벤트/상태 변경 테스트 추가.
- 스타일/포맷은 프로젝트 ESLint/Prettier 설정을 따릅니다.

---

## 3) 변경 금지/주의 파일

- **절대 직접 수정 금지**: `.env`, `secrets`, GitHub Actions OIDC/시크릿 값.
- **의존성 관리 규칙**  
  - Python: 새 의존성은 `requirements.txt`에 추가하고 PR에서 근거를 명시합니다.  
    - 이 레포는 `pyproject.toml`로도 의존성을 정의합니다. 둘 간 버전/목록이 어긋나지 않도록 동기화 제안 문구를 포함하세요.
  - Node: 패키지 추가 시 `package.json`과 **lockfile**(예: `package-lock.json`/`pnpm-lock.yaml`)을 함께 갱신합니다.  
    - 불가하면 “lockfile 갱신 필요”를 PR 설명에 명시합니다.

---

## 4) 산출물(패치/PR) 형식

각 변경은 아래 **패치 본문 템플릿**에 맞춰 설명합니다.

### 4.1 커밋 메시지(Conventional Commits)

```

feat(api): add POST /users/verify endpoint
fix(auth): handle None password on login
docs(readme): update local dev commands
refactor(orders): extract price calc into service
test(users): add edge cases for email normalization

```

### 4.2 PR 설명 템플릿

```

## 목적

* (한 줄) 무엇을, 왜 변경했는지

## 변경 요약

* [backend] FastAPI 엔드포인트 추가/수정 (파일/함수 목록)
* [backend] 테스트 추가: tests/api/test_users.py::test_verify_success 등
* [frontend] 컴포넌트/훅 수정 (파일/함수 목록)
* [docs] README/AGENTS 갱신 항목

## 테스트(실행 없이 기대치 서술)

* CI에서 실행될 명령: `pytest -q` / `npm test -- --run`
* 새/변경 테스트 목록과 기대 결과:

  * tests/api/test_users.py::test_verify_success → 200, payload { ... }
  * tests/services/test_billing.py::test_overflow_guard → ValueError
* 커버리지 영향: +X% (대략)

## 호환성/마이그레이션

* Django migrations: 00XX_add_verify_model.py 포함
* API 스키마 변화: /users/verify (POST) 추가, 응답 필드 `verified_at` 추가

## 의존성

* (있다면) requirements.in / package.json 변경 및 lockfile 상태

## 기타

* 성능/보안 고려사항, 리팩터 제안

````

---

## 5) 테스트 정책(중요)

- Codex는 **테스트를 직접 실행할 필요가 없습니다.**  
  - 이 저장소의 **CI가 자동으로 pytest/Vitest를 실행**하여 결과를 검증합니다.
- Codex의 역할은 **테스트 코드를 추가/수정**하고, **PR 설명에 기대 결과를 명시**하는 것입니다.
- 테스트 품질 가이드:
  - 정상경로 + 에지케이스 + 예외 경로를 최소 1개씩 포함.
  - 외부 I/O는 목/페이크를 사용.
  - FastAPI는 `httpx.AsyncClient` 권장, Django는 `pytest-django` 픽스처 활용.
  - 프런트는 사용자 관점(텍스트/role 기반 쿼리)으로 검증.

---

## 6) 품질 규칙

- **pre-commit** 훅을 통과하는 형식으로 코드를 제안합니다(ruff/black/isort/mypy/ESLint).
- Docstring/주석: 공개 API/핵심 경로는 한 줄 요약 + 파라미터/반환 타입 명시.
- 보안: 입력 검증, 시크릿/토큰 비노출, SQL/경로/명령주입 방지.
- 성능: N+1 쿼리 회피, 불필요한 렌더/리스트 재계산 최소화.

---

## 7) 디렉터리·명명 규칙(레포 적용)

- 백엔드:
  - `app/` (FastAPI 애플리케이션 루트: `app/__init__.py`, `app/main.py`)
  - `app/routers/`, `app/services/`, `app/templates/`, `app/static/`
  - 테스트: `tests/` (예: `tests/test_api.py`, `tests/test_skills_router.py`)
- 프런트:
  - `frontend/src/components/`, `frontend/src/hooks/`, `frontend/src/pages/`
  - 테스트: `frontend/src/**/__tests__/` 또는 `*.test.tsx`
- 공통: 파일명은 소문자-스네이크케이스, React 컴포넌트는 PascalCase.

---

## 8) 로컬 실행(참고: 실행은 사람/CI가 수행)

> Codex는 아래 명령을 **문서로만 안내**하며, 직접 실행하지 않습니다.

```bash
# Python
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # 테스트/개발 의존성

# FastAPI dev
make run                 # 또는: uvicorn app.main:app --reload --port 8000

# 테스트(참고; CI가 실행)
pytest -q                # 또는: make test

# Frontend
nvm use 18
cd frontend && npm install
npm run dev              # http://localhost:5173 (Vite)
# 테스트(참고; CI가 실행)
npm test -- --run
````

---

## 9) 변경 제안의 한계(Do / Don’t)

* Do: 코드/테스트/문서 패치, 마이그레이션 파일 추가, 린트/포맷 수정.
* Don’t: 비밀/환경파일 수정, 배포 자격/시크릿 편집, OS/WSL 설정 변경 커밋.

---

## 10) 실패 시 재시도 전략(실행 없이 문서화만)

* CI에서 실패가 예상되는 경우, PR 설명 **“실패 원인 추정”**과 **“대안 패치 계획”**을 간단히 첨부합니다.
* 의존성 충돌/락파일 미스매치 등은 “잠금 갱신 필요”를 명시합니다.

---

## 11) SOP + 검증 커맨드(레포 적용)

다음 루프를 엄격히 따릅니다: **Plan → Commands → Diff → Verify**

- Plan: 문제 재현 경로와 수정 범위를 간단히 나열(최대 8줄)
- Commands: 재현/검증에 필요한 셸 명령을 한 줄씩(순서: 재현 → 수정 → 검증)
- Diff: 유니파이드 패치만. 최소 변경. 불필요한 재포맷 금지
- Verify: HTTP 코드/본문, 로그 키워드, 테스트 통과 수를 근거로 성공/실패 명시
- 파괴적 명령(대량 rm, sudo, 외부 네트워크 접근) 금지. 필요 시 명시적 승인 요청

### Build & Test (Codex가 실행 참조용)
- Backend: `pytest -q` 또는 `make test`
- Lint(선택): `python -m compileall app` (기본 제공), ruff/black은 도입 시 활성화
- Dev server: `make run` (포트 `:8000`)
- Health check: `curl -s http://localhost:8000/health`

### Endpoints to verify
- `GET /health`, `GET /healthz`, `GET /readyz`
- `GET /api/problems`, `GET /api/problems/generate?category=add&seed=1`
- `POST /api/v1/login {nickname,password}` → Set-Cookie 확인
- `POST /api/v1/sessions` → 문제 세트 20개 생성 확인
- `GET /api/v1/metrics/me` → 사용자별 통계
- `GET /api/v1/skills/tree`, `POST /api/v1/skills/progress` (스냅샷/투영 검증)

### Known Pitfalls
- Pydantic v2 기준(`model_dump`, `field_validation`). v1 전용 API 사용 금지
- 테스트는 `httpx.AsyncClient` + ASGITransport 사용. `X-Request-ID` 헤더 전파 필수
- 스킬 UI 그래프(`app/data/skills.ui.json`) 불일치 시 `SkillSpecError` 발생 → 검증 로직 유지

### Docker (옵션)
- Build: `docker build -t calculate-service .`
- Run: `docker run -p 8000:8000 calculate-service`

---

```

---

### 어떻게 쓰면 좋을까요?
- 이 파일은 **Codex가 ‘무엇을/어떻게 바꿀지’만 알면 되는 상태**를 만드는 가드레일입니다.  
- 사람 개발자는 평소처럼 커밋/PR만 올리면 되고, Codex가 만든 PR도 **테스트 실행 지시 없이** CI가 검증합니다.
- 프로젝트에 맞춰 포트/경로/테스트 폴더/Node 버전 등을 한 번만 수정해두면, 이후에는 **반복 안내 없이** 일관된 방식으로 협업할 수 있습니다.

필요하시면 위 **AGENTS.md의 플레이스홀더**(포트/경로/테스트 폴더/의존성 정책 등)를 당신의 레포 구조에 맞춰 제가 바로 채워드릴게요.

---

## 12) Codex Starter Prompts (붙여넣기용)

다음 프롬프트를 Codex CLI에 그대로 입력하면, 이 레포의 SOP에 맞춘 루틴으로 동작합니다.

### A. 헬스→재현→수정→검증 한방

codex "health 확인 후 /api/problems, /api/v1/sessions, /api/v1/skills/tree 재현 → 원인 분석(Pydantic v2/캐시/파일 경로 포함) → 최소 수정(diff) → curl/pytest로 검증. SOP/AGENTS.md 준수. 컨텍스트: README.md, app/__init__.py, app/routers/problems.py, app/routers/practice.py, app/routers/skills.py, app/routers/health.py, app/status.py, Makefile, tests/test_api.py, tests/test_skills_router.py"

### B. 워커/응답 지연 추적(옵션)

codex "/api/problems 및 /api/v1/sessions의 처리시간을 추적하고 병목을 완화(랜덤/IO/캐시 갱신). 필요한 경우 uvicorn 로그 레벨 조정과 간단한 캐시 힌트를 추가. Verify에 응답 시간/상태코드 수치 포함."

### C. 스킬 그래프 호환성 점검

codex "skills UI 그래프 검증에서 발생 가능한 SkillSpecError를 재현하고, 메시지 개선/에지케이스 방어를 최소 변경으로 적용. 수정 범위는 app/routers/skills.py 한정. pytest 통과 후 Verify에 라우트 응답 예시 포함."

---

## 13) Codex 자동화 루프 + 문서 주도 개발(추가)

- 로컬/CI 공통 자동화:
  - `tools/codex_loop.py`: pytest 실패 요약 → LLM 패치(diff) → 적용 → 재테스트(최대 N회)
  - `tools/codex_docs.py`: `docs/idea.md` → `docs/PRD.md`, `docs/architecture.md` 기본 골격 생성

### 로컬 사용

```bash
# 0) 의존성
pip install -r requirements.txt -r requirements-dev.txt

# 1) DAG → skills.json 생성/검증 (자동 루프가 내부에서 수행하지만 수동 실행 가능)
python scripts/dag_to_skills.py --in docs/dag.md --out app/data/skills.json
python scripts/validate_skills.py --in app/data/skills.json --schema docs/skills.schema.json

# 2) 1차 테스트 (선택)
pytest -q

# 3) 자동 수정 루프 (LLM 사용)
export LLM_API_KEY=sk-...   # 선택: LLM_BASE_URL, LLM_MODEL, CODEX_MAX_ITERS
python tools/codex_loop.py
```

### GitHub Actions

- `.github/workflows/docs-to-pr.yml`:
  - `docs/idea.md`, `docs/PRD.md`, `docs/api/**`, `docs/dag.md` 변경 시 동작
  - `tools/codex_docs.py` 실행 → `docs/dag.md` 변경 시 skills.json 생성/검증 → PR 생성

- `.github/workflows/ci-autofix.yml`:
  - PR/수동 트리거 시 `tools/codex_loop.py` 실행
  - 변경이 있으면 `peter-evans/create-pull-request`로 `autofix/*` PR 자동 생성
  - 시크릿: `LLM_API_KEY`(필수), 선택 `LLM_BASE_URL`; `vars.LLM_MODEL`로 모델명 지정 가능

### 제약/안전장치

- LLM 프롬프트에 변경 범위를 `app/`, `tests/`, `docs/`, `scripts/`, `frontend/`로 유도
- 오류 응답은 RFC 9457 Problem Details 유지, `/api/v1/skills/tree` 누락 시 503 방어 권장
- `requests`는 dev 의존성으로 추가됨. CI/로컬에서 `requirements-dev.txt` 설치 필요
