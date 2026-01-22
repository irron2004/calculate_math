# Data Contract Inventory (현행 인벤토리) — `curriculum_math_v1.json`

이 문서는 **현행 코드/데이터가 실제로 전제하는 필드/규칙**을 추출한 “사실 기반 인벤토리”다.

- 대상 데이터: `curriculum-viewer/public/data/curriculum_math_v1.json`
- 대상 코드:
  - CLI 검증: `curriculum-viewer/scripts/validate-data.mjs`
  - UI 검증(리포트): `curriculum-viewer/src/lib/curriculum/validate.ts`
  - Progression: `curriculum-viewer/src/lib/curriculum/progression.ts`
- v1 계약(SSoT, 목표 규범): `tasks/curriculum_viewer_student_mode_mvp_v1/docs/curriculum_math_v1_contract.md`

---

## 1) Top-level 형태(현행)

- JSON 최상위는 object여야 한다.
- `nodes`는 array여야 한다. (필수)
- `meta`는 존재해도 되고 없어도 된다. (현행 검증은 요구하지 않음)

---

## 2) 노드 타입별 필드(현행 코드 기준 표) (AC)

아래 표는 “현행 코드가 강제/가정하는 수준”을 기준으로 정리했다.

### 공통 필드

| 필드 | 타입 | validate-data.mjs(강제) | validate.ts(강제) | 비고 |
|---|---|---|---|---|
| `id` | string | **필수**(non-empty, unique) | **가정**(중복 체크) | UI는 런타임 타입 체크 없음 |
| `type` | enum | **필수**(`subject|grade|domain|standard`) | **가정** | |
| `title` | string | **필수**(non-empty) | **가정** | UI/그래프 라벨에 사용 |
| `children_ids` | string[] | **필수**(string[]) | **가정** | Graph/Index가 순회 |
| `parent_id` | string | **조건부**(subject 금지, 그 외 필수) | **조건부**(subject는 root로 취급, 그 외 missing_parent 에러) | |

### type = `subject`

| 필드 | 타입 | 현행 필요성 |
|---|---|---|
| `id,type,title,children_ids` | - | **필수** |
| `parent_id` | - | **금지(validate-data 에러 / validate.ts type_hierarchy 에러)** |
| `subject` | string | 선택(표시/검색용) |
| `source` | object | 선택 |

### type = `grade`

| 필드 | 타입 | 현행 필요성 |
|---|---|---|
| `id,type,title,parent_id,children_ids` | - | **필수(validate-data 기준)** |
| `grade` | number(int) | 선택(정렬에 사용: `indexing.ts`), 없으면 뒤로 밀림 |
| `grade_band` | string | 선택 |
| `subject` | string | 선택 |

### type = `domain`

| 필드 | 타입 | 현행 필요성 |
|---|---|---|
| `id,type,title,parent_id,children_ids` | - | **필수(validate-data 기준)** |
| `domain_code` | string | **Progression용 사실상 필수**(없으면 progression 스킵) |
| `grade` | number(int) | **Progression용 사실상 필수**(없거나 int 아니면 스킵) |
| `domain` | string | 선택 |
| `subject,grade_band,source` | - | 선택 |

### type = `standard`

| 필드 | 타입 | 현행 필요성 |
|---|---|---|
| `id,type,title,parent_id,children_ids` | - | **필수(validate-data 기준)** |
| `children_ids` | string[] | **현행 CLI는 반드시 empty**(non-empty면 에러) / UI는 warning |
| `text` | string | 선택(학습 화면 설명에 사용: `LearnPage.tsx`) |
| `official_code` | string | 선택(정렬에 사용: `indexing.ts`) |
| `subject,grade,grade_band,domain,domain_code,source` | - | 선택 |

---

## 3) 검증 규칙(현행) (AC)

### 3.1 CLI: `scripts/validate-data.mjs` (현재는 “모든 이슈가 차단”에 가깝게 동작)

아래 항목 중 하나라도 위반하면 프로세스가 실패(Exit code 1)한다.

