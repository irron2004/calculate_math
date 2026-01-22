# curriculum_math_v1 데이터 계약(v1)

목표: `curriculum-viewer`가 읽는 수학 커리큘럼 JSON의 **스키마/ID 규칙/검증 규칙/Progression 엣지 정의**를 단일 소스 오브 트루스로 고정한다. (Ticket: `RESEARCH-1`)

- 샘플 데이터: `curriculum-viewer/public/data/curriculum_math_v1.json`
- 검증(현재 CI/로컬용): `cd curriculum-viewer && npm run validate:data`
- UI 리포트(브라우저): `curriculum-viewer/src/lib/curriculum/validate.ts` 기반

---

## 1) Top-level 스키마

```ts
type CurriculumData = {
  meta?: Record<string, unknown>
  nodes: CurriculumNode[]
}
```

- `meta` (**권장**): 공급자/버전/참조 등 메타데이터(자유 형식)
- `nodes` (**필수**): 커리큘럼 노드 배열

### meta 필드 규범성(필수/권장/정보성)

현행 샘플 데이터(`curriculum-viewer/public/data/curriculum_math_v1.json`)는 `meta.schema_version`을 포함하지만,
**v1 계약에서는 meta 전체를 “권장(비차단)”으로 둔다.**

- `meta` 자체: **권장** (없어도 계약 위반 아님)
- `meta.schema_version`: **정보성** (권장). 값은 관례적으로 `"curriculum_math_v1"`를 사용하되, 누락/불일치는 계약 에러로 차단하지 않는다.
- 기타 meta 필드(예: `curriculum_id`, `locale`, `generated_at`, `sources`, `note`): **정보성** (표시/추적용)

---

## 2) 노드 스키마(공통)

```ts
type CurriculumNodeType = 'subject' | 'grade' | 'domain' | 'standard'

type CurriculumNode = {
  id: string
  type: CurriculumNodeType
  title: string
  parent_id?: string
  children_ids: string[]

  // Optional fields (see per-type table)
  subject?: string
  grade_band?: string
  grade?: number
  domain?: string
  domain_code?: string
  official_code?: string
  text?: string
  source?: Record<string, unknown>
}
```

### 공통 규범(필수)

- `id`: **필수**, non-empty string, 전체 `nodes`에서 **유니크**
- `type`: **필수**, `subject|grade|domain|standard` 중 하나
- `title`: **필수**, non-empty string
- `children_ids`: **필수**, `string[]` (leaf는 `[]`)
- `parent_id`:
  - `type === "subject"`: **금지** (존재하면 에러)
  - 그 외: **필수**, non-empty string

### 타입 계층(필수)

- 부모/자식 타입은 **오직** 아래 계층만 허용한다.
  - `subject → grade → domain → standard`

---

## 3) 노드 타입별 필수/선택 필드 표 (AC1)

| type | 필수(Required) | 선택/권장(Optional/Recommended) | 비고 |
|---|---|---|---|
| `subject` | `id,type,title,children_ids` | `subject`, `source` | `parent_id` 금지 |
| `grade` | `id,type,title,parent_id,children_ids` | `subject`, `grade`(int), `grade_band`, `source` | 특수 grade(예: creative)는 `grade`가 없을 수 있음 |
| `domain` | `id,type,title,parent_id,children_ids` | `subject`, `grade_band`, `domain`, `source` | **Progression 최소 필드**: `domain_code`(non-empty), `grade`(int) |
| `standard` | `id,type,title,parent_id,children_ids` | `subject`, `grade_band`, `grade`, `domain`, `domain_code`, `official_code`, `text`, `source` | v1에서 `children_ids: []` **필수(leaf)** |

---

## 4) ID 규칙(접두/구분자/유니크) + 예시 (AC2)

### 규범(필수)

- `nodes[*].id`는 전체에서 **중복 금지**
- `id`는 trim 후 비어있으면 안 됨

### 컨벤션(권장)

- 구분자: `-` (하이픈)
- 권장 문자셋: `A-Z`, `0-9`, `-`
- v1 컨벤션 예시
  - `subject`: `{SUBJECT}-{VERSION}` (예: `MATH-2022`)
  - `grade(정규)`: `{SUBJECT}-{VERSION}-G-{GRADE}` (예: `...-G-3`)
  - `grade(특수)`: `{SUBJECT}-{VERSION}-{TAG}` (예: `...-CREATIVE`)
  - `domain`: `{SUBJECT}-{VERSION}-G-{GRADE}-D-{DOMAIN_CODE}`
  - `standard`: `{SUBJECT}-{VERSION}-G-{GRADE}-{DOMAIN_CODE}-{SEQ3}` (`SEQ3`는 `001`처럼 0-padding)

### 예시(샘플 데이터 발췌, 10개 이상)

