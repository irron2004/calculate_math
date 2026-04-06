# 숙제 label taxonomy / name rule 초안 v0.2

## 0. 목적

이 문서는 숙제/문제 label을 단순 문자열이 아니라 **축(axis)을 가진 관리 대상**으로 정의해,
서비스 운영과 Research 매핑이 동시에 가능하도록 하는 초안이다.

목표는 아래 4가지를 함께 만족시키는 것이다.

1. 운영자가 같은 의미를 다른 label로 반복 생성하지 않게 한다.
2. 검색/정렬/집계 가능한 저장 기준을 만든다.
3. 화면 노출 이름과 내부 관리 키를 분리한다.
4. canonical node와 직접 연결되는 label과 운영 보조 label을 구분한다.

문서 기준 원칙:
- 서비스 조직과 Research 조직의 연결점은 `단원명 / node 이름 규칙`이다.
- 원본 태그는 삭제하지 않고 비파괴적으로 보존한다.
- canonical 합류는 mapping record와 mapping status로 관리한다.

---

## 1. label 분류축 제안

## 1.1 1차 분류: label axis

숙제 label은 최소 아래 축으로 나누는 것을 권장한다.

### A. `topic`
- 의미: 학습 주제 / 단원 / 개념
- 예: `정수와 유리수`, `이차함수`, `판별식`
- 성격: **Research와 가장 직접 연결되는 축**
- canonical node 매핑 대상 후보

### B. `objective`
- 의미: 숙제 목적 / 의도
- 예: `보강`, `복습`, `진단`, `시험 대비`
- 성격: 운영 / 기획 축
- canonical node 직접 매핑 대상은 아님

### C. `error_type`
- 의미: 오답 유형 / 취약 유형
- 예: `부호 실수`, `개념 혼동`, `조건 해석 오류`
- 성격: diagnosis / analysis 축
- 추후 별도 taxonomy로 확장 가능

### D. `status`
- 의미: 운영 상태
- 예: `미제출`, `재제출 필요`, `검토 완료`
- 성격: 운영 상태값
- topic과 절대 혼합하지 않음

### E. `difficulty`
- 의미: 난이도 / 수준
- 예: `기초`, `표준`, `심화`
- 성격: 문제/숙제 필터 축

### F. `source`
- 의미: 생성 배경 / 캠페인 / 운영 묶음
- 예: `4월 판별식 집중보강`, `온보딩 1주차`
- 성격: 운영 추적용 보조 축

---

## 1.2 2차 분류: canonical mapping 관점

각 label에는 아래 속성을 별도로 두는 것을 권장한다.

- `mapping_scope`
  - `canonical_candidate`
  - `operational_only`

### 해석
- `canonical_candidate`
  - Research의 canonical node와 연결될 수 있는 label
  - 주로 `topic` 축에 해당
- `operational_only`
  - 운영/상태/목적/캠페인용 보조 label
  - canonical node와 직접 연결하지 않음

### 제안
- 원칙적으로 **`topic`만 canonical 후보**
- `objective`, `status`, `difficulty`, `source`는 기본적으로 `operational_only`
- `error_type`은 현재는 `operational_only`로 두되, 추후 diagnosis taxonomy 확장 시 별도 체계로 승격 가능

---

## 2. `display_name` / `internal_key(slug)` 분리 여부

## 결론: 분리 필요

### 권장 필드
- `display_name`
  - 학생/운영 화면 노출명
  - 한국어 자연어 중심
- `internal_key` 또는 `slug`
  - 내부 고유키
  - DB, 검색, dedup, API, 정렬, join 기준

## 분리 이유

### 서비스 측 이유
- 운영자는 `이차함수`처럼 읽기 쉬운 이름이 필요하다.
- 시스템은 안정적인 고유키가 필요하다.
- 화면명은 바뀔 수 있지만 내부키는 최대한 안정적으로 유지해야 한다.

### Research 측 이유
- `display_name`은 alias/표현 변경을 허용한다.
- `internal_key`는 canonical mapping 기준으로 유지할 수 있다.
- 동의어/띄어쓰기 차이를 흡수하기 쉽다.

## 권장 결론
- **반드시 분리한다.**
- `display_name`은 사람용
- `internal_key/slug`는 시스템용
- 신규 생성/수정/중복 검사는 slug 기준으로 처리한다.

---

## 3. name rule

## 3.1 공통 원칙

1. 한 label은 한 의미만 담는다.
2. 한 label은 하나의 axis만 가진다.
3. 문장 대신 명사구 중심으로 만든다.
4. 상태/목적/주제를 한 문자열에 합치지 않는다.
5. 동일 의미는 하나의 canonical label로 수렴한다.

---

