---
workflow: code
graph_profile: end2end
---

# MVP 학생 학습 시스템 구현

## Goal
학생이 로그인 후 대시보드에서 현황/추천을 확인하고, 지도(그래프)에서 노드 상태를 보며 문제를 풀고, 일괄 채점 후 다음 노드를 해제하는 **완주 가능한 학습 루프**를 구현한다.

---

## Current Status
- `curriculum-viewer` 프론트엔드 존재 (React + TypeScript)
- 로그인/로그아웃 기능 존재 (localStorage 기반)
- `/learn/:nodeId` 학습 페이지 존재 (일괄 제출 방식)
- `/tree`, `/graph` 페이지 존재
- 문제 데이터: `curriculum-viewer/public/data/problems_v1.json`
- 학습 결과: localStorage에 저장

---

## MVP 범위 요약 ("완주 가능한 루프")
1. 학생 로그인
2. **대시보드**에서 현황/추천 확인
3. **지도(그래프)**에서 `CLEARED / AVAILABLE / LOCKED / IN_PROGRESS` 상태 확인
4. AVAILABLE 노드 → **문제 폼(주관식)** 입력
5. **제출(일괄 채점)** → 평가 페이지
6. **클리어**되면 다음 노드 해제 + 추천 이동
7. 리포트에서 약점/통계 확인

> MVP 핵심: "노드 상태 계산 + 세션(임시저장) + 일괄 채점 + 다음 노드 해제"가 끊김 없이 돌아가는 것

---

## Requirements

### EPIC A — 기반/데이터 계약 (P0)

#### MVP-001 프로젝트 구조 정리
- **담당**: FE+BE
- **작업**: 폴더 구조, 환경변수(.env), 실행 스크립트(dev/prod), 린트/포맷 설정
- **DoD**: 신규 개발자가 README대로 10분 내 FE/BE 모두 실행 가능

#### MVP-002 데이터 스키마 확정 (nodes/edges/problems/sessions)
- **담당**: FE+BE
- **작업**: Node/Edge/Problem/AttemptSession 스키마 문서화 + TS 타입 + Pydantic 모델
- **DoD**: 샘플 JSON이 FE/BE 타입 검증 통과

#### MVP-003 그래프 버전 모델 확정 (draft/published)
- **담당**: BE
- **작업**: `graph_versions`(draft/published) 정책 확정, 최신 published 조회 규칙 확정
- **DoD**: API로 최신 published 그래프를 항상 1개 반환

#### MVP-004 공통 에러/알림(Toast) + 전역 ErrorBoundary
- **담당**: FE
- **작업**: API 실패/권한 실패/데이터 오류 시 사용자 메시지 통일
- **DoD**: 주요 실패 케이스에서 "왜 안 되는지" UI로 확인 가능

---

### EPIC B — 인증/계정(학생) (P0)

#### MVP-010 회원가입/로그인 API (JWT 또는 세션)
- **담당**: BE
- **작업**: `/auth/signup`, `/auth/login`, `/auth/me` 구현 + 비밀번호 해시
- **DoD**: Postman으로 가입→로그인→me 호출 성공

#### MVP-011 FE 로그인/회원가입 화면
- **담당**: FE
- **작업**: 로그인/회원가입 폼 + 유효성 검사 + 성공 시 라우팅
- **DoD**: 로그인 성공 시 학생 홈(대시보드) 이동, 실패 시 오류 메시지

#### MVP-012 라우트 가드 (학생 전용 화면 보호)
- **담당**: FE
- **작업**: 비로그인 시 `/dashboard`, `/map`, `/report`, `/learn/*` 접근 차단
- **DoD**: 비로그인 접근 시 로그인 페이지로 리다이렉트

---

### EPIC C — published 그래프 로딩 + 공통 레이아웃

#### MVP-020 최신 Published 그래프 조회 API
- **담당**: BE
- **작업**: `GET /student/graph/latest` → nodes+edges 반환
- **DoD**: 그래프 버전 포함해서 응답 (graphVersionId, nodes, edges)