1. JSON 파싱 가능해야 함
2. Top-level은 object이고 `nodes`는 array
3. 각 노드는 object
4. `id`는 non-empty string + 전체 유니크
5. `type`은 `subject|grade|domain|standard` 중 하나
6. `title`은 non-empty string
7. `children_ids`는 `string[]`
8. `parent_id` 규칙
   - `subject`: `parent_id` 없어야 함
   - 그 외: `parent_id`는 non-empty string
9. 부모/자식 참조 무결성(양방향)
   - parent 존재 + 타입 계층 일치
   - `parent.children_ids`에 `child.id`가 포함되어야 함
   - `child.parent_id === parent.id` 이어야 함
10. 타입 계층(고정): `subject → grade → domain → standard`
11. leaf(standard)는 `children_ids`가 비어있어야 함
12. 최소 1개의 유효 경로가 존재해야 함: `subject → grade → domain → standard`

### 3.2 UI: `src/lib/curriculum/validate.ts` (코드/심각도 포함)

UI 리포트는 아래 이슈 코드 체계를 사용한다.

| code | severity(현행) | 의미(요약) |
|---|---|---|
| `duplicate_id` | error | ID 중복 |
| `missing_parent` | error | parent_id 누락 또는 부모 노드 없음 |
| `missing_child` | error | children_ids가 존재하지 않는 노드를 참조 |
| `type_hierarchy` | error/warning | 타입 계층 위반(부모/자식 타입 불일치), `standard`가 children을 가질 때 warning |
| `cycle` | error | parent 체인 사이클 |
| `parent_missing_child` | warning | parent.children_ids에 child 누락(양방향 불일치) |
| `child_wrong_parent` | warning | child.parent_id가 parent와 불일치(양방향 불일치) |
| `orphan` | warning | root에서 도달 불가 |

현행 UI 검증의 특징:
- primitive 스키마(`title` non-empty, `children_ids` 타입 등)는 런타임에서 강제하지 않는다(데이터는 타입 캐스팅으로 유입).
- root 판정이 넓다: `type === "subject"` **또는** `parent_id`가 없는 노드를 root로 취급한다.

---

## 4) Progression 엣지(현행) (AC)

Progression은 `domain` 노드에서 생성된다.

- 최소 키: `domain_code`(trim 후 non-empty string), `grade`(integer number)
- 그룹: `domain_code` 단위로 그룹핑
- 정렬: `domain_code` 오름차순 → 같은 코드 내 `grade` 오름차순
- 중복 처리: 동일 `(domain_code, grade)`가 여러 개면 `id` 사전순으로 가장 작은 노드를 대표로 선택(결정적 출력)
- 엣지 생성: **인접 학년만 연결**(`g → g+1`), 중간 학년 결측 시 스킵
- 엣지 ID: `progression:{domain_code}:{sourceId}->{targetId}`

---

## 5) 갭/모순/오픈퀘스천(최소 5개) (AC)

1. **에러 코드 표준화**: 계약 문서/CLI/UI가 같은 코드 체계를 공유할지, 아니면 “매핑 표”로만 운영할지 결정 필요
2. **warning을 CLI에서 차단할지**: 현행 `validate-data.mjs`는 사실상 모든 이슈를 차단하는데, warning을 분리할지(Exit code 정책 포함) 결정 필요
3. **ID 포맷/문자셋 강제 여부**: `A-Z0-9-`만 허용할지, 정규식/접두 규칙을 에러로 강제할지 결정 필요
4. **domain_code 표준**: 대문자 강제/길이 제한/허용 코드 목록을 고정할지, trim/uppercase 정책을 어디서 적용할지 결정 필요
5. **grade 범위/의미**: 허용 범위(예: 1~6), 특수 grade 노드(creative 등)에서 `grade`를 허용/금지/nullable 처리할지 결정 필요
6. **leaf 정의**: `standard`는 항상 leaf인가? (현행 CLI는 강제, UI는 warning) — 향후 하위 세분(standard→substandard)이 필요하면 타입 확장 필요
7. **root 정의**: UI는 `parent_id` 없는 노드를 root로 취급하지만, CLI/계약은 `subject`만 root로 취급(정합성 필요)
8. **(domain_code, grade) 중복 허용 여부**: 현행 progression은 결정적으로 하나를 선택하지만, 데이터 품질 관점에서 금지(에러)할지 결정 필요
