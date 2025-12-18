# Domain SME Request 426e3ec7c7

너는 “도메인 리드(SME)”다.
임무는 타깃 보스 스킬을 달성하기 위한 **step/micro 스킬을 충분히 촘촘히** 설계하고, **requires(선수)** 관계를 빠짐없이 채우는 것이다.

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

[현재 데이터셋(참고)]
- /mnt/c/Users/irron/Desktop/my/web_service_new/calculate_math/app/data/curriculum_skill.json

[현재 서브그래프(JSON, prereq depth 기반)]
{
  "target": "TS_COMB_PROB",
  "depth": 2,
  "nodes": [
    {
      "id": "ADD_SUB_MULTI",
      "label": "여러 자리 수 덧셈·뺄셈",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "NUM_PLACEVALUE"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "COMB_BASIC",
      "label": "조합 C(n, r)의 뜻과 계산",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "PERM_BASIC",
          "INT_RATIONAL_OP"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "COUNT_MIXED_APPLIED",
      "label": "합·곱·순열·조합을 섞은 경우의 수",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "COUNT_RULE_ADD",
          "COUNT_RULE_MULT",
          "PERM_BASIC",
          "COMB_BASIC"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "COUNT_RULE_ADD",
      "label": "합의 법칙(겹치지 않는 사건)",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "TREE_TABLE_OUTCOMES",
          "INT_RATIONAL_OP"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "COUNT_RULE_MULT",
      "label": "곱의 법칙(순차 선택)",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "TREE_TABLE_OUTCOMES",
          "INT_RATIONAL_OP"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "FACTORIAL_NOTATION",
      "label": "계승 n!의 의미",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "MULT_DIV_BASIC"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "FRAC_BASIC",
      "label": "분수의 뜻과 등분할",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "MULT_DIV_BASIC"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "FRAC_DEC_OP",
      "label": "분수·소수의 사칙연산",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "FRAC_DEC_REL"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "FRAC_DEC_REL",
      "label": "분수와 소수의 관계",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "FRAC_BASIC"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "INT_RATIONAL_OP",
      "label": "정수·유리수의 사칙연산",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "FRAC_DEC_OP"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "LIST_OUTCOMES_SMALL",
      "label": "작은 표본공간 나열하기",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "SET_BASIC_EVENTS",
          "NUM_PLACEVALUE"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "MULT_DIV_BASIC",
      "label": "곱셈·나눗셈 기초(구구단)",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "ADD_SUB_MULTI"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "NUM_PLACEVALUE",
      "label": "자리값·수의 분해/합성",
      "tier": 1,
      "kind": "core",
      "requires": null,
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "PERM_BASIC",
      "label": "순열 P(n, r)의 뜻과 계산",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "FACTORIAL_NOTATION",
          "COUNT_RULE_MULT"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "PROB_BASIC_EQUALLYLIKELY",
      "label": "동일한 가능성에서의 확률 p = 유리수/전체",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "LIST_OUTCOMES_SMALL",
          "INT_RATIONAL_OP"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "PROB_BAYES_INTRO",
      "label": "간단한 베이즈 정리 예시",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "PROB_COND_BASIC"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "PROB_COND_BASIC",
      "label": "조건부확률 P(A|B) 기초",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "PROB_EVENT_OPERATIONS",
          "COUNT_MIXED_APPLIED"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "PROB_EVENT_OPERATIONS",
      "label": "여러 사건의 합·곱·여사건",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "PROB_BASIC_EQUALLYLIKELY"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "SET_BASIC_EVENTS",
      "label": "사건과 표본공간(집합 언어)",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "NUM_PLACEVALUE"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "TREE_TABLE_OUTCOMES",
      "label": "나무·표를 이용한 경우 나열",
      "tier": 1,
      "kind": "core",
      "requires": {
        "all_of": [
          "LIST_OUTCOMES_SMALL"
        ],
        "any_of": [],
        "min_level": null
      },
      "boss": null,
      "xp_per_try": 1,
      "xp_per_correct": 2,
      "xp_to_level": [
        0,
        10,
        30,
        60
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    },
    {
      "id": "TS_COMB_PROB",
      "label": "보스 스킬: 경우의 수·확률 마스터",
      "tier": 1,
      "kind": "boss",
      "requires": null,
      "boss": null,
      "xp_per_try": 0,
      "xp_per_correct": 0,
      "xp_to_level": [
        0
      ],
      "lens": [
        "general"
      ],
      "keywords": [],
      "micro_skills": [],
      "misconceptions": [],
      "lrc_min": null,
      "description": ""
    }
  ],
  "edges": [
    {
      "from": "NUM_PLACEVALUE",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "NUM_PLACEVALUE",
      "to": "ADD_SUB_MULTI",
      "type": "requires",
      "lens": null
    },
    {
      "from": "ADD_SUB_MULTI",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "ADD_SUB_MULTI",
      "to": "MULT_DIV_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "MULT_DIV_BASIC",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "MULT_DIV_BASIC",
      "to": "FRAC_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FRAC_BASIC",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FRAC_BASIC",
      "to": "FRAC_DEC_REL",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FRAC_DEC_REL",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FRAC_DEC_REL",
      "to": "FRAC_DEC_OP",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FRAC_DEC_OP",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FRAC_DEC_OP",
      "to": "INT_RATIONAL_OP",
      "type": "requires",
      "lens": null
    },
    {
      "from": "INT_RATIONAL_OP",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "NUM_PLACEVALUE",
      "to": "SET_BASIC_EVENTS",
      "type": "requires",
      "lens": null
    },
    {
      "from": "SET_BASIC_EVENTS",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "SET_BASIC_EVENTS",
      "to": "LIST_OUTCOMES_SMALL",
      "type": "requires",
      "lens": null
    },
    {
      "from": "NUM_PLACEVALUE",
      "to": "LIST_OUTCOMES_SMALL",
      "type": "requires",
      "lens": null
    },
    {
      "from": "LIST_OUTCOMES_SMALL",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "LIST_OUTCOMES_SMALL",
      "to": "TREE_TABLE_OUTCOMES",
      "type": "requires",
      "lens": null
    },
    {
      "from": "TREE_TABLE_OUTCOMES",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "TREE_TABLE_OUTCOMES",
      "to": "COUNT_RULE_ADD",
      "type": "requires",
      "lens": null
    },
    {
      "from": "INT_RATIONAL_OP",
      "to": "COUNT_RULE_ADD",
      "type": "requires",
      "lens": null
    },
    {
      "from": "COUNT_RULE_ADD",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "TREE_TABLE_OUTCOMES",
      "to": "COUNT_RULE_MULT",
      "type": "requires",
      "lens": null
    },
    {
      "from": "INT_RATIONAL_OP",
      "to": "COUNT_RULE_MULT",
      "type": "requires",
      "lens": null
    },
    {
      "from": "COUNT_RULE_MULT",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "MULT_DIV_BASIC",
      "to": "FACTORIAL_NOTATION",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FACTORIAL_NOTATION",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FACTORIAL_NOTATION",
      "to": "PERM_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "COUNT_RULE_MULT",
      "to": "PERM_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PERM_BASIC",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PERM_BASIC",
      "to": "COMB_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "INT_RATIONAL_OP",
      "to": "COMB_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "COMB_BASIC",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "COUNT_RULE_ADD",
      "to": "COUNT_MIXED_APPLIED",
      "type": "requires",
      "lens": null
    },
    {
      "from": "COUNT_RULE_MULT",
      "to": "COUNT_MIXED_APPLIED",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PERM_BASIC",
      "to": "COUNT_MIXED_APPLIED",
      "type": "requires",
      "lens": null
    },
    {
      "from": "COMB_BASIC",
      "to": "COUNT_MIXED_APPLIED",
      "type": "requires",
      "lens": null
    },
    {
      "from": "COUNT_MIXED_APPLIED",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "LIST_OUTCOMES_SMALL",
      "to": "PROB_BASIC_EQUALLYLIKELY",
      "type": "requires",
      "lens": null
    },
    {
      "from": "INT_RATIONAL_OP",
      "to": "PROB_BASIC_EQUALLYLIKELY",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PROB_BASIC_EQUALLYLIKELY",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PROB_BASIC_EQUALLYLIKELY",
      "to": "PROB_EVENT_OPERATIONS",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PROB_EVENT_OPERATIONS",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PROB_EVENT_OPERATIONS",
      "to": "PROB_COND_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "COUNT_MIXED_APPLIED",
      "to": "PROB_COND_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PROB_COND_BASIC",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PROB_COND_BASIC",
      "to": "PROB_BAYES_INTRO",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PROB_BAYES_INTRO",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "COUNT_MIXED_APPLIED",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PROB_EVENT_OPERATIONS",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PROB_COND_BASIC",
      "to": "TS_COMB_PROB",
      "type": "requires",
      "lens": null
    },
    {
      "from": "NUM_PLACEVALUE",
      "to": "ADD_SUB_MULTI",
      "type": "requires",
      "lens": null
    },
    {
      "from": "ADD_SUB_MULTI",
      "to": "MULT_DIV_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "MULT_DIV_BASIC",
      "to": "FRAC_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FRAC_BASIC",
      "to": "FRAC_DEC_REL",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FRAC_DEC_REL",
      "to": "FRAC_DEC_OP",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FRAC_DEC_OP",
      "to": "INT_RATIONAL_OP",
      "type": "requires",
      "lens": null
    },
    {
      "from": "INT_RATIONAL_OP",
      "to": "PROB_BASIC_EQUALLYLIKELY",
      "type": "requires",
      "lens": null
    },
    {
      "from": "PROB_BASIC_EQUALLYLIKELY",
      "to": "PROB_EVENT_OPERATIONS",
      "type": "requires",
      "lens": null
    },
    {
      "from": "MULT_DIV_BASIC",
      "to": "FACTORIAL_NOTATION",
      "type": "requires",
      "lens": null
    },
    {
      "from": "FACTORIAL_NOTATION",
      "to": "COMB_BASIC",
      "type": "requires",
      "lens": null
    },
    {
      "from": "INT_RATIONAL_OP",
      "to": "COMB_BASIC",
      "type": "requires",
      "lens": null
    }
  ]
}

[이미 존재하는 노드 IDs(참고)]
ADD_SUB_MULTI, COMB_BASIC, COUNT_MIXED_APPLIED, COUNT_RULE_ADD, COUNT_RULE_MULT, FACTORIAL_NOTATION, FRAC_BASIC, FRAC_DEC_OP, FRAC_DEC_REL, INT_RATIONAL_OP, LIST_OUTCOMES_SMALL, MULT_DIV_BASIC, NUM_PLACEVALUE, PERM_BASIC, PROB_BASIC_EQUALLYLIKELY, PROB_BAYES_INTRO, PROB_COND_BASIC, PROB_EVENT_OPERATIONS, SET_BASIC_EVENTS, TREE_TABLE_OUTCOMES, TS_COMB_PROB

[규칙]
- micro는 단일 행동 + 단일 개념 + 단일 표현(C/P/A) 을 반드시 만족한다.
- 잠금/해제는 requires만 사용한다.
- level은 쓰지 말 것(자동 계산).
- “이해한다/안다” 같은 모호한 동사 금지. 관찰 가능한 행동으로 서술한다.

[출력]
- 아래 마커 블록 안에는 **반드시 JSON 오브젝트 1개만** 출력한다(코드펜스/설명 금지).
- JSON 스키마(예시):

  {
    "boss_id": "TS_COMB_PROB",
    "step_nodes": [{"...": "..."}],
    "micro_nodes": [{"...": "..."}],
    "requires_edges": [{"...": "..."}],
    "suspected_long_edges": [{"from":"...","to":"...","reason":"..."}],
    "notes": ["..."]
  }

[노드 포맷(권장)]
- step 노드: `node_type=\"step\"`, `kind=\"core\"`
- micro 노드: `node_type=\"micro\"`, `kind=\"core\"`, `rep=\"C|P|A\"`
- 공통: `id`, `label`, `domain`, `lens`, `description`(= mastery 1문장)
- 필요하면 `requires`를 노드에 인라인으로 넣어도 된다:
  - `requires: {\"all_of\":[...],\"any_of\":[...],\"min_level\": 1}`

[엣지 포맷]
- requires만 작성:
  - `{\"from\":\"PREREQ_ID\",\"to\":\"NODE_ID\",\"type\":\"requires\",\"lens\": null}`
- `min_level`을 별도로 기록하고 싶으면 edge에 `min_level`을 추가해도 된다(선택).

###BEGIN:426e3ec7c7###
(여기에 JSON만)
###DONE:426e3ec7c7###