#### MVP-021 문제 조회 API (nodeId 기준)
- **담당**: BE
- **작업**: `GET /student/node/:nodeId/problems` (정답 제외)
- **DoD**: 정답/해설은 제출 전에는 내려주지 않음

#### MVP-022 공통 레이아웃 + 네비게이션
- **담당**: FE
- **작업**: 상단 탭/메뉴, 로그인 상태 표시, 로그아웃 처리
- **DoD**: 메뉴로 화면 이동 가능 + 로그아웃 시 보호 화면 접근 불가

---

### EPIC E — Student 지도 (상태/잠금/도전)

#### MVP-040 학생 지도 화면(그래프) 렌더 + 노드 상세 패널
- **담당**: FE
- **작업**: 읽기 전용 그래프, 노드 클릭 패널(설명/상태/도전버튼)
- **DoD**: 노드 클릭→정보 표시, 도전 가능 시 버튼 활성

#### MVP-041 노드 상태 모델 정의 + 상태 계산 함수
- **담당**: FE+BE
- **작업**: `CLEARED/AVAILABLE/LOCKED/IN_PROGRESS` 계산 규칙 확정
- **DoD**: 동일 입력 데이터에서 FE/BE 계산 결과 일치

#### MVP-042 상태 오버레이 UI (색/흐림/배지)
- **담당**: FE
- **작업**: 상태별 노드 스타일 (클리어 색/도전 강조/잠김 흐림/진행중 배지)
- **DoD**: 지도만 봐도 진행 상태가 구분됨 (범례 포함)

#### MVP-043 LOCKED 클릭 UX (잠김 사유 안내)
- **담당**: FE
- **작업**: 잠김 노드 클릭 시 "선행 노드 먼저" 안내(선행 목록 표시)
- **DoD**: 학생이 왜 잠겼는지 이해 가능

---

### EPIC F — 문제 세션(DRAFT) + 임시저장 + 제출(일괄 채점)

#### MVP-060 AttemptSession 시작 API
- **담당**: BE
- **작업**: `POST /student/node/:nodeId/session/start` (이미 DRAFT가 있으면 기존 세션 반환)
- **DoD**: 같은 노드 재진입 시 이어풀기 가능

#### MVP-061 문제 풀이 화면 (폼형, 주관식 입력)
- **담당**: FE
- **작업**: 문제 리스트(고정 order), 입력 필드, 진행 카운트
- **DoD**: 문제 N개 입력 가능 + UI 깨짐 없음

#### MVP-062 답안 임시저장 API (문항 단위 PATCH)
- **담당**: BE
- **작업**: `PATCH /student/session/:id/response` (problemId, inputRaw)
- **DoD**: 저장 후 새로고침해도 입력 복원

#### MVP-063 FE 입력 디바운스 자동저장
- **담당**: FE
- **작업**: 입력 변경 시 300~800ms 디바운스로 PATCH 호출
- **DoD**: 입력 중 과도한 API 호출 없이 안정 저장

#### MVP-065 제출(일괄 채점) API
- **담당**: BE
- **작업**: `POST /student/session/:id/submit` (normalize + grading + 결과 저장)
- **DoD**: 제출하면 SUBMITTED로 바뀌고 결과가 반환됨

#### MVP-066 결과 조회 API
- **담당**: BE
- **작업**: `GET /student/session/:id/result`
- **DoD**: 평가 페이지 새로고침해도 결과 유지

---

### EPIC G — 평가(진단) + 다음 스텝 추천/해제

#### MVP-070 채점 엔진 v1 (numeric_equal + normalize)
- **담당**: BE
- **작업**: trim/removeSpaces/removeCommas, 숫자 비교
- **DoD**: 대표 케이스 테스트 통과(" 1,200 "=1200)

#### MVP-071 평가 페이지 UI (요약 + 문항별 결과)
- **담당**: FE
- **작업**: 점수/정답률, 문항별 정오/정답/내답 표시(제출 후)
- **DoD**: 제출 직후 평가 페이지로 이동하고 정보 표시