- `MATH-2022`
- `MATH-2022-CREATIVE`
- `MATH-2022-G-1`
- `MATH-2022-G-2`
- `MATH-2022-G-3`
- `MATH-2022-G-1-D-NA`
- `MATH-2022-G-3-D-RR`
- `MATH-2022-G-1-NA-001`
- `MATH-2022-G-3-NA-003`
- `MATH-2022-G-3-RR-002`
- `MATH-2022-G-6-D-NA`
- `MATH-2022-G-6-NA-001`

---

## 5) 검증 규칙(에러/경고) + 성공/실패 예시 (AC3)

여기서 “에러/경고”는 **데이터 계약 기준**의 심각도다.

- `validate:data`(node 스크립트)는 기본적으로 **에러 수준 위반을 차단**하는 용도
- UI 리포트는 같은 규칙을 표시하되, 제품 정책에 따라 warning을 error로 상향할 수 있다
- 현행 구현(`validate.ts` / `validate-data.mjs`)과 코드/심각도 정합성은 섹션 말미의 “현행 구현 매핑 표”를 따른다.

### Error (차단 권장)

#### E1. `invalid_schema` — Top-level/노드 기본 스키마 위반

- 성공:
```json
{ "nodes": [ { "id": "S", "type": "subject", "title": "Math", "children_ids": [] } ] }
```
- 실패:
```json
{ "nodes": "not-an-array" }
```
- 기대 메시지(초안): `invalid_schema: top-level.nodes must be an array`

#### E2. `duplicate_id` — ID 중복

- 성공:
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": [] },
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "S", "children_ids": [] }
] }
```
- 실패:
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S1", "children_ids": [] },
  { "id": "S", "type": "subject", "title": "S2", "children_ids": [] }
] }
```
- 기대 메시지(초안): `duplicate_id: Duplicate id: S`

#### E3. `missing_parent` — non-subject의 `parent_id` 누락/부모 노드 없음

- 성공:
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": ["G1"] },
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "S", "children_ids": [] }
] }
```
- 실패:
```json
{ "nodes": [
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "S", "children_ids": [] }
] }
```
- 기대 메시지(초안): `missing_parent: Missing parent node: G1 (grade) -> S`

#### E4. `missing_child` — `children_ids`가 존재하지 않는 노드를 참조

- 성공:
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": ["G1"] },
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "S", "children_ids": [] }
] }
```
- 실패:
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": ["G404"] }
] }
```
- 기대 메시지(초안): `missing_child: Missing child node: S (subject) -> G404`

#### E5. `type_hierarchy` — 타입 계층 위반(고정: subject→grade→domain→standard)

- 성공:
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": ["G1"] },
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "S", "children_ids": ["D1"] },
  { "id": "D1", "type": "domain", "title": "D1", "parent_id": "G1", "children_ids": [] }
] }
```
- 실패(도메인의 부모가 subject):
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": ["D1"] },
  { "id": "D1", "type": "domain", "title": "D1", "parent_id": "S", "children_ids": [] }
] }
```
- 기대 메시지(초안): `type_hierarchy: parent of D1 (domain) must be grade, got S (subject)`

#### E6. `leaf_has_children` — leaf(standard)가 `children_ids`를 가지면 안 됨

- 성공:
```json
{ "nodes": [
  { "id": "D1", "type": "domain", "title": "D1", "parent_id": "G1", "children_ids": ["ST1"] },
  { "id": "ST1", "type": "standard", "title": "ST1", "parent_id": "D1", "children_ids": [] }
] }
```
- 실패:
```json
{ "nodes": [
  { "id": "ST1", "type": "standard", "title": "ST1", "parent_id": "D1", "children_ids": ["X"] }
] }
```
- 기대 메시지(초안): `leaf_has_children: standard must have empty children_ids: ST1 (standard)`

#### E7. `cycle` — `parent_id` 체인 사이클 존재

- 성공:
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": ["G1"] },
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "S", "children_ids": [] }
] }
```
- 실패:
```json
{ "nodes": [
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "D1", "children_ids": [] },
  { "id": "D1", "type": "domain", "title": "D1", "parent_id": "G1", "children_ids": [] }
] }
```
- 기대 메시지(초안): `cycle: Cycle detected via parent chain: G1 -> D1`

### Warning (표시/개선 권장)

#### W1. `bidirectional_mismatch` — parent/child 양방향 참조 불일치

정의:
- child의 `parent_id === parent.id` 이어야 하고
- parent의 `children_ids`에 child.id가 포함되어야 한다

렌더링 결정 규칙(권장):
- 트리/그래프의 “contains”는 `children_ids`를 **source of truth**로 사용(현재 구현도 `children_ids` 기반)
- `parent_id`는 breadcrumb/상세 패널에 사용
- 따라서 mismatch는 발견 즉시 수정 권장(데이터 품질 이슈)

