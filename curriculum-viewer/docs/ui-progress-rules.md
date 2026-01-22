# UI Progress Rules v1 — 학습 결과/상태/집계(대시보드·리포트) + 라우팅 규칙

이 문서는 `curriculum-viewer`의 **현행 저장 구조로 가능한 범위**에서,
학습 진행 상태(complete / in-progress / not-started)와 대시보드/리포트 집계, 라우팅/게이팅 원칙을 고정한다.

관련 코드(근거):
- lastResult 저장/복구: `src/pages/LearnPage.tsx`
- 입력 정규화: `src/lib/learn/grading.ts` (`normalizeNumericInput`)
- 문제은행 스키마/버전: `src/lib/learn/problems.ts`
- 라우팅/게이팅: `src/App.tsx`, `src/components/RequireAuth.tsx`

관련 데이터:
- 커리큘럼: `public/data/curriculum_math_v1.json` (노드 계층/도메인 그룹핑에 사용)
- 문제은행: `public/data/problems_v1.json` (`problemsByNodeId`가 standard 노드 ID에 매핑)

---

## 1) 데이터 소스 인벤토리 (AC)

### 1.1 localStorage lastResult

- Key 패턴: `curriculum-viewer:learn:lastResult:${nodeId}`
- `nodeId`: 커리큘럼의 `standard` 노드 ID (예: `MATH-2022-G-3-NA-001`)

현행 스키마(`LearnPage.tsx`) — **암묵적 v1**:
```ts
type StoredResult = {
  nodeId: string
  updatedAt: string // ISO8601
  submissions: Record<string, { submitted: string; isCorrect: boolean }>
}
```

버전(결정):
- v1은 **별도의 version 필드가 없다**(필드 집합 자체가 v1).
- 추후 스키마 변경 시에는 아래 중 1개로 고정한다.
  - `StoredResult.schemaVersion` 필드 도입(권장), 또는
  - localStorage key에 버전 포함(예: `...:v2:${nodeId}`) 후 v1과 병행 지원

제약(중요):
- “draft(입력 중, 제출 전)”은 localStorage에 기록되지 않는다.
- 따라서 `in-progress` 판정은 **제출(채점) 기록이 존재**할 때만 가능하다.

### 1.2 문제은행 ↔ 커리큘럼 연결

- 문제은행은 `problemsByNodeId[nodeId] = Problem[]` 형태로 `standard`에만 직접 매핑된다.
- `domain/grade/subject`는 자신의 descendant `standard`들의 결과를 집계하여 상태를 산출한다.

---

## 2) 상태 판정 규칙 (현행 저장 구조로 가능한 정의) (AC)

### 2.1 용어/정의

- `problems`: 현재 문제은행에서 `nodeId`에 매핑된 문제 배열
- `total = problems.length`
- `submissions`: StoredResult.submissions (없으면 `{}`로 취급)

정규화:
- `normalize(x) = normalizeNumericInput(x)` (공백/쉼표 제거 후 trim)

유효 제출(결정적 공식):
- `submitted = # { p ∈ problems | submissions[p.id] 존재 AND normalize(submissions[p.id].submitted).length > 0 }`
- `correct = # { p ∈ problems | submissions[p.id] 존재 AND normalize(submissions[p.id].submitted).length > 0 AND submissions[p.id].isCorrect === true }`

### 2.2 Standard 상태

임계값:
- 기본 `threshold = 1.0` (정답률 100%)
- 옵션으로 `threshold ∈ (0, 1]` 지원 가능(설정 값)

상태:
- `not-started`: `submitted === 0`
- `in-progress`: `submitted > 0` AND (완료 조건 미충족)
- `complete`: `total > 0` AND `submitted === total` AND `(correct / total) >= threshold`
- `no-content`(결정): `total === 0`
  - 집계(결정): 집계/추천/약점/분모에서 제외(아래 3절, 7절, 8절의 분모 규칙에 포함)
  - UI 표시(결정):
    - 트리/그래프: `no-content` 상태로 별도 표기(예: 배지/아이콘)하고, 학습 진입(`/learn/:nodeId`) 액션은 비활성/숨김 처리
    - 대시보드/리포트: 진행률/약점/추천 계산과 표에서 제외(학습자 지표에 노출하지 않음)
    - /health(개발자용): 필요 시 “no-content 노드 수/목록”으로 별도 노출 가능(학습자 UX와 분리)

### 2.3 상위 노드 상태(집계)