#### MVP-073 클리어 판정 로직 (>=80% 등)
- **담당**: BE
- **작업**: 제출 결과로 node clear 판정 저장(세션/노드 진행 캐시)
- **DoD**: 클리어면 지도에서 즉시 CLEARED로 보임

#### MVP-074 다음 노드 추천 (requires, prepares_for)
- **담당**: FE+BE
- **작업**: 평가 페이지에서 다음 후보 노드 1~3개 제시
- **DoD**: "다음 단계로 이동" 버튼이 항상 의미 있게 동작

#### MVP-075 재도전 UX (동일 노드 다시 풀기)
- **담당**: FE+BE
- **작업**: "재도전" 시 새 세션 생성 또는 기존 세션 reset 정책
- **DoD**: 재도전이 데이터 꼬임 없이 동작

---

### EPIC H — 대시보드 (학습 현황)

#### MVP-080 대시보드 페이지 UI (요약/추천/최근 이력)
- **담당**: FE
- **작업**: 완료 노드 수, 평균 정답률, 최근 제출, 이어하기, 추천
- **DoD**: 로그인 후 첫 화면으로 제공 가능

#### MVP-081 진행 요약 조회 API (노드 상태/통계)
- **담당**: BE
- **작업**: `GET /student/progress/summary` (clearedCount, totalCount, avgAccuracy, lastActivities)
- **DoD**: 대시보드에 필요한 데이터 1~2번 호출로 제공

#### MVP-082 추천 로직 v1 (Available 우선)
- **담당**: BE (또는 FE)
- **작업**: AVAILABLE 중 order가 낮은 것 우선 + IN_PROGRESS 우선 처리
- **DoD**: "오늘 할 것"이 매번 비지 않음

---

### EPIC I — 학습 리포트

#### MVP-090 노드별 진행 조회 API
- **담당**: BE
- **작업**: `GET /student/progress/nodes` → nodeId별 status/accuracy/lastAttemptAt
- **DoD**: 지도에서 상태 오버레이를 이 데이터로 표시 가능

---

### EPIC J — 콘텐츠 (문제은행/태그) 최소 세팅

#### MVP-200 MVP 코스 노드/엣지 데이터 입력 (덧셈+규칙성 도전)
- **담당**: BE
- **작업**: 최소 8~15 노드를 따라 학습 가능한 데이터 반영
- **DoD**: publish 후 학생이 최소 8~15 노드를 따라 학습 가능

#### MVP-201 노드별 문제 5~10개 제작 + 정답 확정
- **담당**: 콘텐츠
- **작업**: nodeId별 problems 세트 구성(고정 order)
- **DoD**: 모든 학습 노드에 문제 세트 존재

---

### EPIC K — QA/테스트/운영 체크

#### MVP-300 채점 엔진 테스트 (유닛 테스트)
- **담당**: BE
- **작업**: normalize/숫자 비교 테스트 케이스 20+
- **DoD**: CI에서 자동 테스트 통과

#### MVP-301 상태 계산 테스트 (유닛/통합)
- **담당**: BE
- **작업**: cleared→available 해제 규칙, locked 사유 리스트 테스트
- **DoD**: 잠금/해제 규칙이 깨지지 않음

---

## 화면별 상세 스펙

### 대시보드 `/dashboard`
**목적**: 학생이 로그인 후 "내가 지금 어디까지 했고" + "지금 무엇을 하면 되는지"를 10초 안에 결정

**필요 데이터**: `GET /student/progress/summary`
- `graphVersionId`, `totalNodes`, `clearedNodes`, `inProgressNodes`
- `avgAccuracy`, `recommendedNodeIds[]`, `recentActivities[]`

**UI 구성**:
1. 상단 요약 카드: "클리어: X / 전체: Y", "평균 정답률: Z%"
2. 이어서 하기 카드: 진행 중 노드 표시
3. 오늘의 추천: 추천 노드 1~3개 + [바로 도전] 버튼
4. 최근 학습 이력

---

