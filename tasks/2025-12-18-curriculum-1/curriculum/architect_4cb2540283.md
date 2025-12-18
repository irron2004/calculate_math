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
