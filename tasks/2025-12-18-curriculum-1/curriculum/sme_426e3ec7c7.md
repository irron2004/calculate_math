{"boss_id":"TS_COMB_PROB","step_nodes":
  [{"id":"PROB_PLAN_SAMPLE_SPACE_X","label":"표본공간 구성
  전략","domain":"PROB","grade_band":"G10-
  12","node_type":"step","kind":"core","lens":
  ["general"],"status":"draft","objective":"structure
  sequential sample spaces","description":"나무도식과 표로
  다단계 실험의 표본공간을 계획한다.","contains_micro":
  ["PROB_DRAW_TREE_TWO_STAGE_P","PROB_FILL_TABLE_COMBINATION
  S_P"]},{"id":"PROB_COMBINE_COUNT_RULES_X","label":"합·곱
  법칙 케이스 결합","domain":"PROB","grade_band":"G10-
  12","node_type":"step","kind":"core","lens":
  ["general"],"status":"draft","objective":"combine case
  counts","description":"겹치지 않는 사건과 순차 선택을 분리
  해 경우의 수를 결합한다.","contains_micro":
  ["PROB_ADD_DISJOINT_COUNTS_A","PROB_MULT_SEQ_COUNTS_A"]},
  {"id":"PROB_APPLY_PERM_COMB_X","label":"순열·조합 공식을
  적용","domain":"PROB","grade_band":"G10-
  12","node_type":"step","kind":"core","lens":
  ["general"],"status":"draft","objective":"apply factorial-
  based formulas","description":"계승을 이용해 P(n,r),
  C(n,r)을 정확히 계산한다.","contains_micro":
  ["PROB_EVAL_FACTORIAL_NUM_A","PROB_CALC_PERM_FORMULA_A","P
  ROB_CALC_COMB_FORMULA_A"]},
  {"id":"PROB_TRANSLATE_PROB_X","label":"경우의 수를 확률 해
  석과 연결","domain":"PROB","grade_band":"G10-
  12","node_type":"step","kind":"core","lens":
  ["general"],"status":"draft","objective":"translate counts
  to probabilities","description":"경우의 수 결과를 확률, 여
  사건, 조건부확률로 해석한다.","contains_micro":
  ["PROB_COMPUTE_EVENT_PROB_A","PROB_USE_COMPLEMENT_PROB_A",
  "PROB_EVAL_CONDITIONAL_RATIO_A"]}],"micro_nodes":
  [{"id":"PROB_DRAW_TREE_TWO_STAGE_P","label":"2단계 사건을
  나무도로 나열","domain":"PROB","grade_band":"G10-
  12","node_type":"micro","kind":"core","representation":"P"
  ,"lens":["general"],"status":"draft","objective":"draw
  two-stage outcome tree","description":"두 단계 이상 사건의
  모든 결과를 나무도식으로 펼친다.","observation_rubric":"분
  기 수와 총 경우의 수가 조건과 일치하는 나무도를 완성한
  다."},{"id":"PROB_FILL_TABLE_COMBINATIONS_P","label":"격자
  표로 경우 조합 채우기","domain":"PROB","grade_band":"G10-
  12","node_type":"micro","kind":"core","representation":"P"
  ,"lens":["general"],"status":"draft","objective":"tabulate
  outcome grid","description":"행·열 격자를 만들어 가능한 경
  우 조합을 빠짐없이 채운다.","observation_rubric":"표의 모
  든 칸이 서로 다른 결과와 일치하고 중복이 없다."},
  {"id":"PROB_ADD_DISJOINT_COUNTS_A","label":"겹치지 않는 경
  우수를 덧셈으로 합산","domain":"PROB","grade_band":"G10-
  12","node_type":"micro","kind":"core","representation":"A"
  ,"lens":["general"],"status":"draft","objective":"add
  disjoint counts","description":"분리된 사건들의 경우의 수
  를 덧셈으로 결합한다.","observation_rubric":"모든 사건이
  겹치지 않음을 확인하고 합계를 정확히 계산한다."},
  {"id":"PROB_MULT_SEQ_COUNTS_A","label":"순차 선택 경우수를
  곱셈으로 계산","domain":"PROB","grade_band":"G10-
  12","node_type":"micro","kind":"core","representation":"A"
  ,"lens":["general"],"status":"draft","objective":"multiply
  sequential counts","description":"순차 선택 단계의 경우의
  수를 곱셈으로 계산한다.","observation_rubric":"각 단계의
  경우 수를 기록하고 곱셈으로 전체 경우를 구한다."},
  {"id":"PROB_EVAL_FACTORIAL_NUM_A","label":"계승식을 전개해
  수치 계산","domain":"PROB","grade_band":"G10-
  12","node_type":"micro","kind":"core","representation":"A"
  ,"lens":["general"],"status":"draft","objective":"evaluate
  factorial expressions","description":"주어진 계승식을 전개
  해 수치 값을 계산한다.","observation_rubric":"필요한 항까
  지만 전개하여 정확한 계승 값을 산출한다."},
  {"id":"PROB_CALC_PERM_FORMULA_A","label":"순열 P(n,r) 공식
  을 대입해 계산","domain":"PROB","grade_band":"G10-
  12","node_type":"micro","kind":"core","representation":"A"
  ,"lens":["general"],"status":"draft","objective":"compute
  permutations","description":"P(n,r)=n!/(n-r)! 식에 값을 대
  입하여 계산한다.","observation_rubric":"변수 치환과 계산
  과정에서 항을 올바르게 소거한다."},
  {"id":"PROB_CALC_COMB_FORMULA_A","label":"조합 C(n,r) 공식
  을 대입해 계산","domain":"PROB","grade_band":"G10-
  12","node_type":"micro","kind":"core","representation":"A"
  ,"lens":["general"],"status":"draft","objective":"compute
  combinations","description":"C(n,r)=n!/(r!(n-r)!) 식에 값
  을 대입하여 계산한다.","observation_rubric":"분모·분자 계
  승을 약분해 정확한 조합 값을 얻는다."},
  {"id":"PROB_COMPUTE_EVENT_PROB_A","label":"성공수/전체수로
  단순 확률 계산","domain":"PROB","grade_band":"G10-
  12","node_type":"micro","kind":"core","representation":"A"
  ,"lens":["general"],"status":"draft","objective":"compute
  event probability","description":"동일 가능 사건에서 성공/
  전체 비율로 확률을 계산한다.","observation_rubric":"성공
  결과 수와 전체 결과 수를 명확히 구분해 비율을 만든다."},
  {"id":"PROB_USE_COMPLEMENT_PROB_A","label":"여사건 확률을
  1에서 빼서 계산","domain":"PROB","grade_band":"G10-
  12","node_type":"micro","kind":"core","representation":"A"
  ,"lens":["general"],"status":"draft","objective":"use
  complement rule","description":"P(A^c)=1-P(A) 관계를 사용
  해 확률을 구한다.","observation_rubric":"대상 사건과 여사
  건 관계를 확인하고 올바른 뺄셈으로 값을 얻는다."},
  {"id":"PROB_EVAL_CONDITIONAL_RATIO_A","label":"조건부확률
  비율을 계산","domain":"PROB","grade_band":"G10-
  12","node_type":"micro","kind":"core","representation":"A"
  ,"lens":["general"],"status":"draft","objective":"compute
  conditional probability","description":"P(A|B)=P(A∩B)/P(B)
  을 수치로 계산한다.","observation_rubric":"공동 사건과 조
  건 사건을 분리해 비율 계산을 정확히 수행한
  다."}],"requires_edges":
  [{"from":"TREE_TABLE_OUTCOMES","to":"PROB_DRAW_TREE_TWO_ST
  AGE_P","type":"requires","lens":null},
  {"from":"LIST_OUTCOMES_SMALL","to":"PROB_FILL_TABLE_COMBIN
  ATIONS_P","type":"requires","lens":null},
  {"from":"PROB_DRAW_TREE_TWO_STAGE_P","to":"PROB_PLAN_SAMPL
  E_SPACE_X","type":"requires","lens":null},
  {"from":"PROB_FILL_TABLE_COMBINATIONS_P","to":"PROB_PLAN_S
  AMPLE_SPACE_X","type":"requires","lens":null},
  {"from":"COUNT_RULE_ADD","to":"PROB_ADD_DISJOINT_COUNTS_A"
  ,"type":"requires","lens":null},
  {"from":"PROB_ADD_DISJOINT_COUNTS_A","to":"PROB_COMBINE_CO
  UNT_RULES_X","type":"requires","lens":null},
  {"from":"COUNT_RULE_MULT","to":"PROB_MULT_SEQ_COUNTS_A","t
  ype":"requires","lens":null},
  {"from":"PROB_MULT_SEQ_COUNTS_A","to":"PROB_COMBINE_COUNT_
  RULES_X","type":"requires","lens":null},
  {"from":"FACTORIAL_NOTATION","to":"PROB_EVAL_FACTORIAL_NUM
  _A","type":"requires","lens":null},
  {"from":"PROB_EVAL_FACTORIAL_NUM_A","to":"PROB_CALC_PERM_F
  ORMULA_A","type":"requires","lens":null},
  {"from":"PERM_BASIC","to":"PROB_CALC_PERM_FORMULA_A","type
  ":"requires","lens":null},
  {"from":"PROB_EVAL_FACTORIAL_NUM_A","to":"PROB_CALC_COMB_F
  ORMULA_A","type":"requires","lens":null},
  {"from":"COMB_BASIC","to":"PROB_CALC_COMB_FORMULA_A","type
  ":"requires","lens":null},
  {"from":"PROB_EVAL_FACTORIAL_NUM_A","to":"PROB_APPLY_PERM_
  COMB_X","type":"requires","lens":null},
  {"from":"PROB_CALC_PERM_FORMULA_A","to":"PROB_APPLY_PERM_C
  OMB_X","type":"requires","lens":null},
  {"from":"PROB_CALC_COMB_FORMULA_A","to":"PROB_APPLY_PERM_C
  OMB_X","type":"requires","lens":null},
  {"from":"PROB_BASIC_EQUALLYLIKELY","to":"PROB_COMPUTE_EVEN
  T_PROB_A","type":"requires","lens":null},
  {"from":"PROB_EVENT_OPERATIONS","to":"PROB_USE_COMPLEMENT_
  PROB_A","type":"requires","lens":null},
  {"from":"PROB_COMPUTE_EVENT_PROB_A","to":"PROB_USE_COMPLEM
  ENT_PROB_A","type":"requires","lens":null},
  {"from":"PROB_EVENT_OPERATIONS","to":"PROB_EVAL_CONDITIONA
  L_RATIO_A","type":"requires","lens":null},
  {"from":"COUNT_MIXED_APPLIED","to":"PROB_EVAL_CONDITIONAL_
  RATIO_A","type":"requires","lens":null},
  {"from":"PROB_COMPUTE_EVENT_PROB_A","to":"PROB_EVAL_CONDIT
  IONAL_RATIO_A","type":"requires","lens":null},
  {"from":"PROB_COMPUTE_EVENT_PROB_A","to":"PROB_TRANSLATE_P
  ROB_X","type":"requires","lens":null},
  {"from":"PROB_USE_COMPLEMENT_PROB_A","to":"PROB_TRANSLATE_
  PROB_X","type":"requires","lens":null},
  {"from":"PROB_EVAL_CONDITIONAL_RATIO_A","to":"PROB_TRANSLA
  TE_PROB_X","type":"requires","lens":null},
  {"from":"PROB_PLAN_SAMPLE_SPACE_X","to":"TS_COMB_PROB","ty
  pe":"requires","lens":null},
  {"from":"PROB_COMBINE_COUNT_RULES_X","to":"TS_COMB_PROB","
  type":"requires","lens":null},
  {"from":"PROB_APPLY_PERM_COMB_X","to":"TS_COMB_PROB","type
  ":"requires","lens":null},
  {"from":"PROB_TRANSLATE_PROB_X","to":"TS_COMB_PROB","type"
  :"requires","lens":null}],"suspected_long_edges":
  [{"from":"NUM_PLACEVALUE","to":"TS_COMB_PROB","reason":"자
  리값 기초에서 확률 보스로 바로 이동하여 depth 간격이 커 간
  극을 메울 단계가 필요합니다."},
  {"from":"ADD_SUB_MULTI","to":"TS_COMB_PROB","reason":"다자
  리 덧셈/뺄셈을 마스터해도 경우의 수·확률 보스로 점프하기엔
  중간 확률 개념이 비어 있습니다."},
  {"from":"FRAC_BASIC","to":"TS_COMB_PROB","reason":"분수 기
  초에서 곧바로 확률 보스 진입은 표현만 공유할 뿐 문제 맥락
  과 전략이 연결되지 않습니다."},
  {"from":"PROB_BAYES_INTRO","to":"TS_COMB_PROB","reason":"
  단일 베이즈 예시 후 즉시 보스로 보내면 조합/순열 기반 문제
  를 거치지 않아 학습 폭이 부족합니다."}],"notes":["신규
  step들이 보스로 향하는 핵심 경로를 담당하므로 기존 낮은 수
  준 노드→보스 직결 엣지는 제거하거나 신규 step에 재연결해야
  합니다.","micro 노드에 대한 평가 루브릭이 포함되었으므로
  QA 단계에서 관찰 가능성 검증과 스크립트 기반 DAG 검증을 병
  행하십시오.","추가된 micro/step을 app/data/
  curriculum_skill.json에 병합한 뒤
  recompute_skill_levels.py를 실행해 레벨 정합성을 확인하십
  시오."]}