## 3.2 `display_name` 규칙

### 허용 문자
- 한글
- 영문
- 숫자
- 공백
- 제한된 구분 기호: `·`, `-`, `(`, `)`

### 띄어쓰기 기준
- 한국어 표준 띄어쓰기를 우선한다.
- 의미 단위가 분명해야 한다.

예:
- `정수와 유리수`
- `이차함수`
- `재제출 필요`

### 구분자 기준
- 화면 노출용에서 계층 표현이 필요하면 ` > ` 사용 가능
- 예: `중1 > 수와 연산 > 정수와 유리수`

단, label 자체 이름은 너무 깊은 계층 문자열보다
별도 메타필드(grade/domain/unit)로 분리하는 쪽이 안정적이다.

### 단수 / 복수 기준
- 한국어 display_name은 **개념명 단수형 기준**으로 본다.
- 영어 slug는 단수/복수보다 **짧고 안정적인 canonical phrase**를 우선한다.
- 한 번 정한 표기는 일관되게 유지한다.

### 한국어 / 영어 혼용 원칙
- 기본은 **한국어 단일 표기**
- 영어는 주로 내부키에서 사용
- display_name에서 혼용이 필요한 경우만 예외 허용
- topic label에서는 한국어/영어 혼용을 원칙적으로 피한다.

---

## 3.3 `internal_key / slug` 규칙

### 허용 문자
- 소문자 영문 `a-z`
- 숫자 `0-9`
- 하이픈 `-`

### 금지
- 공백
- 언더스코어 `_`
- 한글
- 특수문자
- 연속 하이픈 `--`

### 형식 원칙
- `kebab-case`
- 짧고 안정적이며 중복 없는 구조

권장 형식:
- `{axis}-{canonical-name}`

예:
- `topic-quadratic-function`
- `objective-remedial`
- `status-needs-resubmission`

### axis prefix 권장 이유
- 다른 축의 동일 단어 충돌 방지
- 데이터만 봐도 label 축이 바로 드러남
- 중복 검수와 운영 규칙 적용이 쉬움

---

## 4. 축별 naming 예시

### topic
- `display_name`: `이차함수`
- `slug`: `topic-quadratic-function`

### objective
- `display_name`: `보강`
- `slug`: `objective-remedial`

### error_type
- `display_name`: `부호 실수`
- `slug`: `error-sign-mistake`

### status
- `display_name`: `재제출 필요`
- `slug`: `status-needs-resubmission`

### difficulty
- `display_name`: `기초`
- `slug`: `difficulty-foundation`

### source
- `display_name`: `4월 판별식 집중보강`
- `slug`: `source-2026-04-discriminant-boost`

---

## 5. 금지 패턴

## 5.1 중복 의미 동의어

같은 의미를 다른 label로 중복 생성하는 패턴을 금지한다.

### 금지 예
- `이차함수`
- `2차함수`
- `이차 함수`

### 원칙
- 하나를 canonical `display_name`으로 채택한다.
- 나머지는 alias 또는 raw input으로 보존한다.
- 신규 등록 시 중복 후보 경고를 제공한다.

---

## 5.2 너무 긴 문장형 label

label은 메모가 아니라 taxonomy이므로 문장형 label을 금지한다.

### 금지 예
- `민수가 자주 틀리는 판별식 문제 다시 풀기`
- `이번 주에 꼭 다시 제출해야 하는 숙제`

이런 값은 label이 아니라 운영 메모 / 설명 필드로 이동해야 한다.

---

## 5.3 상태값과 주제값 혼합

서로 다른 축을 한 문자열에 합치는 패턴을 금지한다.

### 금지 예
- `판별식-미제출`
- `이차함수-보강`
- `로그-재제출필요`

이 경우는 각각 분리해야 한다.
- `topic`
- `status`
- `objective`

---

## 5.4 과도한 자유 포맷

표기 규칙이 없는 문자열을 금지한다.

### 금지 예
- `고1>이차함수!!!`
- `판별식/개념헷갈림/보강`
- `중1_정수와유리수`

---

## 5.5 축이 불명확한 추상 표현

분석·집계가 어려운 모호한 이름을 금지한다.

### 금지 예
- `중요`
- `어려움`
- `다시`
- `필수`

---

## 6. 좋은 예 / 나쁜 예

## 6.1 좋은 예

### 좋은 예 1
- axis: `topic`
- display_name: `정수와 유리수`
- slug: `topic-integers-rationals`
- mapping_scope: `canonical_candidate`

### 좋은 예 2
- axis: `topic`
- display_name: `이차함수`
- slug: `topic-quadratic-function`
- mapping_scope: `canonical_candidate`

