# 숙제 label taxonomy / name rule v0.3

**승인일:** 2026-04-23
**이전 버전:** `homework_label_taxonomy_and_naming_rule_v0_2.md`
**하위 호환:** 유지 — v0.2의 모든 규칙 상속. v0.3은 **확장**이며 삭제·수정 없음.

---

## 0. 목적

v0.2는 숙제 label의 **축(axis)과 slug 규칙**이라는 메타 규칙을 정의했다. v0.3은 그 위에:

1. `error_type` 축의 **실제 태그 카탈로그 81개**를 정식화한다.
2. 커리큘럼 그래프 v0.3(`curriculum_math_2022.json` atomicSkills 필드)과 1:1 매핑되는 **기준 태그 집합**을 고정한다.
3. 문제 출제자·조교·학생 상태 분석자 모두가 참조할 **단일 진실(SSOT)** 로 사용된다.

---

## 1. v0.2와의 관계

### 1.1 상속하는 것

- label 6축 구조 (`topic / objective / error_type / status / difficulty / source`)
- `display_name` / `internal_key(slug)` 분리
- canonical mapping 속성 (`mapping_scope`, `mapping_status`)
- 금지 패턴 (축 혼합, 문장형, 자유 포맷)

### 1.2 추가·정식화하는 것

- `error_type` 축 태그 80개 **구체 목록** (§2)
- 태그 값의 **인코딩 규칙** — v0.2 slug 규칙과 구분 (§1.3)
- weakTag ↔ curriculum node 매핑 원칙 (§3)

### 1.3 태그 값 인코딩: v0.2 slug와 구분

v0.2의 `slug`는 **label 엔티티**의 내부 키(`kebab-case`, 예: `error-sign-mistake`)다. v0.3에서 도입하는 **tag value**는 데이터 속성으로 grapo JSON·DB enum에 저장되는 값이다.

| 구분 | 규칙 | 예시 |
|---|---|---|
| **label slug** (v0.2) | `kebab-case`, axis prefix, 하이픈 구분 | `error-na-add-carry-missing` |
| **tag value** (v0.3) | `SNAKE_CASE`, domain prefix, 언더스코어 | `NA_add_carry_missing` |

**이유:** tag value는 JSON 데이터로서 반복 저장·검색되며, 관행상 enum-like 상수에는 snake_case가 일반적이다. label 엔티티 slug는 kebab-case를 유지한다. 두 포맷은 상호 변환 가능하다.

**매핑 규칙:** tag value `NA_add_carry_missing` ↔ label slug `error-na-add-carry-missing`.

---

## 2. weakTag 카탈로그 (80개)

**네이밍 공식:** `{DOMAIN}_{개념영역}_{오류유형}` (snake_case)

**DOMAIN:** `NA`(수와 연산), `RR`(변화와 관계), `GM`(도형과 측정), `DP`(자료와 가능성)

### 2.1 NA — 수와 연산 (초1-2 범위, 19개)

#### 수 개념
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_num_count_skip` | 수를 셀 때 건너뜀 | 1,2,4,5 (3 누락) |
| `NA_num_count_order` | 수 순서 혼동 | 18,19,20,22,21 |
| `NA_num_compare_reversed` | 대소 비교 방향 반전 | 7 > 9 |
| `NA_num_decompose_miss` | 수 분해 합 오류 | 12 = 5 + 6 |

#### 자릿값
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_place_digit_confusion` | 자릿값 위치 혼동 | 23 ↔ 32 |
| `NA_place_zero_read` | 0 포함 수 읽기 | 305 → "삼오" |
| `NA_place_four_digit_mix` | 네자리 자릿값 혼동(천·백) | 1205 → 1025 |

#### 덧셈
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_add_carry_missing` | 받아올림 누락 | 37+58=85 |
| `NA_add_carry_wrong_place` | 받아올림 자리 오류 | 37+58=915 |
| `NA_add_align_digit` | 세로셈 자리 맞춤 오류 | 23+5 = 73 |
| `NA_add_three_numbers_order` | 세 수 덧셈 순서 혼동 | - |

#### 뺄셈
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_sub_borrow_missing` | 내림 누락 | 52-17=45 |
| `NA_sub_borrow_direction` | 작은수-큰수 방향 반전 | 52-17에서 7-2=5 |
| `NA_sub_zero_borrow` | 0에서 빌려오기 오류 | 103-57 실패 |

#### 덧뺄 관계
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_addsub_inverse` | 덧뺄 역연산 미인식 | □+5=12 → □=12+5 |

#### 곱셈
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_mul_times_table` | 구구단 오류 | 6×7=48 |
| `NA_mul_repeated_add` | 곱셈↔반복덧셈 혼동 | 3×4 → 3+4 |

