# PRD (v0)

## 목표
- 스킬트리 기반 초등 연산 학습 웹앱: 학습 경로 선택 → 세션 → 보스전 → 해금
- 학습 진행도 가시화와 보상(해금/레벨업)으로 동기 부여

## 페르소나 / 문제 / 가치
- 부모/아이: 어디서부터 공부해야 할지 모름 → 선행 스킬 시각화
- 교사: 개별 진행도와 약점 파악 → 맞춤형 과제 제시
- 가치: 짧은 세션 습관화, 진행도 기반 경로 추천, 오답 피드백

## Must-have
- GET `/health`, `/healthz`, `/readyz`
- GET `/api/problems`, `GET /api/problems/generate?category=add&seed=1`
- POST `/api/v1/sessions` → 문제 세트 20개 생성
- GET `/api/v1/metrics/me` → 사용자별 통계
- GET `/api/v1/skills/tree` (평문 JSON, 데이터 미존재 시 503 Problem Details)
- POST `/api/v1/skills/progress` (스냅샷/투영)
- skills 파이프라인: `docs/dag.md` → `scripts/dag_to_skills.py` → `app/data/skills.json` (+ 검증 `scripts/validate_skills.py`)

## 범위 (In/Out)
- In: 스킬 그래프 렌더링, 진행도/보스전 규칙, 문제 세션 생성, 기본 메트릭
- Out: 소셜 로그인/결제, 콘텐츠 마켓플레이스, 교사용 고급 리포트(초판 제외)

## NFR (비기능 요구사항)
- 성능: p95 API < 1s, LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1
- 오류: RFC 9457 Problem Details, 성공은 평문 JSON
- 안정성: skills.json은 빌드 단계에서 생성/검증, 누락 시 /skills/tree 503 허용
- 보안/정책: 아동 보호(noindex, AdSense NPA), 시크릿/토큰 비노출

## 수용 기준 (Acceptance Criteria)
- `/api/v1/skills/tree` 200(정상 데이터) 또는 503(데이터 누락) 응답, 본문은 Problem Details 준수
- pytest 단위/라우터 테스트 통과, skills.json 검증 통과
- 문서(idea → PRD/architecture/test_plan) 갱신 시 CI가 자동 PR 생성