상위 노드 `N`의 descendant standard 집합을 `S`라 할 때:
- 기본 집계 대상: `eligible = { s ∈ S | total(s) > 0 }` (no-content 제외)

상태:
- `not-started`: `eligible`가 비었거나, `eligible`의 모든 `s`가 `not-started`
- `complete`: `eligible`가 비어있지 않고, `eligible`의 모든 `s`가 `complete`
- `in-progress`: 그 외

---

## 3) 집계/추천을 위한 값 정의(최소) (참고)

### 3.1 Domain 그룹핑 키

Domain 그룹 키(결정적):
1) `domain_code`(trim 후 non-empty)
2) 없으면 `domain.title`
3) 그래도 없으면 `domain.id`

### 3.2 추천(최소 정책)

추천 후보 풀:
- `standard` AND `total > 0` AND 상태가 `complete`가 아님

추천 도메인(그룹) 선택:
- 비교 대상: 추천 후보 standard를 **1개 이상 포함하는** 그룹만 포함
- 그 중 `completionRate = completedCount/eligibleCount`가 가장 낮은 그룹 선택
- `eligibleCount === 0`로 인해 `completionRate === null`인 그룹은 비교 대상에서 제외
- tie-breaker: 그룹 키 사전순

추천 standard 선택(선택된 그룹 내부):
- `correctRate = correct/total`이 가장 낮은 standard
- tie-breaker: `grade` 오름차순(없으면 999) → `nodeId` 사전순

후보가 0개면:
- 추천 없음(학습 완료 상태)

---

## 4) 예외 케이스 처리 원칙 (최소 6개 이상) (AC)

1) **손상 JSON**: localStorage 값이 파싱 불가 → 결과 무시(권장: key 제거)
2) **스키마 불일치**: `nodeId` 불일치 또는 `submissions`가 object가 아님 → 무시(권장: key 제거)
3) **문제은행에 노드 매핑 없음**: `problemsByNodeId[nodeId]`가 없음/빈 배열 → `total=0`으로 보고 `no-content` 취급(권장: 집계/추천 제외)
4) **문제 ID 불일치(추가/삭제/변경)**:
   - 현재 `problems`에 없는 `submissions`의 problemId는 무시
   - 현재 `problems`에 있는데 `submissions`에 없으면 미제출로 간주
5) **빈 문자열/공백 제출**: `normalize(submitted).length === 0`이면 미제출로 간주(상태 판정에 포함하지 않음)
6) **제출 일부 누락**: 일부 문제만 제출된 경우는 `in-progress`로 판정(완료 불가)
7) **문제은행 버전 변경**: `ProblemBank.version`이 바뀌면 과거 lastResult의 의미가 바뀔 수 있음 → mismatch 시 무효로 취급(구현 시 StoredResult에 버전 저장 또는 key에 버전 포함 중 1개로 고정 권장)
8) **isCorrect 비정상**
   - 현행 복구 동작(근거: `LearnPage.tsx`): `Boolean(submission.isCorrect)`로 캐스팅하여 truthy면 `true`
   - 권장 규범(추후 정합화 필요): `typeof isCorrect === "boolean"`만 허용, 그 외는 `false` 또는 해당 submission 무시

---

## 5) 상태 판정 테스트 벡터(입력 예시 + 기대 상태) 8개 이상 (AC)

아래 벡터는 `standard` 1개에 대한 판정 예시다. (`threshold=1.0` 기준)
`problems = [{id:"p1"},{id:"p2"},{id:"p3"}]`로 가정한다.

1) **T1 not-started (결과 없음)**
   - lastResult: 없음
   - 기대: `submitted=0`, `not-started`

2) **T2 not-started (빈 제출만 존재)**
   - lastResult.submissions: `{ "p1": { "submitted": "   ", "isCorrect": false } }`
   - 기대: normalize 후 길이 0 → `submitted=0`, `not-started`

3) **T3 in-progress (1개만 제출/정답)**
   - lastResult.submissions: `{ "p1": { "submitted": "1", "isCorrect": true } }`
   - 기대: `submitted=1`, `correct=1`, `in-progress`

4) **T4 in-progress (2개 제출, 1개 오답)**
   - lastResult.submissions: `{ "p1": { "submitted": "1", "isCorrect": true }, "p2": { "submitted": "2", "isCorrect": false } }`
   - 기대: `submitted=2`, `correct=1`, `in-progress`

