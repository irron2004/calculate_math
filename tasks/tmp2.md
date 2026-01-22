아래는 **“MVP PRD를 티켓 생성용으로 쪼갠 백로그(에픽→티켓)”**와, 바로 Import해서 쓸 수 있는 **“MVP 코스(덧셈 + 규칙성 도전) 노드/엣지 JSON 샘플”**이야.
(지금 repo에 이미 일부 기능이 있더라도, PM이 이 백로그를 기준으로 **Done/Skip/Modify** 표시하면서 정리하면 “꼬임”이 확 줄어들어.)

---

# A) MVP 티켓 생성용 백로그

## 공통 규칙(모든 티켓에 적용)

* **DoD(완료 조건)**는 “개발자가 구현 후 PM/QA가 클릭으로 확인 가능한 상태”로 작성
* “잠금 해제”는 **`edgeType=requires`만** 사용
* `edgeType=prepares_for`는 **추천/확장(창의 도전) 연결**로만 사용(진도 잠금 금지 권장)
* Challenge 노드는 기본적으로 **필수 통과 조건이 아님**(좌절/정체 방지)

---

## EPIC 0. 데이터 계약/아키텍처 고정

### 목표

그래프/문제/진행 데이터가 **일관된 스키마**로 돌아가고, 향후 DB 전환에도 유지되는 구조 확립

### 출구 조건(Exit)

* `graph.json`, `problems.json`, `sessions/progress`가 스키마로 검증됨
* FE에서 스키마 깨짐을 사용자에게 안내(오류 메시지)

---

### MVP-001 [P0] 데이터 스키마 v1 확정 + 런타임 검증

* **Owner**: FE
* **설명**: Node/Edge/GraphVersion/Problem/Session 스키마를 고정하고 런타임에서 검증
* **작업**

  * TS 타입 정의 + zod(또는 유사) 런타임 검증
  * `nodeCategory(core/challenge/formal)` 및 `edgeType(requires/prepares_for/related/contains)` 포함
* **DoD**

  * 잘못된 JSON Import 시 “왜 실패했는지” 메시지가 뜸
  * 정상 JSON은 무조건 렌더링 됨
* **의존성**: 없음

### MVP-002 [P0] 저장소(Repository) 레이어 추가

* **Owner**: FE
* **설명**: 그래프/문제/세션 저장을 “로컬/서버”로 쉽게 교체하도록 인터페이스 분리
* **작업**

  * `GraphRepository`, `ProblemRepository`, `SessionRepository` 인터페이스 정의
  * 기본 구현은 LocalStorage 기반(추후 API 구현 교체)
* **DoD**

  * UI 컴포넌트는 LocalStorage 직접 접근 없이 repository만 사용
* **의존성**: MVP-001

### MVP-003 [P0] 환경설정(Config) 및 정책값 중앙화

* **Owner**: FE
* **설명**: 클리어 기준/잠금 정책 등 핵심 정책을 한 곳에서 관리
* **작업**

  * `CLEAR_THRESHOLD`(예: 0.8), `UNLOCK_MODE(simple|strict)` 같은 설정값 정의
* **DoD**

  * 설정값 변경 시 클리어/잠금 로직에 반영됨
* **의존성**: MVP-001

### MVP-004 [P0] MVP 샘플 그래프/문제 데이터 시드 구성

* **Owner**: Content + FE
* **설명**: “덧셈+규칙성 도전” 코스 그래프와 문제은행을 최소 분량으로 제공
* **작업**

  * 그래프 JSON(아래 샘플 기반) + 각 노드당 문제 5개 이상
* **DoD**

  * 설치 후 바로 end-to-end(지도→풀이→채점→진행) 가능
* **의존성**: MVP-001

### MVP-005 [P1] 백엔드 저장 모드(선택) 플러그인 포인트 마련

* **Owner**: BE + FE
* **설명**: MVP는 로컬 저장으로도 가능하지만, 서비스 운영을 위해 API 저장 모드로 확장 가능하게 준비
* **DoD**

  * `SessionRepository` 구현체를 API로 바꿔도 UI 코드 변경이 최소화됨
