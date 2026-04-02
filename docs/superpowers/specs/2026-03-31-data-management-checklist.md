# 데이터 관리 확정 체크리스트 (MVP Week 1)

> 목적: Phase 1(서버 저장 전환) 시작 전에, 구현을 막는 데이터 의사결정을 이번 주 안에 고정한다.
> 기준 문서: `docs/superpowers/specs/2026-03-31-mvp-design.md`

---

## 0) 의사결정 원칙

- 지금 고정할 것: **스키마 / API 계약 / 동기화 규칙 / 식별자 규칙**
- 나중에 튜닝할 것: **추천 가중치(w1/w2/w3), 난이도 커브, 진단 UX 실험값**
- 이유: Phase 1 핵심 작업이 "서버 저장 전환"이기 때문에, 저장 계약이 없으면 개발이 바로 멈춤

---

## 1) 이번 주 반드시 확정할 항목 (Blocker)

## A. 공통 엔터티/필드 사전 (Data Dictionary v1)

- [ ] `AttemptSession`
  - 필수: `sessionId`, `userId`, `nodeId`, `status`, `startedAt`, `submittedAt`
- [ ] `AttemptItem`
  - 필수: `problemId`, `answerRaw`, `isCorrect`, `timeSpentMs`, `answerEditCount`, `isSkipped`
- [ ] `DiagnosisEvent`
  - 필수: `sessionId`, `problemId`, `selectedCauseType`, `selectedSkillIds[]`, `createdAt`
- [ ] `RecommendationEvent`
  - 필수: `recommendationId`, `userId`, `nodeId`, `reasonCode`, `eventType(shown/clicked/accepted/dismissed)`, `createdAt`
- [ ] `SkillLevel`
  - 필수: `userId`, `skillId`, `level(0~3)`, `xp`, `updatedAt`

**Definition of Done**
- [ ] 위 5개 엔터티 JSON 예시 포함 1페이지 문서 완성
- [ ] 필드명/타입/nullable 여부 명시

---

## B. DB 스키마/마이그레이션

- [ ] 기존 `attempts` 테이블 확장 여부 확정 (권장: session 단위 모델과 연결)
- [ ] 신규 테이블 확정:
  - [ ] `learning_sessions`
  - [ ] `learning_attempt_items`
  - [ ] `learning_diagnosis_events`
  - [ ] `learning_recommendation_events`
  - [ ] `student_skill_levels`
- [ ] 인덱스 확정:
  - [ ] `(user_id, node_id, submitted_at)`
  - [ ] `(user_id, skill_id)`
  - [ ] `(recommendation_id, event_type)`

**Definition of Done**
- [ ] SQL migration 초안 1개 + 롤백 전략 1개
- [ ] 샘플 데이터 insert로 조회 성능 기본 검증

---

## C. API 계약 (최소 세트)

- [ ] `POST /api/learning/sessions/submit`
  - 요청: Session + AttemptItems + Diagnosis(optional)
  - 응답: persisted session summary + next sync cursor
- [ ] `GET /api/learning/sessions?cursor=...`
  - 최근 세션 조회(보고서/복습 용도)
- [ ] `GET /api/learning/progress`
  - 노드 상태/스킬 레벨 요약 반환
- [ ] `POST /api/learning/recommendations/events`
  - shown/clicked/accepted/dismissed 이벤트 적재

**Definition of Done**
- [ ] OpenAPI 스니펫(요청/응답 예시 포함)
- [ ] 400/401/409 에러 포맷 통일

---

## D. 식별자/보안/멱등성

- [ ] `userId`는 토큰에서만 해석 (클라이언트 전달값 신뢰 금지)
- [ ] `sessionId` 멱등키 정책 확정 (중복 submit 방지)
- [ ] 시간 기준(UTC 저장, 클라이언트 로컬은 표시만)

**Definition of Done**
- [ ] 중복 제출 테스트 케이스 정의
- [ ] 권한 없는 userId 접근 거부 테스트 정의

---

## E. 로컬→서버 전환 전략

- [ ] 로그인 직후 localStorage 미동기 데이터 탐지 규칙
- [ ] sync 상태머신 정의: `pending -> syncing -> synced | failed`
- [ ] 재시도 정책(지수 백오프/최대 횟수) 확정

**Definition of Done**
- [ ] 마이그레이션 시나리오 3개(정상/중복/충돌) 문서화

---

## 2) 이번 주에는 “결정만” 하고, 다음 주 실험해도 되는 항목

- [ ] 추천 가중치 `w1/w2/w3` 수치
- [ ] 난이도 커브 세부식
- [ ] 오답 진단 UX 단일/복수 선택 최종안

> 위 항목은 **실데이터 기반 A/B/로그 분석**으로 조정하는 게 안전함.

---

## 3) 주간 타임박스 (권장)

- **D1**: 엔터티/필드 사전 + 식별자/멱등성 규칙 확정
- **D2**: DB 스키마/마이그레이션 초안 확정
- **D3**: API 계약(OpenAPI 스니펫) 확정
- **D4**: 로컬→서버 전환 상태머신/실패 정책 확정
- **D5**: 리뷰(백엔드/프론트/기획) 후 Freeze v1 선언

---

## 4) Freeze 체크 (출시 리스크 게이트)

아래가 모두 Yes일 때만 Phase 1 구현 시작:

- [ ] 스키마 문서 v1 존재
- [ ] API 문서 v1 존재
- [ ] sync 실패 처리 규칙 존재
- [ ] 멱등/권한 테스트 케이스 존재
- [ ] 미확정 항목이 “튜닝 항목”으로만 남아 있음

---

## 5) 한 줄 결론

**이번 주에는 데이터 저장 구조를 고정하고, 추천 로직 파라미터는 다음 주 데이터로 튜닝한다.**