#### 문장제
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_word_op_choice` | 연산 선택 오류 | "남은 것" → 덧셈 |
| `NA_word_question_miss` | 물음에 답 불일치 | 개수 물었는데 가격 답 |

### 2.2 NA — 초3-4 확장 (15개)

#### 큰 수
| tag | 정의 |
|---|---|
| `NA_large_num_comma_read` | 만·억 단위 콤마 해석 오류 |
| `NA_large_num_zero_place` | 중간 0 자릿값 누락 |

#### 분수
| tag | 정의 |
|---|---|
| `NA_frac_meaning` | 전체-부분 관계 미인식 |
| `NA_frac_read_write` | 분수 표기 혼동 (분자·분모) |
| `NA_frac_add_same_denom` | 분모 같은 분수 덧셈에서 분모 더함 |
| `NA_frac_sub_same_denom` | 분모 같은 분수 뺄셈 분모 처리 오류 |
| `NA_frac_improper_mixed` | 가분수↔대분수 변환 오류 |

#### 소수
| tag | 정의 |
|---|---|
| `NA_dec_place_read` | 소수 자릿값 읽기 오류 |
| `NA_dec_add_align` | 소수점 자리 맞춤 오류 |
| `NA_dec_sub_align` | 소수 뺄셈 자리 맞춤 |

#### 세자리·곱·나눗
| tag | 정의 |
|---|---|
| `NA_add_3d_multi_carry` | 세자리 연속 받아올림 |
| `NA_sub_3d_multi_borrow` | 세자리 연속 내림 |
| `NA_mul_2d_2d_partial` | 2자리×2자리 부분곱 누락 |
| `NA_mul_carry_combine` | 곱셈 받아올림 합산 오류 |
| `NA_div_remainder` | 나머지 처리 오류 |
| `NA_div_zero_in_quotient` | 몫 중간 0 누락 |

(표기 오류 수정: 이 섹션 16개 — 실제 총 16, 2.1 19 + 2.2 16 = 35)

### 2.3 RR — 변화와 관계 (2개, 초1-2)

| tag | 정의 |
|---|---|
| `RR_pattern_rule_miss` | 규칙 찾기 실패 |
| `RR_pattern_visual_text` | 시각 규칙↔언어 규칙 전환 실패 |

### 2.4 RR — 고등 대수·미적분I (33개)

#### 지수
| tag | 정의 |
|---|---|
| `RR_exp_law_misuse` | 지수법칙 적용 오류 |
| `RR_exp_negative_sign` | 음의 지수 처리 오류 |
| `RR_exp_rational` | 유리수 지수 계산 오류 |
| `RR_root_index_confusion` | n제곱근 지수 혼동 |

#### 함수
| tag | 정의 |
|---|---|
| `RR_func_graph_reflection` | 함수 그래프 반사·이동 오류 |
| `RR_exp_eq_same_base` | 지수방정식 같은 밑 처리 오류 |

#### 로그
| tag | 정의 |
|---|---|
| `RR_log_def_inverse` | 로그 정의·역함수 혼동 |
| `RR_log_domain_miss` | 로그 정의역 조건 누락 |
| `RR_log_law_misuse` | 로그 법칙 오적용 |
| `RR_log_base_change` | 밑 변환 공식 오류 |

#### 삼각
| tag | 정의 |
|---|---|
| `RR_trig_special_miss` | 특수각 값 혼동 |
| `RR_trig_quadrant_sign` | 사분면 부호 오류 |
| `RR_trig_identity_miss` | 삼각 항등식 미숙 |
| `RR_trig_addition_sign` | 덧셈정리 부호 오류 |

#### 수열
| tag | 정의 |
|---|---|
| `RR_seq_term_formula` | 수열 일반항 공식 오류 |
| `RR_seq_sum_count_error` | 수열 합 항 수 오류 |
| `RR_seq_geom_r1_miss` | 등비수열 r=1 구분 누락 |

#### 극한·연속
| tag | 정의 |
|---|---|
| `RR_limit_indet_method` | 0/0 꼴 처리 방법 오류 |
| `RR_limit_one_sided_miss` | 좌우극한 구분 누락 |
| `RR_continuity_partial_check` | 연속 조건 부분 체크 |

#### 미분
| tag | 정의 |
|---|---|
| `RR_deriv_def_formula` | 미분계수 정의식 오류 |
| `RR_deriv_power_error` | 거듭제곱 미분 공식 오류 |
| `RR_deriv_product_missing_term` | 곱 미분 항 누락 |
| `RR_deriv_quotient_sign` | 몫 미분 부호 오류 |
| `RR_deriv_chain_miss` | 체인 룰 누락 |

#### 미분 활용
| tag | 정의 |
|---|---|
| `RR_tangent_point_substitution` | 접선 점 대입 오류 |
| `RR_extreme_sign_change` | 극값 판정 부호 변화 놓침 |

#### 적분
| tag | 정의 |
|---|---|
| `RR_integral_power_error` | 거듭제곱 적분 공식 오류 |
| `RR_integral_C_miss` | 적분상수 C 누락 |
| `RR_integral_ftc_sign` | 미적분 기본정리 부호 |
| `RR_integral_bound_order` | 적분 구간 순서 오류 |

#### 적분 활용
| tag | 정의 |
|---|---|
| `RR_area_sign_split` | 절댓값·구간 분할 오류 |
| `RR_area_order_fg` | 두 곡선 위아래 순서 오류 |

### 2.5 GM — 도형과 측정 (8개, 초1-2)

| tag | 정의 |
|---|---|
| `GM_shape3d_identify` | 입체도형 혼동 |
| `GM_shape2d_identify` | 평면도형 구분 오류 |
| `GM_shape_elements_miss` | 변·꼭짓점 개수 혼동 |
| `GM_measure_direct_wrong` | 직접 비교 기준 혼동 |
| `GM_time_read_confusion` | 시침·분침 혼동 |
| `GM_time_calc_wrong` | 60진법 시간 덧뺄 오류 |
| `GM_length_unit_confuse` | cm↔m 환산 오류 |
| `GM_length_measure_start` | 자 0 지점 미정렬 |

### 2.6 DP — 자료와 가능성 (3개, 초1-2)

| tag | 정의 |
|---|---|
| `DP_classify_criterion` | 분류 기준 일관성 결여 |
| `DP_table_total_miss` | 표 합계 계산 오류 |
| `DP_graph_scale_read` | 그림그래프 눈금 해석 오류 |

### 2.7 카탈로그 합계

| 영역 | 개수 |
|---|---|
| NA (초1-4) | 35 |
| RR (초1-2 + 고2) | 35 |
| GM (초1-2) | 8 |
| DP (초1-2) | 3 |
| **합계** | **81** |

> (v0.2 문서 대비 81개 구체 태그 추가. 기존 v0.2의 메타 규칙은 그대로 유지)

---

## 3. weakTag ↔ curriculum node 매핑 원칙

v0.3 그래프의 `atomicSkills` 필드는 각 원자 스킬마다 `weakTags: [...]` 배열을 가진다. 이 배열에 들어가는 값은 **§2 카탈로그에 등록된 태그만 허용**한다.

### 3.1 1:N 매핑

- 하나의 atomicSkill은 **0개 이상의 weakTag**를 가질 수 있다.
- 예: `AS_NA_add_2d_2d_carry` → `[NA_add_carry_missing, NA_add_carry_wrong_place]`

### 3.2 카탈로그에 없는 태그 사용 금지

- 문제 출제자가 "새 태그가 필요"하다고 판단하면 먼저 `learning-diagnostic-designer` 에게 제안해 v0.4 승격을 받아야 한다.
- 임시로 frontend/backend에 enum에 없는 값이 들어가면 검증 실패로 처리한다.

### 3.3 atomicSkill이 없는 achievement

- 일부 achievement는 `atomicSkills` 필드가 비어 있다 (초1-2 GM 등 MVP 범위 밖 일부).
- 해당 achievement에 대해 문제가 만들어지기 전까지는 태그 매핑 없이 둔다.

---

## 4. 상태 전이 규칙 (v0.2 유지)

v0.3에서는 **상태값과 전이 규칙을 변경하지 않는다.** 향후 실제 운영 데이터 분석 결과에 따라 v0.4에서 조정한다.

기존 상태값:
- 약점확인 (weak_identified)
- 보강중 (reinforcing)
- 재확인필요 (recheck_needed)
- 해결됨 (resolved)

---

## 5. v0.2 → v0.3 Diff

| 항목 | v0.2 | v0.3 |
|---|---|---|
| label 축 구조 | 6축 | 6축 (동일) |
| slug 규칙 | kebab-case | kebab-case (동일, label 엔티티용) |
| error_type 태그 | 개념만 (`부호 실수` 예시 수준) | **81개 구체 태그 정식화** |
| tag value 인코딩 | 미정의 | `SNAKE_CASE` + domain prefix 도입 |
| 상태 전이 | 4단계 | 4단계 (동일) |
| 금지 패턴 | 5종 | 5종 (동일) |

---

## 6. 마이그레이션 영향

| 대상 | 영향 |
|---|---|
| 기존 데이터 | **영향 없음** — 추가만, 삭제·변경 없음 |
| `problem-content-designer` | v0.3 태그 사용 가능. 기존 문제 재태깅은 선택 사항 |
| `math-backend-engineer` | weakTag enum 확장 필요 (81개 값 추가). 단순 INSERT 마이그레이션 |
| `student-state-researcher` | 과거 데이터 재분석 불필요 (기존 값 유지) |
| `homework-ta` | 태그 기반 필터·집계 UI가 있으면 신규 태그 드롭다운 반영 |

---

## 7. 승인 및 커밋

- **제안자:** `learning-diagnostic-designer` (하네스 에이전트)
- **승인자:** 사용자 (2026-04-23)
- **관련 PR:** #32 (curriculum v0.3 graph merge)
- **산출물 원본:** `_workspace/phase1_weaktag_taxonomy_v0_3_draft.md`, `_workspace/phase2_weaktag_taxonomy_v0_3_extension.md`

---

## 8. 다음 버전 (v0.4) 고려 사항

- 상태 전이 규칙을 실 운영 데이터 기반으로 조정
- 중학교(7-9) 범위 태그 추가 (현재 v0.3은 초1-4 + 고2)
- 미적분II·기하·확률통계 태그 추가
- 태그별 "해결됨" 판정 임계값 구체화 (예: 동일 태그 X회 미재발 시 해결)