* **의존성**: MVP-002

---

## EPIC 1. Author Mode(관리자 모드): 그래프 편집/검증/배포

### 목표

관리자가 **연결(requires/prepares_for)을 직접 만들고**, 오류를 검증하고, 학생에게 **Published 버전**을 배포

### 출구 조건(Exit)

* Draft 편집 → Validation → Publish → Student에서 Published 사용

---

### MVP-006 [P0] Author 접근 제어(간단 인증) + 모드 전환

* **Owner**: FE
* **DoD**

  * `/author/*`는 인증 없으면 접근 불가
  * 로그아웃/전환 동작 확인

### MVP-007 [P0] Author 그래프 편집: 엣지 추가/삭제/방향 변경

* **Owner**: FE
* **작업**

  * React Flow onConnect로 엣지 생성
  * 엣지 클릭 → 삭제/flip
* **DoD**

  * 엣지를 추가/삭제/반전하고 저장하면 새로고침 후 유지

### MVP-008 [P0] 엣지 타입 선택 UI(requires/prepares_for/related)

* **Owner**: FE
* **DoD**

  * 생성 시 타입 선택 가능(기본 requires)
  * 타입에 따라 선 스타일/범례가 구분됨

### MVP-009 [P0] 노드 메타 편집(core/challenge/formal, start 플래그)

* **Owner**: FE
* **설명**: 노드가 “학습 해제/추천/형식화” 중 어떤 역할인지 정의
* **DoD**

  * 노드 상세 패널에서 `nodeCategory`, `start` 수정 가능 + 저장 유지

### MVP-010 [P0] Validation v1: requires 사이클/고아/중복/누락 탐지

* **Owner**: FE
* **DoD**

  * requires에 사이클이 생기면 오류로 잡힘
  * nodeId 없는 edge 등 불량 데이터 탐지

### MVP-011 [P0] Validation 리포트 UI + 클릭 시 포커스 점프

* **Owner**: FE
* **DoD**

  * 리포트 항목 클릭 → 그래프가 해당 노드로 센터링 + 강조

### MVP-012 [P0] Draft 저장/자동저장 + “저장 안 됨(dirty)” 표시

* **Owner**: FE
* **DoD**

  * 편집 후 dirty 표시가 뜨고, 저장 후 해제됨

### MVP-013 [P0] Import/Export(JSON) (Draft)

* **Owner**: FE
* **DoD**

  * Export → Import 하면 동일 그래프 복원
  * 스키마 오류면 Import 차단 + 이유 표시

### MVP-014 [P0] Publish(스냅샷) + Published Preview

* **Owner**: FE
* **DoD**

  * Draft 수정해도 Published는 유지
  * Publish 후 학생 화면이 새 버전을 사용

---

## EPIC 2. Student 인증/네비게이션/기본 프레임

### 목표

학생이 로그인하면 대시보드/지도/리포트를 안정적으로 이용

### 출구 조건(Exit)

* 로그인 → 대시보드 → 지도 → 학습 → 평가 → 다음 노드

---

### MVP-015 [P0] 학생 로그인/회원가입 + 세션 유지

* **Owner**: FE
* **DoD**

  * 새로고침 후에도 로그인 유지
  * 로그아웃 시 개인 진행 데이터 표시가 사라짐(계정 분리)

### MVP-016 [P0] 학생 네비게이션: 대시보드/지도/리포트

* **Owner**: FE
* **DoD**

  * 메뉴에서 3개 화면 이동 가능
  * 비로그인 시 로그인 페이지로 리다이렉트

### MVP-017 [P1] 사용자 설정: 진행 초기화/데이터 초기화

* **Owner**: FE
* **DoD**

  * “내 진행 초기화” 수행 시 노드 상태/기록이 초기화됨(확인 모달 포함)

### MVP-018 [P1] 공통 UX: 로딩/오류/빈 상태(Empty State)

* **Owner**: FE
* **DoD**

  * 데이터 없을 때 “무엇을 해야 하는지” 안내가 뜸(예: “첫 노드를 시작하세요”)

