# 숙제 label 구조 필드형 DB 확장안 v0.1

## 0. 목적

`homework_label_naming_rule_v0_1.md`에서 정리한 운영 안정화 기준 다음 단계로,
숙제/문제 label 정보를 문자열 조합이 아니라 **구조 필드**로 승격하기 위한 DB 초안이다.

이번 문서의 목적은 아래 3가지를 동시에 만족하는 공통 구조를 제안하는 것이다.

1. **운영**: 선택형 입력 + 시스템 생성 slug
2. **Research**: canonical mapping / split / merged / deprecated 이력 관리
3. **분석**: 단원/개념/난이도/세트/매핑상태 기준 집계 가능

---

## 1. 설계 원칙

### 1.1 문자열 1개에 의미를 몰지 않는다
기존 `label key`는 검색/연결 안정화에는 유효했지만,
`school_level / grade / unit / concept / difficulty / set_no / mapping_status`를
직접 쿼리·분석하기에는 한계가 있다.

따라서 다음 단계에서는:
- `label_slug`는 짧고 안정적인 canonical 축만 담당하고
- 변동 가능성이 높은 운영/분석 축은 별도 컬럼으로 분리한다.

### 1.2 원본 보존 + 비파괴 매핑
- 원본 입력값은 가능한 보존한다.
- canonical 변경이 있어도 기존 데이터를 직접 덮어써 파괴하지 않는다.
- `mapping_status`와 mapping record를 통해 상태를 관리한다.

### 1.3 운영 입력은 선택형
- 운영자는 긴 slug를 직접 쓰지 않는다.
- `school_level / grade / unit / concept / difficulty / set_no`를 선택한다.
- 시스템이 `label_slug`, `label_display_name`을 생성한다.

---

## 2. 권장 엔터티 구성

현재 `homework_labels`는 단순 label registry 역할로 유지하되,
다음 단계에서는 아래 구조를 추가하는 방향을 권장한다.

### 2.1 유지 엔터티
- `homework_labels`
- `homework_problem_labels`

### 2.2 신규 또는 확장 대상
- `homework_label_structures` (권장)
- 또는 `homework_labels`에 구조 컬럼 직접 추가 (단기안)
- `homework_label_mappings` (권장, Research용)

---

## 3. 필수 컬럼

아래는 **구조 필드형의 필수 컬럼**이다.

### 3.1 core identity
- `id`
- `label_slug`
- `school_level`
- `grade`
- `unit_slug` 또는 `unit_id`
- `concept_slug`
- `difficulty`
- `mapping_status`
- `created_at`
- `updated_at`

### 3.2 분석/상태 추적 관점 필수 판단 컬럼
아래 컬럼은 v0.2에서 특히 중요하다.

- `created_at`: 레코드 생성 시점
- `updated_at`: 마지막 수정 시점
- `mapped_at`: `mapped` 상태 도달 시점
- 필요 시 `mapping_status_changed_at`: 현재 상태로 마지막 전이된 시점

이유:
- `mapping_status`별 운영 리드타임을 계산하려면 시점 컬럼이 필요하다.
- `proposed → mapped`, `unmapped → mapped`, `split/merged` 처리 시간을 보려면
  최소한 `mapped_at` 또는 상태 변경 시점 기록이 필요하다.

### 3.2 필드 정의

#### `label_slug`
- 대표 canonical slug
- 예: `high-2-exponential-inequality`
- 역할: 검색/연결/대표 식별
- 원칙: 짧고 안정적인 canonical 단위만 포함

#### `school_level`
- 예: `elem | mid | high`
- 역할: 학교급 구분

#### `grade`
- 예: `1, 2, 3, 4, 5, 6`
- 역할: 학년 구분

#### `unit_slug` 또는 `unit_id`
- 권장 기본안: **둘 다 두되, 시스템 기준 식별은 `unit_id` 우선**
- 이유:
  - `unit_id`: canonical unit 식별 안정성 확보
  - `unit_slug`: 운영/분석/조회 가독성 확보
- 예:
  - `unit_id`: `UNIT-H2-EXP-INEQ`
  - `unit_slug`: `exponential-inequality`

##### 선택 기준
- canonical graph와 별도 unit master를 운영할 계획이면: `unit_id` 필수
- 아직 초기 단계이고 human-readable query가 더 중요하면: `unit_slug`로 시작 가능
- 다만 중장기적으로 split / merged / deprecated 이력을 다루려면 `unit_id` 도입이 안전하다.

#### `concept_slug`
- 예: `system-intersection`, `given-solution`, `basic`, `transposition`
- 역할: 세부 개념 축

#### `difficulty`
- 예: `low | mid | high`
- 역할: 난이도 축

#### `mapping_status`
- 예: `unmapped | proposed | mapped | split | merged | deprecated`
- 역할: Research canonical 매핑 상태 관리

