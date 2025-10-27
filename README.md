# Calculate Math Service

교육용 사칙연산 문제를 제공하는 FastAPI + React 통합 서비스입니다. `web_service_new` monorepo에서 분리돼 독립 레포지토리로 유지되며, `calc.360me.app` 배포와 Cloudflare 프록시를 위한 기준 소스로 사용합니다.

## 주요 기능
- `/` · `/problems` HTML 화면: 카테고리별 연산 문제 제공, 즉시 채점 UI
- `/skills`: 스킬 트리 개요 페이지(잠금 해제 하이라이트, 학습 동선 제공)
- `/api/problems`: 카테고리 필터가 가능한 JSON API (RFC 9457 문제 상세 응답)
- `/api/problems/generate`: 결정적 산술 문제 생성기(동일 `seed` → 동일 세트)
- `/api/v1/login`: 닉네임 기반 학생/부모용 계정 생성 + 로그인
- `/api/v1/sessions`: React 학습 게임이 사용하는 20문제 세트 생성
- `/api/categories`: 사용 가능한 문제 카테고리 나열
- `/api/v1/concepts` · `/api/v1/templates`: 렌즈/템플릿 메타데이터와 문제 인스턴스 생성 API
- `/api/v1/lrc/evaluate`: Leap Ready Criteria(LRC) 게이트 평가 결과 계산
- 모든 응답은 `X-Request-ID` 헤더를 보존하며, `X-Robots-Tag: noindex`로 검색 노출을 차단
- OpenTelemetry 트레이싱/메트릭 설정을 통해 요청별 스팬과 기본 메트릭을 OTLP 수집기로 전송

## 빠른 시작 (백엔드)
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
make dev                   # 의존성 + 테스트 의존성 설치
make run                   # http://localhost:8000
```

## 프런트엔드 실행
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (Vite)
```

> `.env.local` 등에 `VITE_API_BASE_URL=/math-api/api`를 지정하면 프록시 경로를 자유롭게 바꿀 수 있습니다. 로컬 개발 시에는 기본값(`/math-api/api`)이 사용되며, docker-compose/nginx 구성과도 호환됩니다.

## Docker 실행 (백엔드 + 프런트)
```bash
make build   # 이미지 빌드 후 두 서비스를 백그라운드에서 실행
make up      # 기존 이미지를 사용해 컨테이너 실행
make down    # 실행 중인 컨테이너 정리

# docker compose 직접 사용 시
docker compose up --build -d
docker compose down
```

- 루트 `Dockerfile`은 멀티 스테이지 빌드로 React 프런트엔드를 컴파일해 `/math/` 경로에 서빙합니다. 필요하면 `docker build --build-arg VITE_API_BASE_URL=/api` 형태로 API 기본 경로를 재정의하세요.
- 백엔드: `http://localhost:8000`
- 프런트엔드: `http://localhost:5173/math/`
- 프론트에서 API 호출은 `http://localhost:5173/api/...` 경로를 통해 자동 프록시돼 백엔드(`math-backend`)로 전달됩니다.

## 설정
환경 변수는 `.env` 파일로 오버라이드할 수 있습니다.

| 환경 변수 | 설명 | 기본값 |
|-----------|------|--------|
| `APP_NAME` | 서비스명 | Calculate Service |
| `APP_DESCRIPTION` | OpenAPI 설명 | 초등수학 문제 제공 API |
| `ENABLE_OPENAPI` | 문서 노출 여부 (`true`/`false`) | true |
| `ALLOWED_PROBLEM_CATEGORIES` | 쉼표로 구분된 허용 카테고리 | 모든 카테고리 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP 수집기 HTTP(S) 엔드포인트 (`https://otel:4318` 등) | OpenTelemetry 기본값 |
| `HUB_URL` | 상단 내비게이션의 외부 허브 링크 URL(설정 시만 노출) | 설정하지 않음 |
| `OTEL_EXPORTER_OTLP_HEADERS` | 콤마 구분 헤더 (`Authorization=Bearer ...`) | 설정하지 않음 |
| `OTEL_SERVICE_NAME` | OTEL 리소스 `service.name` 값 | calculate-service |
| `OTEL_SERVICE_NAMESPACE` | OTEL 리소스 `service.namespace` 값 | education |
| `OTEL_SERVICE_INSTANCE_ID` | 인스턴스 식별자 (기본값은 hostname) | 컨테이너 hostname |
| `OTEL_SDK_DISABLED` | `true`인 경우 SDK 초기화 비활성화 | false |