---

## EPIC 3. 진행 엔진(잠금/해제) + 지도 상태 표시

### 목표

그래프/트리에서 **클리어/도전 가능/잠김/진행 중**이 한눈에 보이고, 규칙대로 잠금 해제가 됨

### 출구 조건(Exit)

* 클리어하면 requires 타겟이 AVAILABLE로 바뀐다

---

### MVP-019 [P0] 노드 상태 모델 정의 + 계산 로직 뼈대

* **Owner**: FE
* **DoD**

  * 상태 4종: `LOCKED/AVAILABLE/IN_PROGRESS/CLEARED`
  * 상태를 반환하는 `computeNodeStatus()` 유틸 존재

### MVP-020 [P0] 잠금/해제 규칙 구현(기본 simple)

* **Owner**: FE
* **규칙**

  * start 노드 → AVAILABLE
  * CLEARED에서 나가는 `requires` 타겟 → AVAILABLE
  * 그 외 → LOCKED
* **DoD**

  * 샘플 그래프에서 실제로 잠금/해제가 원하는 대로 동작

### MVP-021 [P0] 클리어 판정(제출 결과 기반)

* **Owner**: FE
* **기본**

  * 정답률 ≥ 0.8 → CLEARED
* **DoD**

  * 제출 후 점수에 따라 상태가 바뀜

### MVP-022 [P0] 지도(그래프/트리) 상태 시각화 + 범례

* **Owner**: FE
* **DoD**

  * CLEARED/AVAILABLE/LOCKED/IN_PROGRESS가 색/아이콘으로 구분됨
  * LOCKED는 흐림 처리(비활성 느낌)

### MVP-023 [P0] 노드 상세 패널: 상태/선행 이유/CTA

* **Owner**: FE
* **DoD**

  * LOCKED면 “필요 선행 노드” 목록이 보임
  * AVAILABLE면 “도전하기” 버튼 활성

### MVP-024 [P0] 점프/포커스: 대시보드/리포트→지도 노드 센터링

* **Owner**: FE
* **DoD**

  * URL 파라미터 또는 상태로 `focusNodeId` 전달 시 센터링+강조

### MVP-025 [P1] 다음 추천 노드 규칙(단순)

* **Owner**: FE
* **DoD**

  * 평가 후 “다음 노드”가 1~3개 추천되고 지도에서 강조

---

## EPIC 4. 문제 풀이(주관식 폼) + 세션(DRAFT) + 일괄 제출 채점

### 목표

노드를 선택하면 문제를 풀고, **모두 입력 후 제출**하면 채점/진단으로 연결

### 출구 조건(Exit)

* 제출→평가 페이지에서 결과 확인 + 진행 상태 갱신

---

### MVP-026 [P0] 노드별 문제 로딩(Repository 기반)

* **Owner**: FE
* **DoD**

  * nodeId로 문제 리스트를 가져와 고정 순서로 표시

### MVP-027 [P0] 풀이 세션(DRAFT) 생성/재개

* **Owner**: FE (+BE 선택)
* **DoD**

  * 노드 진입 시 DRAFT 세션 생성
  * 중간에 나갔다가 다시 들어오면 입력이 복원됨

### MVP-028 [P0] 문제 풀이 화면(폼) UI

* **Owner**: FE
* **DoD**

  * 문제 리스트 + 입력칸 + 진행률(x/n) 표시
  * 제출 전에는 정답/정오 노출 없음

### MVP-029 [P0] 제출 UX: 확인 모달 + 미입력 안내

* **Owner**: FE
* **DoD**

  * 제출 클릭 시 “제출 후 채점됩니다” 확인
  * 미입력 문항이 있으면 목록 표시(그래도 제출 가능 정책은 선택)

### MVP-030 [P0] 채점 엔진 v1: numeric_equal + normalize

* **Owner**: FE
* **DoD**

  * 공백/쉼표 제거 등 정규화 후 숫자 비교 정확히 동작

