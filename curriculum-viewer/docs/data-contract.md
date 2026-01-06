# Data Contract v1 — `curriculum_math_v1.json`

이 문서는 `curriculum-viewer`가 사용하는 정적 커리큘럼 데이터 파일의 **v1 계약(포맷/필드 규칙/ID 규칙)** 을 정의한다.

- 파일 위치: `curriculum-viewer/public/data/curriculum_math_v1.json`
- 목적: `subject → grade → domain → standard` 계층을 트리/그래프로 탐색·시각화하고, 구조 검증을 수행하기 위한 최소 데이터 계약 고정

---

## 1) 파일 포맷(File Format)

최상위는 아래 형태의 JSON Object이다.

```json
{
  "meta": { "schema_version": "curriculum_math_v1" },
  "nodes": []
}
```

### `meta` (object)
- `schema_version` (string, required): `"curriculum_math_v1"`
- `curriculum_id` (string, optional): 예) `"KR-MATH-2022"`
- `locale` (string, optional): 예) `"ko-KR"`
- `generated_at` (string, optional): 예) `"2025-12-30"`
- `sources` (array, optional): 출처 메타데이터(표시/추적용)
- `note` (string, optional): 생성/가공 메모

### `nodes` (array, required)
- `CurriculumNode[]`

---

## 2) 표준 노드 스키마(`CurriculumNode`)

모든 노드는 아래 공통 필드를 가진다(키는 **snake_case** 기준).

| 필드 | 타입 | 필수 | Nullable | 설명 |
|---|---:|:---:|:---:|---|
| `id` | string | Y | N | 노드 식별자(파일 내 유일) |
| `type` | `"subject" \| "grade" \| "domain" \| "standard"` | Y | N | 노드 타입 |
| `title` | string | Y | N | 화면 표시용 타이틀 |
| `parent_id` | string | 조건부 | N | 상위 노드 id (`subject`는 없어야 함) |
| `children_ids` | string[] | Y | N | 하위 노드 id 목록(leaf는 `[]`) |

### 선택/메타 필드(권장)
아래 필드는 v1에서 **옵션**이며, 타입에 따라 권장 범위가 있다.

| 필드 | 타입 | 권장 타입 | 설명 |
|---|---:|---|---|
| `subject` | string | all | 예) `"math"` |
| `grade_band` | `"1-2" \| "3-4" \| "5-6"` | grade/domain/standard | 학년군(메타, 노드로 쓰지 않음) |
| `grade` | number | grade/domain/standard | 학년(정수) |
| `domain` | string | domain/standard | 영역(예: `"수와 연산"`) |
| `domain_code` | string | domain/standard | 영역 코드(선택, 예: `"NA"`) |
| `text` | string | standard | 성취기준 원문/설명(leaf에서 사용) |
| `official_code` | string | standard | 공식 코드(선택, 예: `"4수01-01"`) |
| `source` | object | all | 출처 메타(추적용) |

`source` 권장 형태:
```json
{ "provider": "NCIC", "doc": "2022개정", "ref": "..." }
```

---

## 3) 타입 계층(고정)

부모-자식 관계는 아래 순서를 따라야 한다.

- `subject` → `grade` → `domain` → `standard`

추가 제약:
- `subject`는 `parent_id`가 없어야 한다.
- `standard`는 `children_ids`가 비어있는 것을 권장한다.

---

## 4) ID 규칙

필수 규칙:
1. 파일 내 `id`는 **전부 유일**해야 한다.
2. `id`는 안정적이어야 하며(리팩터링 시 불필요하게 변경 금지) URL/키로 사용 가능해야 한다.

권장 규칙(샘플):
- `subject`: `MATH-2022`
- `grade`: `MATH-2022-G-3`
- `domain`: `MATH-2022-G-3-D-NA`
- `standard`: `MATH-2022-G-3-NA-001`

---

## 5) 계약 검증(Validation)

아래 커맨드로 데이터 계약 체크를 실행한다.

- `cd curriculum-viewer && npm run validate:data`

검증 규칙(v1):
- JSON 파싱 가능
- `id` 유일성
- `parent_id`가 있으면 부모 노드가 반드시 존재
- `parent_id` ↔ `children_ids` 양방향 일관성
- 최소 1개 이상의 `subject → grade → domain → standard` 경로 존재
