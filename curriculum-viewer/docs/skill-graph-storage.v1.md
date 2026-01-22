# Skill-Graph v1 — Draft/Published 저장·버전·선택 규칙 (LocalStorage SSoT)

이 문서는 `skill-graph-v1`의 Draft/Published 저장 모델과 LocalStorage 키/스냅샷/최신 선택/학생 로딩 우선순위 정책을 **단일 결론(SSoT)** 으로 고정한다.

관련 문서:
- 스키마(형식): `curriculum-viewer/docs/skill-graph-schema.v1.md`
- 의미론/검증: `curriculum-viewer/docs/skill-graph-rules.md`
- (참고) 트리→그래프 변환 규칙(정책만, v1에서 기능 제공 안 함): `curriculum-viewer/docs/skill-graph-tree-compat.v1.md`

---

## 0) 결론 요약

- Draft는 **Author 편집용 작업본**이며 빈번히 저장(autosave)한다.
- Published는 **학생에게 배포되는 불변 스냅샷**이며 Draft와 분리 저장한다.
- 학생 화면은 **최신 Published skill-graph**를 기본 데이터 소스로 사용한다.
- v1에서는 `curriculum_math_v1.json`을 skill-graph로 **자동 변환/호환 기능을 제공하지 않는다**(정책만 문서화).

---

## 1) LocalStorage 키 설계(그래프별 draft/published, 최신 선택) (AC)

### 1.1 Key namespace

- Prefix: `curriculum-viewer`
- v1 key 버전 표기: `:v1:`

### 1.2 Draft (author, per-user, per-graph)

한 사용자가 여러 그래프를 편집할 수 있으므로 `userId`와 `graphId`로 스코프를 분리한다.

- Key: `curriculum-viewer:author:skill-graph:draft:v1:${userId}:${graphId}`
- Value: `SkillGraphDraftStoreV1` (2절)

### 1.3 Published (global, per-graph)

Published는 “배포 아티팩트”이므로 사용자별이 아닌 **전역(앱 단위)** 으로 저장한다.

- Key: `curriculum-viewer:skill-graph:published:v1:${graphId}`
- Value: `SkillGraphPublishedStoreV1` (3절)

### 1.4 Student 로딩 대상 선택(활성 그래프)

학생 화면이 어떤 `graphId`를 로드할지 결정하기 위한 최소 키를 둔다.

- Key: `curriculum-viewer:skill-graph:activeGraphId:v1`
- Value: string (`graphId`)

정책(결정):
- Author가 Publish할 때 `activeGraphId`를 해당 `graphId`로 설정할 수 있다(“배포 대상 선택”).
- 값이 없으면 학생 화면은 “published 그래프 없음” 안내를 표시한다(자동으로 임의 graphId를 선택하지 않음).

---

## 2) Draft 저장 모델(버전/타임스탬프) (AC)

```ts
type SkillGraphDraftStoreV1 = {
  version: 1
  schemaVersion: 'skill-graph-v1'
  graphId: string
  draft: SkillGraphV1
  createdAt: string // ISO8601
  updatedAt: string // ISO8601
}
```

정책(결정):
- autosave는 Draft에만 수행한다(예: 300~1000ms debounce).
- Draft는 수정 가능하며 “dirty” 표시는 UI 레벨에서 처리한다(저장 전/후).

---

## 3) Publish 스냅샷 생성 규칙 + 불변성 (AC)

### 3.1 Published 저장 모델

```ts
type SkillGraphPublishedSnapshotV1 = {
  publishedId: string // unique id (uuid 권장)
  schemaVersion: 'skill-graph-v1'
  graphId: string
  publishedAt: string // ISO8601
  graph: SkillGraphV1
  note?: string
}

type SkillGraphPublishedStoreV1 = {
  version: 1
  graphId: string
  snapshotsById: Record<string, SkillGraphPublishedSnapshotV1>
}
```

### 3.2 생성 규칙(결정)

Publish 시:
1. Draft(`SkillGraphV1`)를 **deep copy** 하여 snapshot.graph로 저장한다.
2. `publishedId`를 새로 생성한다(uuid 권장).
3. `publishedAt`을 현재 시각(ISO8601)으로 설정한다.
4. `snapshotsById[publishedId] = snapshot`으로 추가한다(기존 snapshot은 수정하지 않음).