### MVP-031 [P0] 제출 파이프라인: 일괄 채점 + 결과 저장(SUBMITTED)

* **Owner**: FE (+BE 선택)
* **DoD**

  * 제출하면 세션이 SUBMITTED로 변경되고 결과가 저장
  * 제출 후 답안 수정 불가(결과 고정)

### MVP-032 [P0] 평가 페이지 UI: 요약 + 문항별 리뷰

* **Owner**: FE
* **DoD**

  * 점수/정답률, 문항별(문제/내답/정답/정오) 표시

### MVP-033 [P1] 진단(약점): subskillTag별 정답률

* **Owner**: FE
* **DoD**

  * 태그별 정답률이 계산되어 “막힌 부분”으로 표시됨

### MVP-034 [P0] 평가 후 액션: 재도전/다음 노드 이동/지도 복귀

* **Owner**: FE
* **DoD**

  * 버튼 3개가 동작: 다시 풀기 / 다음 노드 / 지도 보기

---

## EPIC 5. 대시보드/리포트(학습 현황)

### 목표

학생이 “내가 어디까지 했는지”를 한눈에 보고 다음 행동을 선택

### 출구 조건(Exit)

* 대시보드에서 “이어하기/추천/전체 진행률”이 정상 표시

---

### MVP-035 [P0] 대시보드 화면 UI(초안)

* **Owner**: FE
* **DoD**

  * 전체 진행률, 추천, 최근 이력 UI가 보임(데이터는 임시여도 됨)

### MVP-036 [P0] 대시보드 집계 로직(진행률/정답률/최근 이력)

* **Owner**: FE
* **DoD**

  * (클리어 노드 수/전체) 계산
  * 최근 제출 세션 5~10개 표시

### MVP-037 [P0] “이어서 하기” 동작(진행중 세션/최근 노드)

* **Owner**: FE
* **DoD**

  * 진행중(DRAFT) 세션이 있으면 그 노드로 점프
  * 없으면 최근 SUBMITTED 노드로 점프

### MVP-038 [P1] 학습 리포트 페이지(학생용) 구성

* **Owner**: FE
* **DoD**

  * 영역별(메타 domain/tag) 통계, 약점 노드, 추천 목록 표시

### MVP-039 [P1] 리포트→지도/평가 점프

* **Owner**: FE
* **DoD**

  * 약점 노드 클릭 시 지도 포커스
  * 특정 제출 결과 클릭 시 평가 페이지로 이동

### MVP-040 [P1] UX 개선: 홈에서 “오늘 할 것”이 명확한 빈 상태 설계

* **Owner**: FE + Design
* **DoD**

  * 학습 기록이 0일 때도 추천/시작 버튼이 명확히 보임

---

## EPIC 6. 콘텐츠 파이프라인(MVP 코스 문제은행)

### 목표

앱이 “학습 서비스”가 되려면, 최소 코스에 대한 문제/태그가 안정적으로 준비되어야 함

### 출구 조건(Exit)

* 코스 내 모든 노드에 문제 5개 이상, 태그 포함, 검증 통과

---

### MVP-041 [P0] MVP 코스 노드 목록 확정 + 커버리지 체크리스트

* **Owner**: Content + PM
* **DoD**

  * 코스 포함 노드(덧셈 core + 규칙성 challenge) 확정 문서 존재

### MVP-042 [P0] 문제은행 제작: 노드당 5~10문항 + subskillTag 부여

* **Owner**: Content
* **DoD**

  * problems.json에 nodeId 매핑 누락 없음
  * 각 문제에 태그 1개 이상

### MVP-043 [P0] 콘텐츠 검증 스크립트(정합성 검사)

* **Owner**: FE(or BE)
* **DoD**

  * “nodeId 존재/중복 order/정답 타입 오류/태그 누락” 자동 검출 가능

---

## EPIC 7. QA/릴리스(스모크 테스트)

### 목표

MVP 루프가 깨지지 않게 최소 자동/수동 테스트 체크리스트 확보

### 출구 조건(Exit)