5) **T5 complete (3개 모두 제출/정답)**
   - lastResult.submissions: `{ "p1": { "submitted": "1", "isCorrect": true }, "p2": { "submitted": "2", "isCorrect": true }, "p3": { "submitted": "3", "isCorrect": true } }`
   - 기대: `submitted=3`, `correct=3`, `complete`

6) **T6 in-progress (3개 모두 제출, 1개 오답)**
   - lastResult.submissions: `{ "p1": { "submitted": "1", "isCorrect": true }, "p2": { "submitted": "2", "isCorrect": true }, "p3": { "submitted": "3", "isCorrect": false } }`
   - 기대: `submitted=3`, `correct=2`, 정답률<1.0 → `in-progress`

7) **T7 not-started (문제은행에 없는 problemId만 있음)**
   - lastResult.submissions: `{ "px": { "submitted": "1", "isCorrect": true } }`
   - 기대: `px`는 무시 → `submitted=0`, `not-started`

8) **T8 in-progress (쉼표 포함 제출은 유효)**
   - lastResult.submissions: `{ "p1": { "submitted": "1,000", "isCorrect": true } }`
   - 기대: normalize("1,000") = "1000" → `submitted=1`, `in-progress`

9) **T9 no-content**
   - problems: `[]`
   - lastResult: 어떤 값이든 무시
   - 기대: `no-content`

---

## 6) 구현 체크리스트(요약)

- 제출/정답 집계는 반드시 “현재 문제은행의 problems” 기준으로 계산한다(문제 ID 불일치 무시).
- `no-content(total=0)`는 집계/추천/약점/분모에서 제외(결정)하여 null/공집합 추천을 방지한다.
- 문제은행 버전 mismatch 정책(StoredResult에 버전 저장 vs key 버전 포함) 중 1개로 고정한다.

---

## 7) 대시보드 지표 정의(계산 범위/공식) (AC)

이 절은 “전체 요약 카드/차트”에 사용되는 지표의 **정의와 계산 범위**를 고정한다.

### 7.1 스캔 범위(결정)

- 커리큘럼 기준 노드 집합: `curriculum_math_v1.json`의 `type === "standard"` 노드들
- 문제은행 기준 문제 집합: `problemsByNodeId[nodeId]`로 조회되는 문제 배열
- 사용자 결과 스캔: localStorage에서 prefix `curriculum-viewer:learn:lastResult:`로 시작하는 모든 키를 대상으로 파싱한다.

집계의 기본 원칙:
- 집계는 **현재 커리큘럼 + 현재 문제은행** 기준으로 계산한다.
- `total === 0`(no-content)인 standard는 **분모/추천/약점 집계에서 제외**한다.
- localStorage가 손상/스키마 불일치인 항목은 4절의 원칙대로 **무시**한다.

### 7.2 전체 진행률(노드 기준)

`eligibleStandards = { s | total(s) > 0 }`

- `completedStandards = # { s ∈ eligibleStandards | status(s) === "complete" }`
- `eligibleStandardCount = |eligibleStandards|`
- `overallCompletionRate = completedStandards / eligibleStandardCount` (단, 분모 0이면 `null`)

표시 권장:
- `"총 완료 노드/전체"` = `${completedStandards}/${eligibleStandardCount}`
- `%`는 `overallCompletionRate`를 0~100으로 변환(반올림 정책은 UI에서 결정)

### 7.3 총 푼 문제 수(문제 기준)

표준 정의(결정):
- “푼 문제”는 **제출(채점) 기록이 있고, 제출값이 비어있지 않은 문제**를 의미한다(2.1의 `submitted` 정의).

공식:
- `totalSubmittedProblems = Σ_{s ∈ eligibleStandards} submitted(s)`

### 7.4 평균 정답률(제출한 문제 기준)

표준 정의(결정):
- “평균 정답률”은 **제출한 문제들에 대한 정답률**이다(미제출 문제는 분모에 포함하지 않음).

공식:
- `totalCorrectProblems = Σ_{s ∈ eligibleStandards} correct(s)`
- `averageAccuracy = totalCorrectProblems / totalSubmittedProblems` (단, 분모 0이면 `null`)

### 7.5 최근 학습일

표준 정의(결정):
- “최근 학습일”은 유효한 StoredResult들의 `updatedAt` 중 최댓값이다.

공식:
- `latestUpdatedAt = max(parseISO(stored.updatedAt))` over all valid StoredResult (단, 유효한 값이 없으면 `null`)

