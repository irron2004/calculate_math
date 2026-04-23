# weakTag Taxonomy v0.3 확장 — Phase 2 (초1-2 RR/GM/DP + 초3-4 NA)

Phase 1의 taxonomy에 **28개 태그 추가**. v0.3 버전 유지, 하위 호환.

## RR (변화와 관계)

| tag | 정의 | 예시 오답 |
|---|---|---|
| `RR_pattern_rule_miss` | 규칙 찾기 실패 (다음 항 예측 오류) | 2,4,6,8 다음을 10 대신 9 |
| `RR_pattern_visual_text` | 시각 규칙↔언어 규칙 전환 실패 | 도형 패턴을 말로 설명 못 함 |

## GM (도형과 측정)

| tag | 정의 | 예시 오답 |
|---|---|---|
| `GM_shape3d_identify` | 입체도형 혼동 (구·원기둥·원뿔) | 원뿔을 "공"이라 함 |
| `GM_shape2d_identify` | 평면도형 혼동 (삼각형·사각형 구분) | 변 수 오답 |
| `GM_shape_elements_miss` | 꼭짓점·변 개수 혼동 | 사각형 꼭짓점을 3개 |
| `GM_measure_direct_wrong` | 직접 비교 기준 혼동 (길이↔넓이) | 긴 연필 vs 큰 종이 비교 |
| `GM_time_read_confusion` | 시침·분침 혼동 | 3:15를 3:03으로 |
| `GM_time_calc_wrong` | 시간 덧뺄 오류 (60진법) | 1시간 30분 + 45분 = 1시간 75분 |
| `GM_length_unit_confuse` | cm ↔ m 단위 환산 실수 | 1m = 10cm |
| `GM_length_measure_start` | 자 0 지점 미정렬 | 눈금 1부터 시작 |

## DP (자료와 가능성)

| tag | 정의 | 예시 오답 |
|---|---|---|
| `DP_classify_criterion` | 분류 기준 일관성 결여 | 색/모양 기준 혼용 |
| `DP_table_total_miss` | 표 합계 계산 오류 | - |
| `DP_graph_scale_read` | 그림그래프 눈금 해석 오류 | 기호 1개 = 5개인데 1개로 셈 |

## NA (초3-4 확장)

### 큰 수
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_large_num_comma_read` | 만·억 단위 콤마 해석 오류 | 1,234,567을 "백이십삼만..." 잘못 |
| `NA_large_num_zero_place` | 중간 0 자릿값 누락 | 3005를 350으로 씀 |

### 분수
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_frac_meaning` | 전체-부분 관계 미인식 | 1/2와 2/4가 같다는 개념 부재 |
| `NA_frac_read_write` | 분수 표기 혼동 (분자·분모) | 2/3을 "삼분의 이"가 아닌 |
| `NA_frac_add_same_denom` | 분모 같은 분수 덧셈에서 분모 더함 | 1/5 + 2/5 = 3/10 |
| `NA_frac_sub_same_denom` | 분모 같은 분수 뺄셈 분모 처리 오류 | 3/7 - 1/7 = 2/0 |
| `NA_frac_improper_mixed` | 가분수↔대분수 변환 오류 | 7/3을 2(1/3) 아닌 |

### 소수
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_dec_place_read` | 소수 자릿값 읽기 오류 | 0.12를 "영점일이" 대신 |
| `NA_dec_add_align` | 소수점 자리 맞추기 오류 | 1.2 + 0.34 = 1.56 대신 4.6 |
| `NA_dec_sub_align` | 소수 뺄셈 자리 맞추기 | - |

### 세자리 덧뺄 + 곱셈/나눗셈
| tag | 정의 | 예시 오답 |
|---|---|---|
| `NA_add_3d_multi_carry` | 세자리 연속 받아올림 | 678+245에서 중간 받아올림 누락 |
| `NA_sub_3d_multi_borrow` | 세자리 연속 내림 | 1000-357 같은 0 많은 뺄셈 |
| `NA_mul_2d_2d_partial` | 2자리×2자리 부분곱 누락 | 23×45에서 위 줄만 |
| `NA_mul_carry_combine` | 곱셈 받아올림 합산 오류 | - |
| `NA_div_remainder` | 나머지 처리 오류 | 17÷5=2 나머지 7 |
| `NA_div_zero_in_quotient` | 몫 중간 0 누락 | 605÷5 = 121 |