* “로그인→지도→풀이→제출→평가→다음 노드 해제”가 항상 통과

---

### MVP-044 [P0] E2E 스모크 시나리오 + 릴리스 체크리스트

* **Owner**: QA + FE
* **DoD**

  * 핵심 루프 1개 코스로 통과하는 테스트(또는 수동 체크리스트) 존재
  * 릴리스 전 점검 항목 문서화

---

---

# B) MVP 코스(덧셈 + 규칙성 도전) 노드/엣지 JSON 샘플

아래 파일을 예를 들어 `mvp_addition_pattern_graph_v1.json`로 저장해서 Import할 수 있게 만든 샘플이야.
(스키마는 **Graph v1** 가정: nodes/edges 배열. `contains`는 “코스 묶음용”이고, 실제 잠금/해제는 `requires`만 사용.)

```json
{
  "schemaVersion": "skill-graph-v1",
  "graphId": "COURSE_ADD_PATTERN_V1",
  "title": "MVP 코스: 덧셈(Core) + 규칙성 도전(Challenge)",
  "nodes": [
    {
      "id": "COURSE_ADD_PATTERN_V1",
      "nodeType": "root",
      "nodeCategory": "core",
      "label": "덧셈 + 규칙성(도전) 코스",
      "text": "덧셈을 숙달하고, 규칙성(패턴) 도전을 통해 미래 개념(등차수열)을 공식 없이 준비합니다.",
      "meta": { "tags": ["course"], "gradeHint": "초3~초4" },
      "start": false,
      "order": 0
    },

    {
      "id": "CORE_PLACE_VALUE_3DIGIT",
      "nodeType": "skill",
      "nodeCategory": "core",
      "label": "자리값(백/십/일) 이해",
      "text": "세 자리 수의 자리값을 이해하고 수를 읽고 쓸 수 있다.",
      "meta": { "domain": "NA", "gradeHint": "초3", "tags": ["place_value", "foundation"] },
      "start": true,
      "order": 10
    },
    {
      "id": "CORE_ADD_NO_CARRY_3DIGIT",
      "nodeType": "skill",
      "nodeCategory": "core",
      "label": "받아올림 없는 세 자리 덧셈",
      "text": "받아올림이 없는 세 자리 수 덧셈을 정확히 계산할 수 있다.",
      "meta": { "domain": "NA", "gradeHint": "초3", "tags": ["addition", "no_carry"] },
      "start": false,
      "order": 20
    },
    {
      "id": "CORE_ADD_CARRY_TENS",
      "nodeType": "skill",
      "nodeCategory": "core",
      "label": "받아올림(십의 자리) 덧셈",
      "text": "십의 자리에서 받아올림이 있는 덧셈을 계산할 수 있다.",
      "meta": { "domain": "NA", "gradeHint": "초3", "tags": ["addition", "carry_tens"] },
      "start": false,
      "order": 30
    },
    {
      "id": "CORE_ADD_CARRY_HUNDREDS",
      "nodeType": "skill",
      "nodeCategory": "core",
      "label": "받아올림(백의 자리) 덧셈",
      "text": "백의 자리에서 받아올림이 있는 덧셈을 계산할 수 있다.",
      "meta": { "domain": "NA", "gradeHint": "초3~초4", "tags": ["addition", "carry_hundreds"] },
      "start": false,
      "order": 40
    },
    {
      "id": "CORE_ADD_THREE_ADDENDS",
      "nodeType": "skill",
      "nodeCategory": "core",
      "label": "세 수의 덧셈",
      "text": "세 수의 덧셈을 순서/묶어 계산하는 전략을 사용해 계산할 수 있다.",
      "meta": { "domain": "NA", "gradeHint": "초3~초4", "tags": ["addition", "strategy"] },
      "start": false,
      "order": 50
    },
    {
      "id": "CORE_ADD_WORD_PROBLEMS",
      "nodeType": "skill",
      "nodeCategory": "core",
      "label": "덧셈 문장제",
      "text": "상황을 해석하여 덧셈식을 세우고 답을 구할 수 있다.",
      "meta": { "domain": "NA", "gradeHint": "초3", "tags": ["word_problem", "modeling"] },
      "start": false,
      "order": 60
    },

    {
      "id": "CHAL_PATTERN_NEXT_TERM_PLUS_K",
      "nodeType": "skill",
      "nodeCategory": "challenge",
      "label": "도전: 다음 항 찾기(+k 규칙)",
      "text": "수의 나열에서 규칙을 찾아 다음 항을 예측한다. (정식 용어/공식 없이)",
      "meta": { "domain": "NA", "gradeHint": "초3~초4", "tags": ["challenge", "pattern", "next_term"] },
      "start": false,
      "order": 110
    },
    {
      "id": "CHAL_PATTERN_MISSING_TERM_PLUS_K",
      "nodeType": "skill",
      "nodeCategory": "challenge",
      "label": "도전: 빠진 항 찾기(+k 규칙)",
      "text": "빠진 항이 있는 수의 나열에서 규칙을 찾아 빈칸을 채운다.",
      "meta": { "domain": "NA", "gradeHint": "초3~초4", "tags": ["challenge", "pattern", "missing_term"] },
      "start": false,
      "order": 120
    },
    {
      "id": "CHAL_PATTERN_DESCRIBE_RULE",
      "nodeType": "skill",
      "nodeCategory": "challenge",
      "label": "도전: 규칙을 말로 설명하기",
      "text": "‘매번 3씩 커진다’처럼 규칙을 말로 설명하고 검증한다.",
      "meta": { "domain": "NA", "gradeHint": "초3~초4", "tags": ["challenge", "pattern", "describe_rule"] },
      "start": false,
      "order": 130
    },
    {
      "id": "CHAL_PATTERN_NTH_TERM_BY_REPEATED_ADD",
      "nodeType": "skill",
      "nodeCategory": "challenge",
      "label": "도전: n번째 항을 반복 덧셈으로 구하기",
      "text": "공식 없이 ‘처음 수에 k를 (n-1)번 더한다’는 생각으로 n번째 항을 구한다.",
      "meta": { "domain": "NA", "gradeHint": "초4~중1(연결)", "tags": ["challenge", "pattern", "nth_term", "prepare_formal"] },
      "start": false,
      "order": 140
    },

    {
      "id": "FORM_ARITH_SEQ_INTRO",
      "nodeType": "skill",
      "nodeCategory": "formal",
      "label": "등차수열(정식 개념) 맛보기",
      "text": "나중에 ‘등차수열’ 용어와 정식 표현(일반항)을 학습할 때 연결되는 노드(지금은 잠금/추천 대상으로만 사용).",
      "meta": { "domain": "ALG", "gradeHint": "중1~중2", "tags": ["formal", "arithmetic_sequence"] },
      "start": false,
      "order": 900
    }
  ],
  "edges": [
    { "id": "c-001", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "CORE_PLACE_VALUE_3DIGIT", "note": "" },
    { "id": "c-002", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "CORE_ADD_NO_CARRY_3DIGIT", "note": "" },
    { "id": "c-003", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "CORE_ADD_CARRY_TENS", "note": "" },
    { "id": "c-004", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "CORE_ADD_CARRY_HUNDREDS", "note": "" },
    { "id": "c-005", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "CORE_ADD_THREE_ADDENDS", "note": "" },
    { "id": "c-006", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "CORE_ADD_WORD_PROBLEMS", "note": "" },
    { "id": "c-007", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "CHAL_PATTERN_NEXT_TERM_PLUS_K", "note": "" },
    { "id": "c-008", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "CHAL_PATTERN_MISSING_TERM_PLUS_K", "note": "" },
    { "id": "c-009", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "CHAL_PATTERN_DESCRIBE_RULE", "note": "" },
    { "id": "c-010", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "CHAL_PATTERN_NTH_TERM_BY_REPEATED_ADD", "note": "" },
    { "id": "c-011", "edgeType": "contains", "source": "COURSE_ADD_PATTERN_V1", "target": "FORM_ARITH_SEQ_INTRO", "note": "" },

    { "id": "r-001", "edgeType": "requires", "source": "CORE_PLACE_VALUE_3DIGIT", "target": "CORE_ADD_NO_CARRY_3DIGIT", "note": "자리값 이해 후 덧셈" },
    { "id": "r-002", "edgeType": "requires", "source": "CORE_ADD_NO_CARRY_3DIGIT", "target": "CORE_ADD_CARRY_TENS", "note": "기본 덧셈 숙달 후 받아올림" },
    { "id": "r-003", "edgeType": "requires", "source": "CORE_ADD_CARRY_TENS", "target": "CORE_ADD_CARRY_HUNDREDS", "note": "받아올림 확장" },
    { "id": "r-004", "edgeType": "requires", "source": "CORE_ADD_CARRY_HUNDREDS", "target": "CORE_ADD_THREE_ADDENDS", "note": "다항 덧셈으로 확장" },
    { "id": "r-005", "edgeType": "requires", "source": "CORE_ADD_THREE_ADDENDS", "target": "CORE_ADD_WORD_PROBLEMS", "note": "전략 적용을 문장제로 확장" },

    { "id": "r-010", "edgeType": "requires", "source": "CORE_ADD_NO_CARRY_3DIGIT", "target": "CHAL_PATTERN_NEXT_TERM_PLUS_K", "note": "기본 덧셈 숙달 후 규칙성 도전" },
    { "id": "r-011", "edgeType": "requires", "source": "CHAL_PATTERN_NEXT_TERM_PLUS_K", "target": "CHAL_PATTERN_MISSING_TERM_PLUS_K", "note": "다음 항 → 빠진 항" },
    { "id": "r-012", "edgeType": "requires", "source": "CHAL_PATTERN_MISSING_TERM_PLUS_K", "target": "CHAL_PATTERN_DESCRIBE_RULE", "note": "규칙을 말로 표현" },
    { "id": "r-013", "edgeType": "requires", "source": "CHAL_PATTERN_DESCRIBE_RULE", "target": "CHAL_PATTERN_NTH_TERM_BY_REPEATED_ADD", "note": "n번째 항 사고로 확장" },

    { "id": "p-001", "edgeType": "prepares_for", "source": "CHAL_PATTERN_DESCRIBE_RULE", "target": "FORM_ARITH_SEQ_INTRO", "note": "정식 용어 학습 전 탐구 경험" },
    { "id": "p-002", "edgeType": "prepares_for", "source": "CHAL_PATTERN_NTH_TERM_BY_REPEATED_ADD", "target": "FORM_ARITH_SEQ_INTRO", "note": "일반항 사고의 말 버전 준비" }
  ]
}
```