예외:
- `updatedAt`이 파싱 불가면 해당 항목은 최근 학습일 계산에서 제외한다(단, 상태/정답률 판정은 submissions 기반으로 계속 가능).

### 7.6 차트 구현 방식(결정) (AC)

결론:
- **MVP는 SVG/CSS 기반 차트**로 구현한다. (Recharts 도입하지 않음)

근거:
- 현재 의존성에 Recharts가 없으며, 간단한 진행률/막대/도넛은 SVG/CSS로 충분하다.
- UI 확정 전 라이브러리 도입 비용(번들 증가/테마 커스터마이즈)을 최소화한다.

영향:
- 차트는 단순한 비율/비교 표현에 한정한다(복잡한 인터랙션은 v2 검토).
- Recharts 도입은 v2에서 별도 결정으로 분리하며, 도입 시 컴포넌트/데이터 모델을 재검토한다.

---

## 8) 리포트 약점 기준 + 상위 N개 노출 규칙 (AC)

### 8.1 Domain 집계 값(문제 가중치)

도메인 `D`의 descendant standard 집합을 `S(D)`라 할 때:
- `eligible(D) = { s ∈ S(D) | total(s) > 0 }`
- `domainTotal(D) = Σ total(s)`
- `domainSubmitted(D) = Σ submitted(s)`
- `domainCorrect(D) = Σ correct(s)`

정의(결정):
- `domainMastery(D) = domainCorrect(D) / domainTotal(D)` (단, 분모 0이면 `null`)
  - 해석: “도메인 전체 문제 대비 정답 비율”(미제출은 0점으로 반영)

### 8.2 약점 판정(결정)

- 기본 `weaknessThreshold = 0.6` (60%)
- `weak(D) = domainMastery(D) !== null AND domainMastery(D) < weaknessThreshold`

표시(권장 라벨):
- `domainSubmitted(D) === 0`이면 “미시도”
- 그 외 `weak(D) === true`이면 “약점”

### 8.3 상위 N개 노출(결정)

- 기본 `N = 3`
- 후보: `domainMastery(D) !== null` 인 도메인만 포함
- 정렬: `domainMastery` 오름차순 → `domain_code/title/id`(3.1의 그룹 키) 사전순
- 노출: 정렬된 결과에서 `weak(D) === true`인 것 중 상위 N개
- 약점 후보가 N개 미만이면: 표시 가능한 만큼만 노출(0개면 약점 섹션 숨김)

### 8.4 약점 도메인에 대한 학습 제안 링크(최소 정책)

- 약점 도메인 `D`에 대해, 3.2의 “추천 standard 선택” 규칙을 적용하여 `recommendedStandardId(D)`를 1개 산출한다.
- 링크: `/learn/:nodeId`로 연결한다.

---

## 9) 라우트/네비게이션/로그인 게이팅 정책 (AC)

이 절은 “어떤 페이지가 존재하고(/dashboard, /report, /health), 로그인 여부에 따라 어떻게 동작하는지”를 고정한다.

참고(현행 구현과의 차이):
- 현행 `App.tsx`는 `/health`를 “리포트”로 노출하고, `/graph`/`/health`는 비게이팅이다.
- v1 규범은 `/report`를 학습자 리포트로 분리하고, `/health`는 개발자용으로 메뉴에서 숨기며, 학습자 페이지는 로그인 게이팅한다.

### 9.1 라우트 역할(결정)

- `/dashboard`: 학습자용 대시보드(전체 현황/요약 지표/영역별 통계)
- `/report`: 학습자용 리포트(약점/권장 학습 제안)
- `/health`: **개발자용 데이터 검증**(학습자 메뉴에서 숨김)

### 9.2 로그인 게이팅(결정)

- 게이팅 대상(로그인 필요): `/dashboard`, `/tree`, `/graph`, `/learn/:nodeId`, `/report`
- 비게이팅: `/login`, `/signup`, `/health`

표준 동작(결정):
- 비로그인 상태에서 게이팅 경로 진입 시 `/login`으로 리다이렉트하고, 원래 목적지(state.from)를 보존한다.

### 9.3 네비게이션 표기(결정)

- 로그인 상태:
  - 메뉴 노출: 대시보드, 트리, 그래프, 리포트
  - 로그아웃 버튼 노출
- 비로그인 상태:
  - 학습자 메뉴(대시보드/트리/그래프/리포트)는 **숨김**
  - 로그인/회원가입 버튼만 노출