수집기 없이 로컬 개발 시에는 위 변수를 지정하지 않아도 되며, 클라우드 환경에서는 Cloud Run/Cloudflare에서 제공하는 OTLP 엔드포인트를 `OTEL_EXPORTER_OTLP_ENDPOINT`에 설정하세요.

## 테스트
```bash
make test
```
테스트는 FastAPI `TestClient`를 사용해 `X-Request-ID` 전파, RFC 9457 오류 응답, noindex 헤더를 검증합니다. OpenTelemetry 익스포터는 통합/스테이징 환경에서 검증합니다.

## CI
- CI는 백엔드 테스트(`pytest -q`)와 필요 시 프런트엔드 테스트를 실행해 기본 커버리지를 확인합니다.
- 재현 가능한 버그 리포트를 위해 템플릿을 사용하세요: `docs/issue_template.md`.

## 배포 메모
- Docker 빌드는 `Dockerfile`을 그대로 사용할 수 있습니다.
- Cloud Run/Cloudflare 배포 시 `X-Request-ID` 헤더를 그대로 전달하도록 프록시를 구성하세요.
- 관측: `app/instrumentation.py`에서 OpenTelemetry 트레이서/미터를 초기화하고, 요청 ID를 스팬 속성(`http.request_id`) 및 baggage로 전파합니다. OTLP 엔드포인트만 지정하면 바로 수집기로 전송됩니다.

## 디렉터리 구조
```
app/
  __init__.py        # FastAPI 앱 생성 (라우터/미들웨어/OTEL 초기화)
  config.py          # 환경 변수 파서 (dataclass 기반)
  instrumentation.py # OpenTelemetry 초기화 + X-Request-ID 미들웨어
  problem_bank.py    # 카테고리·문제 데이터 정의 및 헬퍼
  repositories.py    # SQLite 기반 시도/사용자 저장소
  routers/           # HTML 화면 + /api/* 라우터 (practice 포함)
  templates/, static/ # Jinja 템플릿과 정적 자산
frontend/
  src/               # React + TypeScript 학습 게임 UI
  public/            # 정적 자산
  vite.config.ts     # `/math` 하위 경로 배포 설정
```

## 추가 문서
- [Skill Tree Content & Visual Standards Guide](docs/skill_tree_content_guide.md): 스킬 트리 카피, 로컬라이제이션 키, 시각 요소 표준과 협업 절차 정리
- [Diablo-Style Skill Tree Gap Analysis](docs/skill_tree_diablo_gap_analysis.md): 디아블로형 스킬트리 미구현 원인과 개선 과제 정리
- [Codex CLI Workflow (GPT Pro 로그인)](docs/codex_workflow.md): Codex CLI 설치/로그인, SOP(Plan→Commands→Diff→Verify), 검증 커맨드/프롬프트

## 라이선스
MIT

## 运营 모니터링

### 헬스/레디니스 엔드포인트
- `GET /health`: 기동 상태와 의존성, 업타임을 반환 (정상 시 200)
- `GET /readyz`: 템플릿, 문제은행, 브리지 유닛 상태를 포함한 readiness 체크 (정상 시 200/"ready")
- `GET /healthz`: liveness probe (정상 시 200)

### 주기 점검 예시
```bash
curl -s https://your-service-domain/health | jq
curl -s https://your-service-domain/readyz | jq
```

### 자동 알림 권장
- CI/CD 파이프라인 또는 cron에서 위 엔드포인트를 호출하고 실패 시 Slack/Email로 알림
- Matomo/GA4 커스텀 이벤트(`problem_rt`, `problem_explanation`)로 학습 RT/설명 데이터를 관측

```
# cron example (run every 5 minutes)
*/5 * * * * curl -sf https://your-service-domain/health >/dev/null || curl -s https://your-service-domain/readyz | mail -s "Readiness degraded" ops@example.com
```

