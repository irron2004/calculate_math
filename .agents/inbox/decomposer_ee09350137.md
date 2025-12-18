# Atomic Skill Decomposer Request ee09350137

너는 “원자 스킬 분해자(Atomic Skill Decomposer)”다.
목표는 SME가 만든 큰/애매한 노드를 micro 규칙으로 **쪼개고**, 중복은 **병합**하며, micro의 선수(필수 선행)를 **누락 없이** 제안하는 것이다.

[Task 파일]
/mnt/c/Users/irron/Desktop/my/web_service_new/calculate_math/tasks/2025-12-18-curriculum-1/task.md

[공통 규격(아키텍트 스펙)]
## 1. 노드 타입 정의 (필드/목적)

  - 공통 필수 필드: id, title, domain, grade_band,
    node_type(micro|step|boss), kind(core|boss),
    requires[], representation(C|P|A), status(draft|
    active).
  - 권장 필드: objective(관찰 가능한 동사 1개),
    concept_glossary(온톨로지 키), examples,
    assessment_hook, aliases(동의어 사전), tags(standard,
    test), owner.
  - micro: 한 행동+한 개념+한 표현을 기록하는 가장 작은 단
    위. 목적은 정밀 추적과 레벨 자동 산출. 필수 필드에
    observation_rubric 추가 권장.
  - step: 2~5개의 micro를 묶어 하나의 전략/절차를 표현.
    node_type=step, kind=core. requires는 전부 micro 수준으
    로 연결, contains_micro[] 메타 필드 허용(저장용).
  - boss: 성취도 평가/대과제. node_type=boss, kind=boss.
    requires는 최소 2 depth의 step/micro.
    success_criteria(정확도/시간/표현)와 min_mastery_level
    필드 권장.
  - 레벨은 입력 필드가 아니라 scripts/
    recompute_skill_levels.py 로 계산하며, DAG 유지가 전제.
  - 온톨로지 원칙: concept_glossary는 SSOT key로 유지, 모든
    aliases 배열은 glossary 참고로 중복 방지.

  ## 2. 엣지 타입 정의

  - requires (필수): 단방향 DAG, 잠금/해제는 requires만 사
    용. 다중 선수 허용, 동일 depth 건너뛰기 방지.
  - 옵션 메타 엣지 (JSON에서는 별도 배열 허용):
      - relates_to: 유사 주제 링크, 추천 탐색용 (위상에 영
        향 없음).
      - analog_of: 표현 전환(A↔P) 매핑. Phase 2에서만 사용,
        현재는 스펙에 정의만.
  - 모든 엣지는 source_id, target_id, relation 구조 사용.
    requires 외 엣지는 분석용이므로 파이프라인에서 무시 가
    능해야 함.

  ## 3. Micro Granularity 합격/불합격 예시

  | 예시 | 판정 | 코멘트 |
  | --- | --- | --- |
  | FRA_ADD_LIKE_DENOM_P “분모가 같은 분수 두 개를 그림으로
  더한다” | 합격 | 단일 행동(덧셈), 단일 개념, P 표현 |
  | ALG_ISOLATE_VAR_ONE_STEP_A “x+5=12에서 x를 고립한다” |
  합격 | 행동 1개, 개념 1개, A 표현 |
  | GEO_IDENTIFY_RIGHT_TRIANGLE_C “사진에서 직각삼각형을 구
  별한다” | 합격 | 관찰 행동+단일 개념 |
  | STAT_READ_BAR_CHART_P | 합격 | 읽기 행동, C→P 하나의 표
  현 |
  | MEAS_USE_CM_RULER_P | 합격 | 측정 행동 1개 |
  | ALG_SOLVE_LINEAR_SYSTEM | 불합격 | 복수 행동(소거/대입
  등) |
  | GEO_TRIANGLES | 불합격 | 개념 집합, 구체적 행동 없음 |
  | NUM_UNDERSTAND_DECIMALS | 불합격 | “이해한다”는 관찰 불
  가 |
  | CALC_DIFFERENTIATE_POLYNOMIAL_A_P | 불합격 | 표현 2개
  (A,P) 동시 요구 |
  | FRA_ADD_SUB_MIXED | 불합격 | 덧셈/뺄셈 두 행동 혼재 |

  - 불합격 항목은 step 또는 boss에 재설계하거나 분해한다.

  ## 4. 네이밍/ID 규칙

  - 포맷: DOMAIN_ACTION_CONCEPT_REP[ _TIER ]
      - DOMAIN: ALG, FRA, GEO, STAT, MEAS, PROB 등 상위 도
        메인 3글자.
      - ACTION: 동사 형태(UPPER_SNAKE). 관찰 가능한 하나의
        동사만.
      - CONCEPT: 핵심 개념. 필요 시 온톨로지 key 사용.
      - REP: C(Concrete), P(Pictorial), A(Abstract). step/
        boss는 X.
  - 예: ALG_SIMPLIFY_LINEAR_A, STAT_COMPARE_DOT_PLOT_P.
  - 예외: 국가 표준 ID 유지 필요 시 STD_<code> prefix 후
    _ACTION_CONCEPT_REP.
  - 동의어/중복 방지: concept_glossary에 canonical term 등
    록, 새 노드 생성 전 aliases와 glossary cross-check 필
    수.

  ## 5. 마스터리 레벨(0~3) 정의 및 min_level 운영

  - Level 0: 미학습. requires 미충족. min_level=0은 모든 학
    습자 접근 허용(탐색/진단).
  - Level 1 (초기): guided 연습으로 70% 이상 정확. micro 수
    준에서 제공되는 힌트를 필요로 함.
  - Level 2 (숙련): 독립 수행 90% 이상, step 노드 자동 해금
    기준. boss 접근 최소 Level 2.
  - Level 3 (전이): 시간/표현 변형에도 안정적. boss 완료 조
    건으로 사용.
  - min_level 필드는 unlock gate. 예: boss 노드 min_level=2
    => 모든 requires 노드가 Level 2 이상일 때만 boss 활성.
  - 평가: assessment_hook는 level rubric 항목과 연결, 재계
    산 시 mastery 이벤트에 기반.

  ## 6. QA 체크리스트

  - 사이클 검출: requires 그래프에 cycle 없음을 DAG 검증 스
    크립트로 확인.
  - 고아 노드: requires in-degree/out-degree를 확인해 진입
    점 또는 사용처가 없는 노드 제거/연결.
  - 점프 방지: 레벨 차이 >2인 edge 존재 시 재검토(중간
    micro 추가).
  - 중복: id, aliases, title 동일/유사 항목 glossary 비교.
  - 도메인 누락: 학년군별 필수 standard 대조표와 coverage
    gap 점검.
  - 보스 도달 가능성: 각 boss는 최소 2 depth 경로,
    branching factor 2~4 유지. recompute_skill_levels.py 실
    행 결과로 레벨 정상 생성 확인.

  ## 7. 티켓 단위 권장안

  - “보스 1개 + 하위 2~3 depth”를 한 번에 설계/검증하는 스
    프린트 단위.
      1. 대상 boss 정의 → 성공 기준/assessment 설계.
      2. boss에 직접 연결될 step 2~3개 선정.
      3. 각 step을 구성하는 micro 3~6개 작성, 온톨로지/ID/
         representation 체크.
      4. 그래프 인입/유출 edge 정비 후
         recompute_skill_levels.py로 레벨 검증.
      5. QA 체크리스트 통과 후 boss 단위 티켓 close.