##### 상태 전이 추적 권장
`mapping_status`는 단일 현재값만 저장하면 이력 분석이 제한된다.
따라서 아래 둘 중 하나를 권장한다.

- 단기안: `mapping_status`, `mapping_status_changed_at`, `mapped_at` 컬럼 추가
- 권장안: 별도 `homework_label_mapping_events` 또는 `homework_label_mappings` 이력 테이블 운영

이유:
- `mapping_status`별 적체량만이 아니라
- 전이 리드타임, split/merged 빈도, 상태 변화 추세를 봐야 하기 때문이다.

---

## 4. optional 컬럼

아래는 운영/Research/분석 고도화를 위해 권장하는 선택 컬럼이다.

- `set_no`
- `assignment_name`
- `label_display_name`
- `raw_label_text`
- `tags_json` 또는 tags 관계 테이블
- `source_key`
- `source_label`
- `archived_at`
- `notes`
- `effective_from`
- `effective_to`
- `mapping_status_changed_at`
- `mapped_at`

### 4.1 주요 optional 설명

#### `set_no`
- 같은 단원/개념/난이도에서 세트 운영 시 사용
- 예: `1, 2, 3`

#### `assignment_name`
- 사람용 제목
- 예: `고2 지수부등식 - 연립부등식 교집합 - 중`

#### `label_display_name`
- 화면/운영 확인용 표시명
- 예: `고2 지수부등식`
- 저장하지 않고 계산값으로 둘 수도 있으나,
  운영 화면/검색 성능을 위해 캐시 컬럼으로 둘 수 있다.

#### `raw_label_text`
- 과거 자유 입력값 또는 외부 입력 원문 보존용
- migration 초기 단계에서 특히 유용하다.

#### `tags_json`
- 보조 검색축
- canonical identity를 대체하지 않는다.

---

## 5. 기존 `homework_labels`와의 관계

## 5.1 권장 관계 해석
현재 `homework_labels`는 **label registry**로 해석한다.

- `homework_labels.id`: 기존 연결 유지용 ID
- `homework_labels.key`: 현재 대표 key / slug
- `homework_labels.label`: 운영 확인용 표시명

다음 단계에서는 이 테이블을 바로 없애기보다,
아래 둘 중 하나로 연결하는 것이 안전하다.

### 옵션 A. `homework_labels` 확장
현재 테이블에 아래 컬럼을 직접 추가:
- `school_level`
- `grade`
- `unit_slug`
- `concept_slug`
- `difficulty`
- `set_no`
- `mapping_status`
- `raw_label_text`
- `label_display_name`

장점:
- migration 단순
- 기존 `label_id` 유지 쉬움

단점:
- source/day/concept 등 이질적 label 종류가 섞여 있으면 구조 해석이 애매해질 수 있음

### 옵션 B. `homework_label_structures` 신설
예시:
- `homework_labels` = registry
- `homework_label_structures` = structured metadata
- `homework_label_mappings` = raw ↔ canonical 현재 상태 관리
- `homework_label_mapping_events` = 상태 전이 이력 관리

장점:
- Research/운영/분석 역할 분리 명확
- future schema 확장 유연

단점:
- 초기 migration 설계가 조금 더 필요

### 5.2 추천
**중장기적으로는 옵션 B 권장**

단, 구현 속도가 중요하면:
- 1차: `homework_labels` 확장
- 2차: mapping/history 분리
순서도 가능하다.

---

## 6. migration 방향

### 6.1 단계별 migration 권장 순서

#### Step 1. 현재 key 분류
기존 `homework_labels.key`를 아래처럼 분류한다.
- `hwset-*`
- `concept-*`
- `source-*`
- `day-*`
- 기타 legacy

#### Step 2. 구조 필드 채우기 대상 선정
모든 label을 구조화할 필요는 없다.
우선 구조화 대상은 **canonical 숙제/단원 label** 중심으로 잡는다.

예:
- `hwset-high-2-exponential-inequality-w12`
- `hwset-high-2-logarithm-derived`

반면 아래는 보조 축/메타 축으로 남길 수 있다.
- `source-*`
- `day-*`

#### Step 3. old → structured 매핑표 작성
예시:
- `hwset-high-2-exponential-inequality-w12`
  - `school_level = high`
  - `grade = 2`
  - `unit_slug = exponential-inequality`
  - `concept_slug = null` 또는 대표 개념 없음
  - `difficulty = null`
  - `set_no = null`
  - `mapping_status = mapped`

#### Step 4. null 허용으로 컬럼 추가
초기 migration에서는 null 허용으로 시작한다.
기존 데이터가 완전히 채워진 뒤 NOT NULL 제약으로 승격한다.

#### Step 5. 읽기 경로 이중 지원
기존 `key/label` 기반 조회를 유지하면서,
신규 API/리포트는 구조 필드를 우선 사용한다.