### 이 샘플을 MVP에 어떻게 쓰면 좋나(짧게)

* **학생 잠금/해제는 `requires`만** 사용
* Challenge는 `requires`로 “도전 시작 조건”은 걸 수 있지만(예: 기본 덧셈 이후),
  **Challenge 완료가 Core 다음 진도 해제의 필수조건이 되지 않도록** 설계(추천/보너스)
* `FORM_ARITH_SEQ_INTRO`는 MVP에서 “학습용”이 아니라
  “나중에 Formal 개념을 붙일 때 연결되는 목적지 노드”로 두는 샘플이야
  (UI에서 “미래 개념” 배지로 표시해도 좋음)

---

## 다음 단계

원하면 내가 바로 이어서 아래 중 하나도 같이 만들어줄게(추가 질문 없이 가능):

1. 위 그래프의 각 노드에 대해 **문제 5개씩**(총 50~60문항) `problems_v1.json` 샘플

   * `subskillTag`까지 포함해서 평가 페이지에서 약점 분석 가능하게

2. 이 백로그를 **“이미 구현된 기능(현재 repo)” 기준으로 Done/Partial/To-do**로 재정렬한 “실행 백로그”

   * 즉, 네 프로젝트 상황에 맞게 불필요 티켓을 제거하고 우선순위 재배치

원하는 쪽으로 말해줘.