[타깃 보스]
- boss_id: TS_COMB_PROB
- boss_label: 보스 스킬: 경우의 수·확률 마스터

[이미 존재하는 노드 IDs(참고)]
ADD_SUB_MULTI, COMB_BASIC, COUNT_MIXED_APPLIED, COUNT_RULE_ADD, COUNT_RULE_MULT, FACTORIAL_NOTATION, FRAC_BASIC, FRAC_DEC_OP, FRAC_DEC_REL, INT_RATIONAL_OP, LIST_OUTCOMES_SMALL, MULT_DIV_BASIC, NUM_PLACEVALUE, PERM_BASIC, PROB_BASIC_EQUALLYLIKELY, PROB_BAYES_INTRO, PROB_COND_BASIC, PROB_EVENT_OPERATIONS, SET_BASIC_EVENTS, TREE_TABLE_OUTCOMES, TS_COMB_PROB

[SME 산출물]
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

[Ontology Librarian 산출물]
{"merge_ids":
  [{"alias_id":"COUNT_RULE_ADD","kept_id":"PROB_ADD_DISJOIN
  T_COUNTS_A","reason":"app/data/curriculum_skill.json:322
  labels COUNT_RULE_ADD as 합의 법칙(겹치지 않는 사건),
  which is the same disjoint-case addition skill described
  for PROB_ADD_DISJOINT_COUNTS_A in tasks/2025-12-18-
  curriculum-1/curriculum/sme_426e3ec7c7.md:46-52, so keep
  the micro id with the observation rubric as
  canonical.","confidence":"medium"},
  {"alias_id":"COUNT_RULE_MULT","kept_id":"PROB_MULT_SEQ_CO
  UNTS_A","reason":"app/data/curriculum_skill.json:353
  frames COUNT_RULE_MULT as the sequential multiplication
  rule, identical to the behavior captured in tasks/2025-
  12-18-curriculum-1/curriculum/sme_426e3ec7c7.md:53-59 for
  PROB_MULT_SEQ_COUNTS_A, so the older macro id should
  alias to the micro.","confidence":"medium"},
  {"alias_id":"PROB_BASIC_EQUALLYLIKELY","kept_id":"PROB_CO
  MPUTE_EVENT_PROB_A","reason":"PROB_BASIC_EQUALLYLIKELY in
  app/data/curriculum_skill.json:509 already defines
  probability as 성공수/전체수 under equally likely
  outcomes, which is exactly what the micro
  PROB_COMPUTE_EVENT_PROB_A executes in tasks/2025-12-18-
  curriculum-1/curriculum/sme_426e3ec7c7.md:81-
  87.","confidence":"medium"},
  {"alias_id":"PROB_COND_BASIC","kept_id":"PROB_EVAL_CONDIT
  IONAL_RATIO_A","reason":"app/data/
  curriculum_skill.json:570 states PROB_COND_BASIC as
  computing P(A|B)=P(A∩B)/P(B), matching the micro
  objective at tasks/2025-12-18-curriculum-1/curriculum/
  sme_426e3ec7c7.md:95-101, so keep
  PROB_EVAL_CONDITIONAL_RATIO_A as the canonical
  id.","confidence":"medium"}],"rename_suggestions":
  [{"id":"PROB_PLAN_SAMPLE_SPACE_X","label":"다단계 표본공
  간 계획","reason":"tasks/2025-12-18-curriculum-1/
  curriculum/sme_426e3ec7c7.md:2-8 emphasizes planning
  multi-stage sample spaces with trees and tables; adding
  다단계 distinguishes this step from the base
  TREE_TABLE_OUTCOMES skill at app/data/
  curriculum_skill.json:292."},
  {"id":"PROB_FILL_TABLE_COMBINATIONS_P","label":"격자 표본
  공간 채우기","reason":"The node at tasks/2025-12-18-
  curriculum-1/curriculum/sme_426e3ec7c7.md:39-45 is about
  filling an outcome grid, but the word 조합 collides with
  COMB_BASIC in app/data/curriculum_skill.json:445 that
  actually refers to C(n,r); rename to stress grid-based
  enumeration."},{"id":"PROB_TRANSLATE_PROB_X","label":"경
  우의 수→확률 해석","reason":"tasks/2025-12-18-curriculum-
  1/curriculum/sme_426e3ec7c7.md:24-30 translates raw case
  counts into probabilities, complements, and conditional
  statements, so the label should explicitly show the
  direction of translation to avoid confusion with counting
  steps."}],"glossary":[{"term":"표본공간","preferred":"표
  본공간","avoid":["경우공간","결과집합"]},{"term":"합의 법
  칙","preferred":"겹치지 않는 사건 덧셈 법칙","avoid":["합
  법칙","합의법칙"]},{"term":"곱의 법칙","preferred":"순차
  선택 곱셈 법칙","avoid":["곱법칙","곱하기법
  칙"]}],"notes":["Rewire every requires edge that
  currently points to COUNT_RULE_ADD, COUNT_RULE_MULT,
  PROB_BASIC_EQUALLYLIKELY, or PROB_COND_BASIC in app/data/
  curriculum_skill.json to the canonical micro IDs above
  before rerunning scripts/
  recompute_skill_levels.py.","COUNT_MIXED_APPLIED (app/
  data/curriculum_skill.json:476) still bundles 합·곱·순열·
  조합; once PROB_COMBINE_COUNT_RULES_X and
  PROB_APPLY_PERM_COMB_X from tasks/2025-12-18-curriculum-
  1/curriculum/sme_426e3ec7c7.md:9-23 are added, demote or
  retire the old macro node.","PROB_EVENT_OPERATIONS (app/
  data/curriculum_skill.json:540) overlaps with
  PROB_ADD_DISJOINT_COUNTS_A, PROB_MULT_SEQ_COUNTS_A, and
  PROB_USE_COMPLEMENT_PROB_A from tasks/2025-12-18-
  curriculum-1/curriculum/sme_426e3ec7c7.md:46-101, so
  convert it into a step container or remove it to maintain
  single-action micros."]}

[규칙]
- micro는 단일 행동 + 단일 개념 + 단일 표현(C/P/A).
- “이해/알기” 금지 → 관찰 가능한 행동(계산/비교/표현/변환/설명)으로.
- 동일 의미의 micro가 이미 있으면 새로 만들지 말고 기존 ID를 재사용(merge/alias로 정리).

[출력]
- 아래 마커 블록 안에는 **반드시 JSON 오브젝트 1개만** 출력한다(코드펜스/설명 금지).
- 스키마(예시):

  {
    "new_micro_nodes": [{"...":"..."}],
    "merge_ids": [{"alias_id":"OLD","kept_id":"NEW","reason":"..."}],
    "original_to_micro": [
      {"original_id":"SOME_STEP_OR_BIG_NODE","micro_ids":["MICRO_1","MICRO_2"]}
    ],
    "missing_prereq_suggestions": [{"...":"..."}],
    "notes": ["..."]
  }

###BEGIN:ee09350137###
(여기에 JSON만)
###DONE:ee09350137###
