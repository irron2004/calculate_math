# Test Plan

## 범위
- Unit: 규칙/서비스 로직 (e.g., 진행도 판정, 그래프 처리), skills.json 검증
- Router/API: FastAPI endpoints의 정/오류 경로 검증 (httpx.AsyncClient + ASGITransport)
- E2E(옵션): 첫 화면 로드 → skill tree 요소 확인 → /skills/tree 응답 확인 → 세션 생성

## 시나리오
- Health
  - GET `/health` → 200, `{status: "ok"}` 유사 응답

- Problems/Sessions
  - GET `/api/problems` → 200, 리스트
  - GET `/api/problems/generate?category=add&seed=1` → 200, 결정적 페이로드
  - POST `/api/v1/sessions` → 201/200, 20개 문제 생성 확인

- Skills Tree
  - 정상 데이터 존재 시 GET `/api/v1/skills/tree` → 200(JSON), 노드/엣지 최소 개수 보장
  - 데이터 누락/검증 실패 시 → 503 Problem Details (type/title/status/detail 확인)
  - POST `/api/v1/skills/progress` → 200, 진행도 반영 규칙 검증

- Metrics
  - GET `/api/v1/metrics/me` → 200, 스키마 필수 필드 존재

## 품질 기준
- 커버리지: backend app/* 대상 라인 기준 80%+ 목표
- 오류 표준: RFC 9457 Problem Details
- 테스트 스타일: 동기 TestClient 지양, httpx.AsyncClient + ASGITransport 사용

## 관측/지표 (선택)
- KPI: Problems Served, Correct Rate, Autopass Rate, p95 latency