### 지도 `/map`
**목적**: 학생이 "지식 지도"에서 CLEARED/AVAILABLE/LOCKED/IN_PROGRESS를 한눈에 보고, AVAILABLE 노드에만 도전

**상태 계산 규칙**:
- `CLEARED`: 클리어 판정 true
- `IN_PROGRESS`: DRAFT 세션 존재 or SUBMITTED 했지만 기준 미달
- `AVAILABLE`: isStart=true OR (incoming edge의 source가 CLEARED)
- `LOCKED`: 위 조건 미충족

**UI 구성**:
- 중앙: React Flow 그래프 (읽기 전용)
- 우측 패널: 선택 노드 상세 (label/description/category/status)
- 버튼: AVAILABLE→[도전하기], LOCKED→비활성
- 범례: CLEARED/AVAILABLE/IN_PROGRESS/LOCKED 색 설명

---

### 문제 풀이 `/learn/:nodeId`
**목적**: 학생이 주관식으로 문제를 모두 입력한 뒤 제출 버튼으로 일괄 채점

**UI 구성**:
- 상단: 노드명, 카테고리, "입력 완료 x/n", "자동 저장됨" 표시
- 본문: 문제 카드 리스트 (prompt + 입력칸)
- 하단: [제출] 버튼, [나가기] 버튼

**정책**:
- 입력마다 300~800ms 디바운스 자동 저장
- 제출 전에는 정답/정오 노출 없음

---

### 평가 `/eval/:sessionId`
**목적**: 학생이 무엇을 맞았고 틀렸는지, 다음에 무엇을 해야 하는지 확인

**UI 구성**:
1. 요약 카드: 점수/정답률, 클리어 여부
2. 문항별 결과 리스트: 문제/내답/정답/정오
3. 다음 행동 버튼: cleared면 [다음 노드], 미달이면 [재도전]

---

## Out of Scope
- Author Mode (그래프 편집 기능) - 별도 task로 분리
- 대규모 문제 은행 구축/품질 관리
- AI 기반 진단/추천 시스템
- 서버 기반 사용자 관리/권한 (진짜 보안)

---

## Implementation Notes

### 수정 중심 파일 (FE)
- `curriculum-viewer/src/pages/DashboardPage.tsx`
- `curriculum-viewer/src/pages/LearnPage.tsx`
- `curriculum-viewer/src/pages/MapPage.tsx` (또는 GraphPage)
- `curriculum-viewer/src/pages/EvalPage.tsx`
- `curriculum-viewer/src/components/Header.tsx`

### 데이터 구조
- localStorage 키: `curriculum-viewer:learn:lastResult:{nodeId}`
- 노드 상태 계산: FE/BE 동일 로직 구현 필요

### 기술 스택
- FE: React + TypeScript + React Flow
- BE: (기존 구조에 맞춰 구현)
- 상태 관리: React Context 또는 기존 구조 활용

---

## Verification (완료 조건)

### 핵심 플로우
- [ ] 로그인 → 대시보드 → 지도 → 문제풀이 → 채점 → 다음노드 해제가 끊김 없이 동작
- [ ] AVAILABLE 노드만 도전 가능, LOCKED 노드는 차단됨
- [ ] 클리어(>=80%) 시 다음 노드가 AVAILABLE로 전환됨

### 대시보드
- [ ] `/dashboard` 접속 시 전체 진행률 표시
- [ ] 추천 노드로 바로 진입 가능
- [ ] 최근 이력이 실제 제출 결과와 일치

### 지도
- [ ] CLEARED/AVAILABLE/LOCKED/IN_PROGRESS 상태 색상 구분
- [ ] 범례 표시
- [ ] 학습 완료 후 상태 즉시 업데이트

### 문제 풀이
- [ ] 자동 저장 동작
- [ ] 새로고침 후 입력 복원
- [ ] 제출 전 정답 노출 없음

### 평가
- [ ] 제출 직후 결과 정확히 표시
- [ ] 다음 행동 버튼 동작

### 품질
- [ ] `npm test` 통과
- [ ] `npm run build` 통과
