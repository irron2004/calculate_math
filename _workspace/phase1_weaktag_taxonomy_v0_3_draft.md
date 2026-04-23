# weakTag Taxonomy v0.3 초안 — Phase 1 (초1-2 NA 범위)

**버전:** v0.3 (v0.2 대비 초1-2 NA 영역 보강)
**생성일:** 2026-04-23
**대상:** `learning-diagnostic-designer` 승인 필요
**범위:** 초1-2 NA 성취기준 11개(2수01-01 ~ 2수01-11) 교수 상황

---

## 네이밍 규칙 (`diagnostic-taxonomy-design` 스킬 준수)

`{갈래}_{개념영역}_{오류유형}` snake_case. 도메인 코드(NA/RR/GM/DP) 접두로 시작.

---

## 태그 목록 (총 19개)

### 수 개념 (NA_num)
| tag | 정의 | 관련 성취기준 | 예시 오답 |
|---|---|---|---|
| `NA_num_count_skip` | 수를 셀 때 하나 이상 건너뜀 | 2수01-01 | 1,2,4,5 (3 누락) |
| `NA_num_count_order` | 수 순서 혼동 | 2수01-01 | 18,19,20,22,21 |
| `NA_num_compare_reversed` | 대소 비교 방향 반전 | 2수01-03 | 7 > 9 라고 답 |
| `NA_num_decompose_miss` | 수 분해 합 맞지 않음 | 2수01-04 | 12 = 5 + 6 |

### 자릿값 (NA_place)
| tag | 정의 | 관련 성취기준 | 예시 오답 |
|---|---|---|---|
| `NA_place_digit_confusion` | 자릿값 위치 혼동 | 2수01-02 | 십의 자리 2, 일의 자리 3인 수를 32로 읽음 |
| `NA_place_zero_read` | 0이 포함된 수 읽기 오류 | 2수01-02 | 305를 "삼오"로 읽음 |
| `NA_place_four_digit_mix` | 네자리 수 자릿값 혼동 (천·백) | 2수01-02, 2수01-03 | 1205 → 1025로 씀 |

### 덧셈 (NA_add)
| tag | 정의 | 관련 성취기준 | 예시 오답 |
|---|---|---|---|
| `NA_add_carry_missing` | 받아올림을 적용하지 않음 | 2수01-06 | 37+58=85 |
| `NA_add_carry_wrong_place` | 받아올림 자리 오류 | 2수01-06 | 37+58=915 |
| `NA_add_align_digit` | 세로셈 자리 맞추기 오류 | 2수01-06 | 23+5를 28 대신 73 |
| `NA_add_three_numbers_order` | 세 수 덧셈 순서 혼동 | 2수01-08 | (12+5)+3 누적 실수 |

### 뺄셈 (NA_sub)
| tag | 정의 | 관련 성취기준 | 예시 오답 |
|---|---|---|---|
| `NA_sub_borrow_missing` | 내림(빌려오기)을 적용하지 않음 | 2수01-06 | 52-17=45 |
| `NA_sub_borrow_direction` | 작은수-큰수 방향 반전 | 2수01-06 | 52-17에서 7-2=5로 |
| `NA_sub_zero_borrow` | 0에서 빌려오기 오류 | 2수01-06 | 103-57 계산 실패 |

### 덧셈-뺄셈 관계 (NA_addsub)
| tag | 정의 | 관련 성취기준 | 예시 오답 |
|---|---|---|---|
| `NA_addsub_inverse` | 덧뺄 역연산 관계 미인식 | 2수01-07 | □+5=12에서 □=12+5 |

### 곱셈 (NA_mul)
| tag | 정의 | 관련 성취기준 | 예시 오답 |
|---|---|---|---|
| `NA_mul_times_table` | 구구단 값 오류 | 2수01-11 | 6×7=48 |
| `NA_mul_repeated_add` | 곱셈↔반복덧셈 혼동 | 2수01-10 | 3×4를 3+4로 |

### 문장제 (NA_word)
| tag | 정의 | 관련 성취기준 | 예시 오답 |
|---|---|---|---|
| `NA_word_op_choice` | 연산 선택 오류 (덧뺄 중) | 2수01-05, 2수01-10 | "남은 것" → 덧셈 선택 |
| `NA_word_question_miss` | 물음에 답 안 맞춤 | 전반 | 개수 물었는데 가격 답 |

---

## v0.2 → v0.3 변경점

v0.2는 `homework_label_taxonomy_and_naming_rule_v0_2.md`의 라벨 규칙 기준. v0.3은 거기에 **초1-2 NA 정밀 태그 19개 추가**. 기존 태그 폐기 없음 → 하위 호환 유지.

---

## 상태 전이 규칙 (이번 Phase에서는 v0.2 유지)

이 문서는 weakTag만 담당. 상태 전이(약점확인→보강중→해결됨)는 기존 v0.2 규칙 재사용. Phase 6에서 성취기준 간 prereq를 넣을 때 재검토.

---

## 후속 영향 (`diagnostic-taxonomy-design` 스킬 §7 영향 전파)

| 대상 | 영향 |
|---|---|
| `problem-content-designer` | 초1-2 NA 문제 출제 시 이 19개 태그 사용 가능. 기존 문제 재태깅은 optional (하위 호환) |
| `math-backend-engineer` | weakTag enum 확장 필요. 마이그레이션은 단순 INSERT (삭제 없음) |
| `student-state-researcher` | 과거 데이터 재분석 **불필요** (태그 추가만, 기존 값 유지) |
