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
