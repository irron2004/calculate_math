# Calculate Math Service

교육용 사칙연산 문제를 제공하는 FastAPI + React 통합 서비스입니다. `web_service_new` monorepo에서 분리돼 독립 레포지토리로 유지되며, `calc.360me.app` 배포와 Cloudflare 프록시를 위한 기준 소스로 사용합니다.

## 주요 기능
- `/` · `/problems` HTML 화면: 카테고리별 연산 문제 제공, 즉시 채점 UI
- `/api/problems`: 카테고리 필터가 가능한 JSON API (RFC 9457 문제 상세 응답)
- `/api/v1/login`: 닉네임 기반 학생/부모용 계정 생성 + 로그인
- `/api/v1/sessions`: React 학습 게임이 사용하는 20문제 세트 생성
- `/api/categories`: 사용 가능한 문제 카테고리 나열
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

## 설정
환경 변수는 `.env` 파일로 오버라이드할 수 있습니다.

| 환경 변수 | 설명 | 기본값 |
|-----------|------|--------|
| `APP_NAME` | 서비스명 | Calculate Service |
| `APP_DESCRIPTION` | OpenAPI 설명 | 초등수학 문제 제공 API |
| `ENABLE_OPENAPI` | 문서 노출 여부 (`true`/`false`) | true |
| `ALLOWED_PROBLEM_CATEGORIES` | 쉼표로 구분된 허용 카테고리 | 모든 카테고리 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP 수집기 HTTP(S) 엔드포인트 (`https://otel:4318` 등) | OpenTelemetry 기본값 |
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

## 라이선스
MIT
