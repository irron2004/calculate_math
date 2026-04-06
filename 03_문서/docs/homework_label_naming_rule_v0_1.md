# 숙제 label / name 네이밍 규칙 v0.1

## 0. 목적

문제 DB 등록, 숙제 출제 화면, 운영 검색, 리포트, 코호트 분석에서
같은 숙제/같은 단원/같은 개념이 사람마다 다르게 표기되어
누락·중복·변형값이 늘어나는 것을 막기 위한 운영 기준이다.

핵심 원칙은 아래 한 줄로 정리한다.

> 입력은 선택형, 저장은 구조화, slug는 시스템 생성.

---

## 1. 기본 원칙

### 1.1 역할 분리
- `assignment_name`: 사람이 읽는 숙제 제목
- `label_slug`: 기계가 읽는 대표 canonical slug
- `concept_slug`, `difficulty`, `set_no`: 운영/분석 축
- `tags`: 보조 검색용 태그
- `mapping_status`: Research 매핑 상태

### 1.2 slug 설계 원칙
- slug는 **짧고 안정적**이어야 한다.
- 변동 가능성이 큰 축(`concept`, `difficulty`, `set_no`)을 slug 하나에 몰아넣지 않는다.
- 운영자가 직접 긴 slug를 타이핑하지 않는다.
- 시스템이 선택값을 바탕으로 slug를 생성한다.

### 1.3 비파괴 원칙
- 원본 입력값은 가능하면 보존한다.
- Research canonical이 바뀌어도 기존 운영 이력을 깨지 않도록 설계한다.
- `mapping_status`로 `unmapped | proposed | mapped | split | merged` 상태를 관리한다.

---

## 2. 권장 필드 구조

### 2.1 운영자 입력 필드
- `school_level`
- `grade`
- `unit`
- `concept`
- `difficulty`
- `set_no` (optional)
- `assignment_name`
- `tags` (추천값 중심, 제한적 자유입력)

### 2.2 시스템 생성 필드
- `label_slug`
- `label_display_name`

### 2.3 저장 필수 필드
- `school_level`
- `grade`
- `unit`
- `concept`
- `difficulty`
- `label_slug`
- `assignment_name`
- `mapping_status`

### 2.4 선택 필드
- `set_no`
- `tags`
- `raw_label_text`
- `label_display_name`

---

## 3. 네이밍 규칙

## 3.1 assignment_name

형식:

`[학년] [단원명] - [개념명] - [난이도/세트정보]`

예:
- `중1 일차방정식 - 이항 연습 - 하`
- `초6 분수의 나눗셈 - 기본 적용 - 세트 2`
- `고2 지수부등식 - 연립부등식 교집합 - 중`

원칙:
- 사람이 보고 바로 내용을 이해할 수 있어야 한다.
- 25~40자 내외를 권장한다.
- `숙제1`, `테스트`, `연습문제` 같은 모호한 제목은 금지한다.

## 3.2 label_slug

형식:

`[school-level]-[grade]-[canonical-unit]`

예:
- `mid-1-linear-equation`
- `elem-6-fraction-division`
- `high-2-exponential-inequality`

원칙:
- 짧고 안정적인 canonical 단위만 포함한다.
- `concept`, `difficulty`, `set_no`는 별도 필드로 분리한다.
- 영문 소문자 + 하이픈만 사용한다.
- slug는 시스템 생성으로 관리한다.

## 3.3 concept_slug

형식:

`[concept-slug]`

예:
- `basic`
- `transposition`
- `system-intersection`
- `substitute-range-root-count`

원칙:
- controlled vocabulary를 우선한다.
- 자유 입력을 허용하더라도 승인된 canonical 목록으로 정규화한다.

## 3.4 difficulty

권장 값:
- `low`
- `mid`
- `high`

원칙:
- difficulty는 식별자보다 상태값에 가깝다.
- 따라서 `label_slug` 본문에 넣지 않는다.

---

## 4. 중복 후보 판정 규칙

중복 후보는 아래 조합이 같을 때 우선 표시한다.

- `school_level + grade + unit + concept + difficulty + set_no(null 허용)`

