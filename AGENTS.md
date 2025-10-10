# AGENTS.md — Codex 작업 계약서(Repository Agent Contract)

> 이 문서는 **Codex/GPT 코딩 에이전트**가 이 저장소에서 작업할 때 따라야 할 **규칙과 산출물 형식**을 정의합니다.  
> **중요:** 이 저장소는 CI가 자동으로 테스트를 수행합니다. Codex는 로컬에서 테스트를 **직접 실행할 필요가 없습니다.**

---

## 0) 컨텍스트

- OS: **Windows WSL2 (Ubuntu)**. 모든 경로/셸은 Linux 기준으로 작성합니다.
- Python 백엔드: **FastAPI** 및/또는 **Django** (Python ≥ 3.10).
- 프런트엔드: **React**.
- 테스트: **pytest**(백엔드), **Vitest** 또는 **Testing Library**(프런트엔드).
- 품질 도구: **ruff, black, isort, mypy, pre-commit**.
- CI: **GitHub Actions**(lint/test/coverage).  
- 가상환경: 프로젝트 루트의 **`.venv/`** (WSL 내부 디스크; `/mnt/c/...` 금지).

> **Codex는 다음을 가정합니다.**
> - Python 실행 경로: `.venv/bin/python`  
> - 테스트 경로: `tests/`(백엔드), `frontend/**/__tests__/` 또는 `frontend/src/**.test.tsx?`(프런트)  
> - 앱 기본 포트: FastAPI/Django: `:8000`, React dev: `:5173` 혹은 `:3000`  
> - 필요 시 수정하세요.

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

### 2.1 백엔드(FastAPI/Django)

- FastAPI: 엔드포인트/서비스/리포지토리 레이어를 분리하고, **Pydantic 모델**을 명확히 정의합니다.
- Django: 모델 변경 시 `migrations/` 생성 코드를 포함합니다(마이그레이션 스크립트 추가).
- 공통:
  - **테스트 작성**: 신규/변경된 로직은 `tests/`에 단위테스트 추가.  
    - 예: `tests/api/test_users.py`, `tests/services/test_billing.py`
  - **문서화**: 변경 사항을 `README.md` 또는 `docs/`에 간단 요약(엔드포인트/스키마/예제).

### 2.2 프런트엔드(React)

- 컴포넌트/훅/상태 관리 코드는 **접근성(a11y)**과 **테스트 가능성**을 고려합니다.
- **테스트 작성**: `__tests__/` 또는 `*.test.tsx` 형태로 렌더/이벤트/상태 변경 테스트 추가.
- 스타일/포맷은 프로젝트 ESLint/Prettier 설정을 따릅니다.

---

## 3) 변경 금지/주의 파일

- **절대 직접 수정 금지**: `.env`, `secrets`, GitHub Actions OIDC/시크릿 값.
- **의존성 관리 규칙**  
  - Python: 새 의존성은 `requirements.in`에 추가 → `requirements.txt`를 동기화(잠금 반영).  
    - CLI 실행이 불가한 상황이면, **두 파일 모두 패치**를 제안하고 PR 설명에 “pip-compile 필요”를 명시합니다.
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

## 7) 디렉터리·명명 규칙(예시, 프로젝트에 맞게 수정)

- 백엔드:
  - `app/` (FastAPI) 또는 `config/` + `apps/<domain>/` (Django)
  - `app/schemas/`, `app/services/`, `app/api/routes/`
  - 테스트: `tests/api/`, `tests/services/`, `tests/models/`
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
# FastAPI dev
uvicorn app.main:app --reload
# Django dev
python manage.py runserver
# 테스트(참고): python -m pytest

# Frontend
nvm use 18
npm ci
npm run dev
# 테스트(참고): npm test -- --run
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

## 11) 예시: 기능 추가 작업 카드(요약)

* 목표: `POST /users/verify` 추가 (FastAPI)
* 산출물:

  * `app/api/routes/users.py` 라우트 + 서비스/스키마
  * 테스트: `tests/api/test_users.py::test_verify_success`, 에러 케이스 1개
  * 문서: `README.md` API 섹션 갱신
* 기대 결과(실행 없이): 200 OK, 응답 `{verified: true, verified_at: "..."}`
* 마이그레이션: Django 사용 시 `apps/users/migrations/00XX_add_verify_flag.py`

---

```

---

### 어떻게 쓰면 좋을까요?
- 이 파일은 **Codex가 ‘무엇을/어떻게 바꿀지’만 알면 되는 상태**를 만드는 가드레일입니다.  
- 사람 개발자는 평소처럼 커밋/PR만 올리면 되고, Codex가 만든 PR도 **테스트 실행 지시 없이** CI가 검증합니다.
- 프로젝트에 맞춰 포트/경로/테스트 폴더/Node 버전 등을 한 번만 수정해두면, 이후에는 **반복 안내 없이** 일관된 방식으로 협업할 수 있습니다.

필요하시면 위 **AGENTS.md의 플레이스홀더**(포트/경로/테스트 폴더/의존성 정책 등)를 당신의 레포 구조에 맞춰 제가 바로 채워드릴게요.