불변성(결정):
- Published snapshot은 **절대 수정하지 않는다**.
- Draft를 바꿔도 기존 Published는 그대로 유지된다.
- 재배포는 “새 snapshot 추가”로만 수행한다.

---

## 4) 최신 published 선택 규칙 (AC)

대상:
- `SkillGraphPublishedStoreV1.snapshotsById`

규칙(결정):
1. `publishedAt`이 가장 큰 snapshot을 선택한다.
2. `publishedAt`이 같으면 `publishedId` 사전순(lexicographic)으로 가장 큰 것을 선택한다. (결정적 tie-breaker)

---

## 5) 학생 화면 로딩 우선순위(최신 published 우선, 없을 때 fallback) (AC)

학생 화면은 **Published skill-graph**를 기본 데이터 소스로 사용한다.

로딩 우선순위(결정):
1. `activeGraphId` 키(`curriculum-viewer:skill-graph:activeGraphId:v1`)를 읽는다.
2. 값이 없으면: “게시된 그래프가 없습니다. 관리자(Author)가 Publish 후 다시 시도하세요.” 안내를 표시한다.
3. 값이 있으면: 해당 `graphId`의 Published store(`curriculum-viewer:skill-graph:published:v1:${graphId}`)를 읽는다.
4. store가 없거나 snapshot이 0개면: “게시본이 없습니다.” 안내를 표시한다.
5. 최신 snapshot을 선택(4절)하고, `schemaVersion`이 `skill-graph-v1`이면 로드한다.
6. `schemaVersion`이 지원되지 않으면: “지원하지 않는 게시본 스키마 버전입니다.” 안내를 표시하고 로드를 중단한다.

fallback(결정):
- v1에서 `curriculum_math_v1.json`으로의 자동 fallback/자동 변환은 하지 않는다(혼선/암묵 정책 결정을 방지).

---

## 6) Import/Export 대상 정책 (AC)

Export(결정):
- 기본 Export 대상은 **Draft**다.
- 사용자가 선택하면 특정 Published snapshot(최신 또는 선택한 id)을 Export할 수 있다.

Import(결정):
- Import는 **Draft로만** 수행한다(기존 Draft를 교체).
- Import 실패 시 기존 Draft/Published는 **덮어쓰지 않는다**.
- Published로의 Import는 허용하지 않는다(불변성 위반 방지).

---

## 7) v1에서 자동 변환/호환을 제공하지 않는 결정 (AC)

결정:
- v1에서는 `curriculum_math_v1.json`(트리형 커리큘럼)을 `skill-graph-v1`로 **자동 변환/호환 기능을 제공하지 않는다**.

이유(요약):
- requires/prepares_for, nodeCategory, start는 정책 결정 요소이며, 자동 변환은 “암묵적 커리큘럼/진도 정책”을 만들어 회귀/논쟁을 유발한다.
- v1은 Author가 명시적으로 그래프를 편집/검증/Publish하는 흐름을 우선한다.

---

## 8) 플로우 예시 (AC)

### 8.1 정상 플로우(편집 → publish → 학생 갱신)

1. Author가 Draft를 편집하고 Draft key에 저장된다.
2. [Publish]를 누르면 snapshot이 생성되어 Published store에 추가된다.
3. Publish 시 `activeGraphId`가 해당 graphId로 설정된다(또는 이미 설정됨).
4. 학생 화면을 새로고침하면, `activeGraphId` → 최신 snapshot(4절) 순서로 로드되어 “배포된 그래프”가 갱신된다.

### 8.2 실패 플로우(게시본 없음 / 스키마 불일치)

- 게시본 없음:
  - `activeGraphId`가 없거나, 해당 graphId의 Published store가 비어있으면 학생 화면은 “게시본 없음” 안내를 표시한다.
- 스키마 불일치:
  - 최신 snapshot의 `schemaVersion`이 `skill-graph-v1`이 아니면 학생 화면은 “지원하지 않는 게시본 스키마 버전” 안내를 표시하고 로드를 중단한다.

