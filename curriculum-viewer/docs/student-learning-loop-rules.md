# Student Learning Loop Rules v1 — 데이터 계약/정책 SSoT (FE 단독/localStorage)

이 문서는 `curriculum-viewer`의 “학생 학습 루프(MVP)”를 **FE 단독(localStorage)** 으로 구현할 때 필요한
AttemptSession/Grading/NodeProgress 스키마와 상태/해제/추천/라우팅 정책을 **단일 결론(SSoT)** 으로 고정한다.

---

## 0) 용어

- `userId`: `AuthProvider`의 `user.id` (localStorage 키 스코프에 사용)
- `graph`: 학습 지도 데이터(노드/엣지). MVP에서는 정적/로컬 로딩을 전제한다.
- `problem`: 특정 `nodeId`에 연결된 문항(현행은 `public/data/problems_v1.json` 기반)
- `accuracy`: 정답률 = `correctCount / totalCount` (0~1)

---

## 1) AttemptSession 스키마 + 저장 키 (AC)

### 1.1 저장 키 규칙(결정)

한 사용자(userId)의 모든 세션은 단일 키에 저장한다.

- Key: `curriculum-viewer:student:attemptSessions:v1:${userId}`
- Value: JSON (아래 `AttemptSessionStoreV1`)

### 1.2 AttemptSessionStoreV1

```ts
type AttemptSessionStatus = 'DRAFT' | 'SUBMITTED'

type AttemptResponse = {
  problemId: string
  inputRaw: string
  updatedAt: string // ISO8601
}

type GradingResultV1 = {
  totalCount: number
  correctCount: number
  accuracy: number // correctCount/totalCount (0~1)
  cleared: boolean // accuracy >= CLEAR_THRESHOLD
  perProblem: Record<string, { isCorrect: boolean; expectedAnswer?: string }>
}

type AttemptSessionV1 = {
  nodeId: string
  sessionId: string
  status: AttemptSessionStatus
  responses: Record<string, AttemptResponse> // key=problemId
  grading?: GradingResultV1 // status==="SUBMITTED"에서만 생성/저장
  createdAt: string // ISO8601
  updatedAt: string // ISO8601
}

type AttemptSessionStoreV1 = {
  version: 1
  sessionsById: Record<string, AttemptSessionV1>
  draftSessionIdByNodeId: Record<string, string> // nodeId -> sessionId
}
```

### 1.3 없을 때/손상 JSON 처리(결정)

- key가 없으면: `{version:1, sessionsById:{}, draftSessionIdByNodeId:{}}`로 간주
- JSON 파싱 실패/버전 불일치/필드 타입 불일치: 해당 key를 무시(권장: key 제거 후 초기화)

---

## 2) 채점(Grading) 정책(결정)

### 2.1 채점 트리거

- `DRAFT`: 입력 변경 시 300~800ms 디바운스로 `responses[problemId].inputRaw`만 저장
- `SUBMITTED`: 사용자가 [제출]을 누른 시점에 `grading`을 계산하고 session.status를 `SUBMITTED`로 변경

### 2.2 정답률/클리어 기준(AC)

- `CLEAR_THRESHOLD = 0.8` (>= 80%면 CLEARED)
- `totalCount`는 해당 `nodeId`의 문제 수(문제은행 기준)다.
- `correctCount`는 `SUBMITTED` 시점에 채점된 정답 개수다.
- `accuracy = correctCount / totalCount`
- `cleared = (totalCount > 0) && (accuracy >= CLEAR_THRESHOLD)`

예외:
- `totalCount === 0`이면 `cleared=false`로 고정하며, 해당 노드는 학습 루프 대상에서 제외한다(지도에서 잠금 사유로 안내).

---

## 3) NodeProgress 스키마(결정)

NodeProgress는 “상태 계산을 위한 파생 데이터”이며, 저장은 optional이다(매번 sessions에서 재계산 가능).

```ts
type NodeStatus = 'CLEARED' | 'IN_PROGRESS' | 'AVAILABLE' | 'LOCKED'

type NodeProgressV1 = {
  nodeId: string
  status: NodeStatus
  bestAccuracy: number | null // SUBMITTED가 없으면 null
  lastAttemptAt: string | null // DRAFT.updatedAt 또는 SUBMITTED.updatedAt 중 max
  clearedAt: string | null // 처음 CLEARED가 된 SUBMITTED.updatedAt
  lockedReasons?: { missingPrereqNodeIds: string[] } // status==="LOCKED"에서만
}
```

---

## 4) 노드 상태 계산 규칙(CLEARED/AVAILABLE/LOCKED/IN_PROGRESS) (AC)

### 4.1 입력

- `graph.nodes[]`: 최소 필드 `id(nodeId)`, `isStart:boolean?`, `order:number?`
- `graph.edges[]`: 최소 필드 `sourceId`, `targetId`, `type: "requires" | "prepares_for"`
- `sessions`: AttemptSessionStoreV1

### 4.2 파생 집합

- `draft(nodeId)`:
  - `draftSessionIdByNodeId[nodeId]`가 존재하고,
  - 해당 session이 존재하며 `status==="DRAFT"`인 경우만 유효