### 좋은 예 3
- axis: `objective`
- display_name: `보강`
- slug: `objective-remedial`
- mapping_scope: `operational_only`

### 좋은 예 4
- axis: `status`
- display_name: `재제출 필요`
- slug: `status-needs-resubmission`
- mapping_scope: `operational_only`

### 좋은 예 5
- axis: `difficulty`
- display_name: `기초`
- slug: `difficulty-foundation`
- mapping_scope: `operational_only`

### 좋은 예 6
- axis: `error_type`
- display_name: `부호 실수`
- slug: `error-sign-mistake`
- mapping_scope: `operational_only`

### 좋은 예 7
- axis: `source`
- display_name: `4월 판별식 집중보강`
- slug: `source-2026-04-discriminant-boost`
- mapping_scope: `operational_only`

---

## 6.2 나쁜 예

### 나쁜 예 1
- `이차함수-보강`
- 이유: `topic + objective` 혼합

### 나쁜 예 2
- `판별식 미제출`
- 이유: `topic + status` 혼합

### 나쁜 예 3
- `민수가 틀린 개념 다시 풀기`
- 이유: 문장형 / 개인 메모와 taxonomy 혼합

### 나쁜 예 4
- `2차함수`
- 이유: canonical 대표표기와 동의어 충돌 가능

### 나쁜 예 5
- `고1>함수>이차함수!!!`
- 이유: 특수문자 남용 / 화면용 표현과 데이터 표현 혼합

### 나쁜 예 6
- `중1_정수와유리수`
- 이유: 임의 포맷 / 공통 규칙 불명확

### 나쁜 예 7
- `어려운 거`
- 이유: 축 불명확 / 분석 불가

---

## 7. canonical mapping 필요 여부 표시 방식 초안

## 결론
각 label에 canonical mapping 필요 여부를 **속성으로 명시**해야 한다.

### 권장 필드
- `axis`
- `mapping_scope`
- `canonical_node_id` nullable
- `mapping_status`

### `mapping_scope`
- `canonical_candidate`
- `operational_only`

### `mapping_status`
- `not_applicable`
- `unmapped`
- `proposed`
- `mapped`
- `deprecated`
- `merged`

## 해석

### topic label
- 보통 `mapping_scope = canonical_candidate`
- 상태 예:
  - 아직 연결 안 됨 → `unmapped`
  - 후보 연결 있음 → `proposed`
  - 확정 연결 완료 → `mapped`

### status / objective / difficulty / source
- 보통 `mapping_scope = operational_only`
- `mapping_status = not_applicable`

## 예시

### 예시 1
- `display_name`: `이차함수`
- `axis`: `topic`
- `mapping_scope`: `canonical_candidate`
- `mapping_status`: `mapped`
- `canonical_node_id`: `rr-quadratic-function`

### 예시 2
- `display_name`: `보강`
- `axis`: `objective`
- `mapping_scope`: `operational_only`
- `mapping_status`: `not_applicable`

### 예시 3
- `display_name`: `2차함수`
- `axis`: `topic`
- `mapping_scope`: `canonical_candidate`
- `mapping_status`: `merged`
- `merged_to`: `topic-quadratic-function`

---

## 8. 운영/BE/QA handoff 요약

### BE 연결 포인트
- label 저장 구조는 최소 아래를 지원해야 한다.
  - `axis`
  - `display_name`
  - `slug`
  - `mapping_scope`
  - `mapping_status`
  - `canonical_node_id`
  - `merged_to`
  - `alias/raw_input` 보존
- dedup 기준은 `axis + slug` 우선으로 본다.

### QA 연결 포인트
운영 화면에서 아래를 검증 포인트로 둔다.
- 서로 다른 axis 혼합 label 생성 방지
- 동의어 중복 생성 경고
- 문장형 label 차단
- canonical candidate와 operational-only 혼동 방지

---

## 9. 결론

Research 기준 권장안은 아래와 같다.

1. label은 단순 문자열이 아니라 **axis가 있는 엔티티**로 본다.
2. 최소 축은 `topic / objective / error_type / status / difficulty / source`로 나눈다.
3. `display_name`과 `internal_key(slug)`는 반드시 분리한다.
4. slug는 소문자 영문 + 숫자 + 하이픈만 허용한다.
5. label 하나에는 하나의 의미만 담는다.
6. 기본적으로 `topic`만 canonical mapping 후보로 본다.
7. 나머지 축은 운영 보조 label로 관리한다.
8. 동의어/변형 표기는 새 label을 계속 만들지 말고 alias/merge로 흡수한다.

한 줄 결론:

> **숙제 label은 문자열 관리가 아니라, 축 분리 + display/slug 분리 + canonical mapping 상태 관리로 다뤄야 한다.**