- 성공:
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": ["G1"] },
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "S", "children_ids": [] }
] }
```
- 실패(부모가 children_ids에 누락):
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": [] },
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "S", "children_ids": [] }
] }
```
- 기대 메시지(초안): `bidirectional_mismatch: parent.children_ids missing child G1 (grade) (parent: S (subject))`

#### W2. `orphan` — 루트에서 도달 불가한 노드

- 성공:
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": ["G1"] },
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "S", "children_ids": [] }
] }
```
- 실패(연결 단절):
```json
{ "nodes": [
  { "id": "S", "type": "subject", "title": "S", "children_ids": [] },
  { "id": "G1", "type": "grade", "title": "G1", "parent_id": "S", "children_ids": [] }
] }
```
- 기대 메시지(초안): `orphan: unreachable from roots: G1 (grade)`

#### W3. `domain_progression_incomplete_key` — progression 키 누락으로 엣지 생성 스킵

Progression은 `domain` 노드의 `(domain_code, grade)`를 키로 사용한다. 아래 케이스는 스킵되므로 개선 권장:
- `domain_code`가 비어있음/공백
- `grade`가 integer가 아님

- 성공:
```json
{ "nodes": [
  { "id": "D2", "type": "domain", "title": "NA", "parent_id": "G2", "children_ids": [], "domain_code": "NA", "grade": 2 }
] }
```
- 실패:
```json
{ "nodes": [
  { "id": "D2", "type": "domain", "title": "NA", "parent_id": "G2", "children_ids": [], "domain_code": "NA" }
] }
```
- 기대 메시지(초안): `domain_progression_incomplete_key: require integer grade + non-empty domain_code: D2 (domain)`

---

### 현행 구현 매핑 표(코드/심각도 정합성)

현행 구현은 2종이다:

- UI 리포트: `curriculum-viewer/src/lib/curriculum/validate.ts` (issue `code`/`severity`를 가짐)
- CLI: `curriculum-viewer/scripts/validate-data.mjs` (코드 체계 없이 문자열 에러를 출력하며, 현재는 대부분 “차단”으로 동작)

아래 표는 **이 문서의 규칙 ID**를 현행 구현에 매핑한다.

| 계약 규칙 ID(문서) | UI `validate.ts` 매핑(code/severity) | CLI `validate-data.mjs` 매핑(현재 동작) |
|---|---|---|
| `invalid_schema` | (미구현) | JSON 파싱/Top-level 형태/노드 기본 타입 위반 시 즉시 실패 |
| `duplicate_id` | `duplicate_id` / error | `Duplicate id: ...`로 실패 |
| `missing_parent` | `missing_parent` / error | `parent_id` 누락/부모 노드 없음으로 실패 |
| `missing_child` | `missing_child` / error | `Missing child: ...`로 실패 |
| `type_hierarchy` | `type_hierarchy` / error | 부모/자식 타입 불일치로 실패 |
| `leaf_has_children` | `type_hierarchy` / warning (leaf children) | `Leaf node must not have children_ids entries...`로 실패 |
| `bidirectional_mismatch` | `parent_missing_child` / warning + `child_wrong_parent` / warning | 양방향 불일치 각각을 에러로 보고 실패 |
| `orphan` | `orphan` / warning | (미구현) |
| `domain_progression_incomplete_key` | (미구현) | (미구현, progression이 안전하게 스킵) |
| `cycle` | `cycle` / error | (직접 검출은 없지만 타입 계층 위반 등으로 실패하는 케이스가 대부분) |

---

## 6) Progression 엣지 정의 (AC4)

목표: “동일 domain_code에서 학년이 증가하는 선수 관계”를 그래프에 점선으로 표시한다.

- 대상 노드: `type === "domain"`
- 매칭 키: `domain_code`(trim 후 non-empty string) + `grade`(integer number)
- 그룹/정렬:
  - `domain_code` 오름차순으로 처리
  - 같은 `domain_code` 내 `grade` 오름차순
  - 동일 `(domain_code, grade)`가 여러 개면 `id` 사전순으로 가장 작은 노드를 대표로 선택(결정적 결과)
- 엣지 생성:
  - 같은 `domain_code`에서 **인접 학년만 연결**: `g → g+1`
  - 결측 학년이 있으면 스킵(예: 2와 4만 있으면 2→4 생성 안 함)
- 엣지 ID:
  - `progression:{domain_code}:{sourceDomainId}->{targetDomainId}`

---

## 7) 구현 참고(현 코드 기준)

- 스키마 타입: `curriculum-viewer/src/lib/curriculum/types.ts`
- progression 생성: `curriculum-viewer/src/lib/curriculum/progression.ts`
- contains/graph 렌더링: `curriculum-viewer/src/lib/curriculum/graphView.ts` (`children_ids` 기반)
- UI 리포트(에러/경고): `curriculum-viewer/src/lib/curriculum/validate.ts`