보조 판정:
- `assignment_name` 유사도
- 동일 문제 수/동일 문제 묶음 여부
- 동일 주차/요일 여부

---

## 5. 현재 backend의 단순 label 테이블에 적용하는 임시 규칙

현재 `homework_labels` 테이블은 구조 필드를 모두 담지 못하고,
아래 단순 구조만 가진다.

- `key`
- `label`
- `kind`

따라서 현재 DB 정리는 아래 **namespaced short slug** 규칙으로 우선 맞춘다.

### 5.1 key 규칙

형식:

`[namespace]-[slug]`

namespace 예:
- `hwset-...` : 숙제 세트/대표 단원
- `concept-...` : 개념 축
- `source-...` : 원본 출처
- `day-...` : 요일

### 5.2 현재 DB 정리 예시
- `log_grade2_derived` → `hwset-high-2-logarithm-derived`
- `exp_grade2_ineq_2026w12` → `hwset-high-2-exponential-inequality-w12`
- `exp_system_intersection` → `concept-exponential-system-inequality-intersection`
- `src_0372` → `source-0372`
- `day_mon` → `day-mon`

### 5.3 label 표시 규칙
- `label`은 운영자 확인용 한글 표시명으로 유지한다.
- 예:
  - `고2 로그 - 파생`
  - `고2 지수부등식 - 2026 W12`
  - `개념: 연립부등식 교집합`
  - `원본 0372`
  - `요일: 월`

---

## 6. 금지 패턴

### 6.1 key / slug 금지
- 공백 포함 값
- 한글 혼합 slug
- underscore 기반 임시 key의 무분별한 추가
- 의미 축이 과도하게 합쳐진 긴 slug
- 사람마다 다르게 줄여 쓰는 임시 약어

예:
- `중1일차방정식`
- `math-homework`
- `mid1_linear equation`
- `high-2-exponential-inequality-system-intersection-mid-set-1`

### 6.2 assignment_name 금지
- `숙제1`
- `테스트`
- `연습문제`
- `중1수학`
- `방정식 문제`

---

## 7. 현 단계 적용 결론

현재 합의는 아래와 같다.

1. `label`과 `name`은 분리한다.
2. 검색/중복 통제를 위해 slug는 필요하다.
3. 다만 긴 단일 slug를 운영자가 직접 입력하게 하지는 않는다.
4. 운영/분석 축은 구조 필드로 분리한다.
5. 현재 단순 label 테이블에서는 `namespace + short slug` 규칙으로 우선 정리한다.
6. 향후 DB 스키마 확장 시 `school_level / grade / unit / concept / difficulty / set_no / mapping_status`를 1급 필드로 승격한다.

---

## 8. 현재 DB label 정리 매핑

| 기존 key | 변경 key | 변경 label |
|---|---|---|
| `log_grade2_derived` | `hwset-high-2-logarithm-derived` | `고2 로그 - 파생` |
| `exp_grade2_ineq_2026w12` | `hwset-high-2-exponential-inequality-w12` | `고2 지수부등식 - 2026 W12` |
| `src_0363` | `source-0363` | `원본 0363` |
| `src_0376` | `source-0376` | `원본 0376` |
| `src_0373` | `source-0373` | `원본 0373` |
| `src_0372` | `source-0372` | `원본 0372` |
| `exp_substitute_range` | `concept-exponential-substitute-range-root-count` | `개념: 치환 후 범위/근개수/항상성립` |
| `exp_given_solution` | `concept-exponential-inequality-given-solution` | `개념: 해가 주어진 지수부등식` |
| `exp_system_intersection` | `concept-exponential-system-inequality-intersection` | `개념: 연립부등식 교집합` |
| `day_mon` | `day-mon` | `요일: 월` |
| `day_tue` | `day-tue` | `요일: 화` |
| `day_wed` | `day-wed` | `요일: 수` |
| `day_thu` | `day-thu` | `요일: 목` |
| `day_fri` | `day-fri` | `요일: 금` |

이 매핑은 현재 DB의 단순 label 구조에서 적용 가능한 최소 정규화안이다.