- `bestSubmitted(nodeId)`:
  - 해당 nodeId의 `status==="SUBMITTED"` 세션들 중 `grading.accuracy`가 가장 높은 것(동점이면 `updatedAt` 최신)
- `cleared(nodeId)`:
  - `bestSubmitted(nodeId)?.grading.cleared === true`

### 4.3 상태 결정(결정)

우선순위는 아래 순서로 평가한다.

1) `CLEARED`: `cleared(nodeId) === true`
2) `IN_PROGRESS`: `draft(nodeId) 존재` **또는** (`bestSubmitted(nodeId)`가 존재하고 `cleared(nodeId)===false`)
3) `AVAILABLE`: (노드가 학습 대상이고) 5절의 해제 규칙을 만족
4) `LOCKED`: 그 외

미달 제출 처리(AC):
- SUBMITTED 했지만 `accuracy < 0.8`이면 노드는 `IN_PROGRESS`로 유지된다.

---

## 5) 해제(AVAILABLE) 규칙 — requires/prepares_for 처리 (AC)

### 5.1 엣지 의미(결정)

- `requires`: target을 풀기 위한 **필수 선행 조건** (unlock에 사용)
- `prepares_for`: 학습 흐름/추천을 위한 **권장 연결** (unlock에는 사용하지 않음)

### 5.2 AVAILABLE 조건(결정)

노드 `N`이 `CLEARED/IN_PROGRESS`가 아닌 경우에만 unlock을 평가한다.

`N`이 `AVAILABLE`이려면 아래 중 하나를 만족해야 한다.

1) `isStart === true`
2) `requires` 선행을 모두 만족:
   - `prereq(N) = { e.sourceId | e.type==="requires" && e.targetId===N.id }`
   - `prereq(N)`의 모든 노드가 `CLEARED`

그 외는 `LOCKED`이며, 잠금 사유로 `missingPrereqNodeIds = prereq(N) - clearedSet`를 제공한다.

---

## 6) 추천 정책(결정) (AC)

추천은 “지금 바로 진행 가능한 다음 행동 1개”를 결정적으로 반환한다.

### 6.1 후보 풀(결정)

- 1순위 후보: `IN_PROGRESS` 노드들
- 2순위 후보: `AVAILABLE` 노드들

### 6.2 tie-breaker(결정)

- IN_PROGRESS 후보 선택:
  1) `lastAttemptAt` 최신
  2) `order` 오름차순(없으면 999999)
  3) `nodeId` 사전순

- AVAILABLE 후보 선택:
  1) `order` 오름차순(없으면 999999)
  2) `nodeId` 사전순

### 6.3 requires/prepares_for의 추천 반영(결정)

다음 노드 추천은 위 후보 풀 규칙을 기본으로 하되,
직전 행동이 “어떤 노드의 SUBMITTED”인 경우에는 아래 보정을 먼저 적용한다.

- 직전 SUBMITTED 노드 `X`가 **CLEARED** 되었으면:
  - `prepares_for` 엣지 `X -> Y` 중에서 `Y`가 `AVAILABLE`인 노드가 있으면, 그 중 tie-breaker(AVAILABLE)를 적용해 1개를 우선 추천한다.
- 그 외에는 6.1~6.2 기본 규칙을 적용한다.

---

## 7) 라우팅/CTA 흐름(결정) (AC)

### 7.1 라우트(결정)

- `/dashboard`: 요약 + 이어하기 + 추천(1~3개) + 최근 활동
- `/map`: 지도(그래프) + 노드 상세 + 상태/잠금 사유 + CTA
- `/learn/:nodeId`: 문제 풀이(DRAFT 자동 저장) + 제출
- `/eval/:sessionId`: 제출 결과(정답률/문항별 정오) + 다음 행동 CTA
- `/report`: 통계/약점(최소: 노드별 status, 평균 정답률, 최근 학습일)

### 7.2 주요 CTA(결정)

- `/dashboard`
  - [이어하기] → 추천 정책으로 선택된 `nodeId`로 `/learn/:nodeId`
  - [바로 도전] → `/learn/:nodeId`
- `/map`
  - `AVAILABLE` 노드: [도전하기] 활성 → `/learn/:nodeId`
  - `LOCKED` 노드: CTA 비활성 + `missingPrereqNodeIds` 표시
  - `IN_PROGRESS` 노드: [이어하기] 활성 → `/learn/:nodeId`
- `/learn/:nodeId`
  - [제출] → grading 계산 후 `/eval/:sessionId`
- `/eval/:sessionId`
  - CLEARED: [다음 노드] → 6절 추천 정책으로 산출된 `nodeId`로 `/learn/:nodeId` (없으면 `/map`)
  - 미달: [재도전] → 동일 `nodeId`로 `/learn/:nodeId` (재도전 정책은 별도 티켓에서 확정)

---

## 8) TDD 벡터(6세트 이상) + JSON fixture 안내

FE가 그대로 테스트에 옮길 수 있도록 JSON fixture를 제공한다.

- Fixture: `docs/student-learning-loop-fixtures.v1.json`
- 포함: 그래프/세션 입력 + 기대 `statusByNodeId` + 기대 추천 노드