#### Step 6. 입력 경로 변경
운영 UI/API를 선택형 입력으로 바꾸고,
시스템이 `label_slug`를 생성하게 만든다.

---

## 7. backward compatibility 메모

### 7.1 유지해야 하는 것
- 기존 `homework_problem_labels.label_id` 연결
- 기존 `homework_labels.id`
- 기존 label 조회 API 응답 호환성

### 7.2 호환 전략
- 초기에는 `key`, `label`을 그대로 제공한다.
- 신규 구조 필드는 응답에 추가한다.
- 클라이언트가 아직 구조 필드를 모를 때도 기존 동작이 깨지지 않아야 한다.

### 7.3 주의점
- `label_slug`와 기존 `key`의 의미를 혼동하지 않도록 명시 필요
- `label_display_name`은 계산값인지 저장값인지 구현 시점에 고정 필요
- `raw_label_text`는 migration/legacy 단계에서는 유지 권장

---

## 8. 중복 판정 기준 초안

구조 필드화 이후 중복 후보는 아래 조합으로 우선 판정한다.

- `school_level + grade + unit_slug + concept_slug + difficulty + set_no(null 허용)`

보조 판정:
- `assignment_name` 유사도
- 동일 문제 세트 여부
- 동일 주차/요일 여부

---

## 9. 예시 레코드

### 예시 1
- `label_slug`: `high-2-exponential-inequality`
- `school_level`: `high`
- `grade`: `2`
- `unit_slug`: `exponential-inequality`
- `concept_slug`: `system-intersection`
- `difficulty`: `mid`
- `set_no`: `1`
- `mapping_status`: `mapped`
- `assignment_name`: `고2 지수부등식 - 연립부등식 교집합 - 중`

### 예시 2
- `label_slug`: `high-2-logarithm`
- `school_level`: `high`
- `grade`: `2`
- `unit_slug`: `logarithm`
- `concept_slug`: `derived-basic`
- `difficulty`: `low`
- `set_no`: `null`
- `mapping_status`: `mapped`
- `assignment_name`: `고2 로그 - 파생 기본 - 하`

### 예시 3
- `label_slug`: `mid-1-linear-equation`
- `school_level`: `mid`
- `grade`: `1`
- `unit_slug`: `linear-equation`
- `concept_slug`: `transposition`
- `difficulty`: `mid`
- `set_no`: `2`
- `mapping_status`: `mapped`
- `assignment_name`: `중1 일차방정식 - 이항 연습 - 세트 2`

---

## 10. 분석 리포트 대응표

v0.2 구조 필드화는 단순 정리가 아니라,
아래 핵심 리포트를 안정적으로 열기 위한 기반이다.

| 리포트 | 필요한 핵심 컬럼 | 비고 |
|---|---|---|
| 개념별 제출률 | `concept_slug`, `created_at` | 운영 우선순위 1 |
| 난이도별 완료율 | `difficulty`, `created_at` | 운영 우선순위 2 |
| 단원별 숙제 분포 / 성과 | `unit_slug` 또는 `unit_id`, `school_level`, `grade` | 단원별 과잉/과소 출제 확인 |
| mapping_status별 운영 리드타임 | `mapping_status`, `mapping_status_changed_at`, `mapped_at`, `created_at` | Research 병목 확인 |
| split / merged 전후 성과 비교 | `unit_id`, `mapping_status`, 상태 이력 테이블 | canonical 개편 효과 측정 |
| 학생 코호트별 약점 개념 해결 추적 | `concept_slug`, `difficulty`, `set_no` | North Star 연결 |

### 운영 의사결정 우선순위
1. 개념별 제출률
2. 난이도별 완료율
3. `mapping_status`별 운영 리드타임
4. 단원별 성과 분포
5. split / merged 전후 비교

---

## 11. 권장 결론

이번 v0.1 정규화 다음 단계로는 아래 방향을 권장한다.

구현 레벨의 SQLite 반영안은 아래 문서를 따른다.

- `03_문서/docs/homework_label_sqlite_implementation_v0_1.md`


1. `homework_labels`를 registry로 유지한다.
2. canonical 숙제/단원 label에 대해 구조 필드를 승격한다.
3. 가능하면 `unit_id + unit_slug`를 함께 두고, 시스템 식별은 `unit_id`를 우선한다.
4. 운영자는 선택형 입력만 한다.
5. 시스템이 `label_slug`와 표시명을 생성한다.
6. Research는 `mapping_status`와 원본 보존 필드 기반으로 비파괴 매핑을 관리한다.
7. 상태 전이 분석을 위해 `mapped_at` 또는 별도 mapping event 이력을 남긴다.

한 줄로 정리하면:

> **v0.2 단계에서는 label 문자열 관리에서 멈추지 않고, 운영/Research/분석이 공통으로 쓰는 구조 필드형 스키마로 승격해야 한다.**
