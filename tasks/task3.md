아래에 한 번에 3가지를 모두 제공할게.

1. **MVP PRD를 티켓 생성용으로 쪼갠 백로그(에픽→티켓, DoD 포함)**
2. **MVP 코스(덧셈 + 규칙성 도전) 노드/엣지 JSON 샘플**
3. **화면별 상세 스펙(대시보드/지도/문제/평가/리포트)**

---

# 1) MVP 티켓 백로그 (티켓 생성용)

## 1.1 MVP 범위 요약(“완주 가능한 루프” 정의)

* 학생 로그인
* **대시보드**에서 현황/추천 확인
* **지도(그래프)**에서 `CLEARED / AVAILABLE / LOCKED / IN_PROGRESS` 상태 확인
* AVAILABLE 노드 → **문제 폼(주관식)** 입력
* **제출(일괄 채점)** → 평가 페이지
* **클리어**되면 다음 노드 해제 + 추천 이동
* 리포트에서 약점/통계 확인

> MVP에서 핵심은 “노드 상태 계산 + 세션(임시저장) + 일괄 채점 + 다음 노드 해제”가 끊김 없이 돌아가는 것.

---

## 1.2 티켓 작성 규칙(팀 공통)

각 티켓은 아래 4개를 반드시 포함:

* **목표(Why)**
* **작업(What)**
* **DoD(완료 기준: 클릭으로 확인 가능)**
* **의존성(Blocking)**

우선순위:

* **P0**: MVP 완주에 필수
* **P1**: MVP 품질/유지보수에 중요(가능하면 포함)
* **P2**: 후속(게이미피케이션 등)

---

## 1.3 에픽 구성

* **EPIC A**: 프로젝트 기반/데이터 계약
* **EPIC B**: 인증/계정(학생)
* **EPIC C**: 그래프 버전 로딩(published) + 공통 레이아웃
* **EPIC D**: Author Mode(편집/검증/배포)
* **EPIC E**: Student 지도(상태/잠금/도전)
* **EPIC F**: 문제 세션(DRAFT) + 임시저장 + 제출(일괄채점)
* **EPIC G**: 평가(진단) + 다음 스텝 추천
* **EPIC H**: 대시보드
* **EPIC I**: 학습 리포트
* **EPIC J**: 콘텐츠(문제은행/태그) 최소 세팅
* **EPIC K**: QA/테스트/운영 체크

---

## 1.4 티켓 목록

아래 티켓은 PM이 그대로 복붙해 이슈로 만들기 좋게 **ID**를 붙였어.

---

## EPIC A — 기반/데이터 계약 (P0 중심)

### MVP-001 프로젝트 구조 정리(모노레포/FE/BE 분리 규칙)

* **우선순위**: P0 / **담당**: FE+BE
* **작업**: 폴더 구조, 환경변수(.env), 실행 스크립트(dev/prod), 린트/포맷 설정
* **DoD**: 신규 개발자가 README대로 10분 내 FE/BE 모두 실행 가능
* **의존성**: 없음

### MVP-002 데이터 스키마 확정(nodes/edges/problems/sessions)

* **우선순위**: P0 / **담당**: FE+BE+PM
* **작업**: Node/Edge/Problem/AttemptSession 스키마 문서화 + TS 타입 + Pydantic 모델
* **DoD**: 샘플 JSON이 FE/BE 타입 검증 통과
* **의존성**: MVP-001

### MVP-003 그래프 버전 모델 확정(draft/published)

* **우선순위**: P0 / **담당**: BE
* **작업**: `graph_versions`(draft/published) 정책 확정, 최신 published 조회 규칙 확정
* **DoD**: API로 최신 published 그래프를 항상 1개 반환
* **의존성**: MVP-002

### MVP-004 공통 에러/알림(Toast) + 전역 ErrorBoundary

* **우선순위**: P0 / **담당**: FE
* **작업**: API 실패/권한 실패/데이터 오류 시 사용자 메시지 통일
* **DoD**: 주요 실패 케이스에서 “왜 안 되는지” UI로 확인 가능
* **의존성**: MVP-001

---

## EPIC B — 인증/계정(학생) (MVP 필수)

### MVP-010 회원가입/로그인 API(JWT 또는 세션)

* **우선순위**: P0 / **담당**: BE
* **작업**: `/auth/signup`, `/auth/login`, `/auth/me` 구현 + 비밀번호 해시
* **DoD**: Postman으로 가입→로그인→me 호출 성공
* **의존성**: MVP-001

### MVP-011 FE 로그인/회원가입 화면

* **우선순위**: P0 / **담당**: FE
* **작업**: 로그인/회원가입 폼 + 유효성 검사 + 성공 시 라우팅
* **DoD**: 로그인 성공 시 학생 홈(대시보드) 이동, 실패 시 오류 메시지
* **의존성**: MVP-010, MVP-004

### MVP-012 라우트 가드(학생 전용 화면 보호)

* **우선순위**: P0 / **담당**: FE
* **작업**: 비로그인 시 `/dashboard`, `/map`, `/report`, `/learn/*` 접근 차단
* **DoD**: 비로그인 접근 시 로그인 페이지로 리다이렉트
* **의존성**: MVP-011

---

## EPIC C — published 그래프 로딩 + 공통 레이아웃

### MVP-020 최신 Published 그래프 조회 API

* **우선순위**: P0 / **담당**: BE
* **작업**: `GET /student/graph/latest` → nodes+edges 반환
* **DoD**: 그래프 버전 포함해서 응답( graphVersionId, nodes, edges )
* **의존성**: MVP-003

### MVP-021 문제 조회 API(nodeId 기준)

* **우선순위**: P0 / **담당**: BE
* **작업**: `GET /student/node/:nodeId/problems` (정답 제외)
* **DoD**: 정답/해설은 제출 전에는 내려주지 않음
* **의존성**: MVP-002

### MVP-022 공통 레이아웃 + 네비게이션(대시보드/지도/리포트/로그아웃)

* **우선순위**: P0 / **담당**: FE
* **작업**: 상단 탭/메뉴, 로그인 상태 표시, 로그아웃 처리
* **DoD**: 메뉴로 화면 이동 가능 + 로그아웃 시 보호 화면 접근 불가
* **의존성**: MVP-012

---

## EPIC D — Author Mode(편집/검증/배포)

> MVP에서 “내가 커리큘럼을 계속 손보는 모델”이면 Author는 사실상 필수야.
> 최소 기능만 넣고(엣지 편집+검증+Publish), 노드 편집은 나중.

### MVP-030 Author 모드 접근 제어(관리자 계정/권한)

* **우선순위**: P0 / **담당**: BE+FE
* **작업**: admin role, `/author/*` 라우팅 가드
* **DoD**: 학생 계정으로는 Author 진입 불가
* **의존성**: MVP-010, MVP-022

### MVP-031 Author 그래프 뷰(React Flow) 기본 렌더

* **우선순위**: P0 / **담당**: FE
* **작업**: nodes+edges 표시, pan/zoom, 선택 패널
* **DoD**: 150~200 노드 렌더링 가능(성능 문제 없을 수준)
* **의존성**: MVP-020

### MVP-032 엣지 추가/삭제/방향변경 + 엣지 타입 선택(requires/prepares_for/related)

* **우선순위**: P0 / **담당**: FE
* **작업**: 드래그 연결 생성, edgeType 선택 UI, 삭제/flip
* **DoD**: 엣지 편집이 실제로 저장/배포에 반영됨
* **의존성**: MVP-031, MVP-033

### MVP-033 Draft 저장 API

* **우선순위**: P0 / **담당**: BE
* **작업**: `PUT /author/graph/draft` (edges 저장)
* **DoD**: 저장 후 새로고침해도 draft 유지
* **의존성**: MVP-003

### MVP-034 Validation 엔진(사이클/고아/중복/누락)

* **우선순위**: P0 / **담당**: BE(또는 FE)
* **작업**: requires 사이클 탐지, missing node edge 탐지 등
* **DoD**: 일부러 사이클 만들면 검증에 잡힘
* **의존성**: MVP-002

### MVP-035 Validation 리포트 화면 + 클릭 시 그래프 점프

* **우선순위**: P0 / **담당**: FE
* **작업**: 오류 테이블, 클릭→해당 노드 포커스
* **DoD**: 리포트 항목 클릭하면 그래프 중앙에 해당 노드 표시
* **의존성**: MVP-034, MVP-031

### MVP-036 Publish API(스냅샷 생성)

* **우선순위**: P0 / **담당**: BE
* **작업**: `POST /author/graph/publish` → 새 published 생성
* **DoD**: publish 후 학생 모드 최신 그래프가 갱신됨
* **의존성**: MVP-033

### MVP-037 Import/Export(JSON)

* **우선순위**: P1 / **담당**: FE+BE
* **작업**: draft export/download, import/upload (검증 후 적용)
* **DoD**: Export→Import로 동일 그래프 복원
* **의존성**: MVP-033, MVP-034

---

## EPIC E — Student 지도(상태/잠금/도전)

### MVP-040 학생 지도 화면(그래프) 렌더 + 노드 상세 패널

* **우선순위**: P0 / **담당**: FE
* **작업**: 읽기 전용 그래프, 노드 클릭 패널(설명/상태/도전버튼)
* **DoD**: 노드 클릭→정보 표시, 도전 가능 시 버튼 활성
* **의존성**: MVP-020, MVP-022

### MVP-041 노드 상태 모델 정의 + 상태 계산 함수

* **우선순위**: P0 / **담당**: FE+BE
* **작업**: `CLEARED/AVAILABLE/LOCKED/IN_PROGRESS` 계산 규칙 확정
* **DoD**: 동일 입력 데이터에서 FE/BE 계산 결과 일치
* **의존성**: MVP-002, MVP-060(세션/결과 데이터)

### MVP-042 상태 오버레이 UI(색/흐림/배지)

* **우선순위**: P0 / **담당**: FE
* **작업**: 상태별 노드 스타일 (클리어 색/도전 강조/잠김 흐림/진행중 배지)
* **DoD**: 지도만 봐도 진행 상태가 구분됨(범례 포함)
* **의존성**: MVP-040, MVP-041

### MVP-043 LOCKED 클릭 UX(잠김 사유 안내)

* **우선순위**: P0 / **담당**: FE
* **작업**: 잠김 노드 클릭 시 “선행 노드 먼저” 안내(선행 목록 표시)
* **DoD**: 학생이 왜 잠겼는지 이해 가능
* **의존성**: MVP-041

### MVP-044 Focus(집중 보기) 모드

* **우선순위**: P1 / **담당**: FE
* **작업**: 선택 노드 주변(들어오는/나가는 edge)만 보기 토글
* **DoD**: 노드 200개여도 학습이 압도되지 않음
* **의존성**: MVP-040

---

## EPIC F — 문제 세션(DRAFT) + 임시저장 + 제출(일괄 채점)

### MVP-060 AttemptSession 시작 API

* **우선순위**: P0 / **담당**: BE
* **작업**: `POST /student/node/:nodeId/session/start`

  * 이미 DRAFT가 있으면 기존 세션 반환
* **DoD**: 같은 노드 재진입 시 이어풀기 가능
* **의존성**: MVP-010, MVP-002

### MVP-061 문제 풀이 화면(폼형, 주관식 입력)

* **우선순위**: P0 / **담당**: FE
* **작업**: 문제 리스트(고정 order), 입력 필드, 진행 카운트
* **DoD**: 문제 N개 입력 가능 + UI 깨짐 없음
* **의존성**: MVP-021, MVP-060

### MVP-062 답안 임시저장 API(문항 단위 PATCH)

* **우선순위**: P0 / **담당**: BE
* **작업**: `PATCH /student/session/:id/response` (problemId, inputRaw)
* **DoD**: 저장 후 새로고침해도 입력 복원
* **의존성**: MVP-060

### MVP-063 FE 입력 디바운스 자동저장

* **우선순위**: P0 / **담당**: FE
* **작업**: 입력 변경 시 300~800ms 디바운스로 PATCH 호출
* **DoD**: 입력 중 과도한 API 호출 없이 안정 저장
* **의존성**: MVP-061, MVP-062

### MVP-064 제출 버튼 정책(미입력 안내 + 확인 모달)

* **우선순위**: P1 / **담당**: FE
* **작업**: 미입력 문항 리스트 표시, 제출 확인 모달
* **DoD**: 빈칸 제출 실수 감소
* **의존성**: MVP-061

### MVP-065 제출(일괄 채점) API

* **우선순위**: P0 / **담당**: BE
* **작업**: `POST /student/session/:id/submit`

  * normalize + grading + 결과 저장
* **DoD**: 제출하면 SUBMITTED로 바뀌고 결과가 반환됨
* **의존성**: MVP-062, MVP-070(채점 엔진)

### MVP-066 결과 조회 API(새로고침 대비)

* **우선순위**: P0 / **담당**: BE
* **작업**: `GET /student/session/:id/result`
* **DoD**: 평가 페이지 새로고침해도 결과 유지
* **의존성**: MVP-065

### MVP-067 수식 렌더링(KaTeX) 지원

* **우선순위**: P1 / **담당**: FE
* **작업**: problem.promptFormat=latex 지원
* **DoD**: 분수/괄호 등 기본 수식 표시 가능
* **의존성**: MVP-061

---

## EPIC G — 평가(진단) + 다음 스텝 추천/해제

### MVP-070 채점 엔진 v1(numeric_equal + normalize)

* **우선순위**: P0 / **담당**: BE
* **작업**: trim/removeSpaces/removeCommas, 숫자 비교
* **DoD**: 대표 케이스 테스트 통과(“ 1,200 ”=1200)
* **의존성**: MVP-002

### MVP-071 평가 페이지 UI(요약 + 문항별 결과)

* **우선순위**: P0 / **담당**: FE
* **작업**: 점수/정답률, 문항별 정오/정답/내답 표시(제출 후)
* **DoD**: 제출 직후 평가 페이지로 이동하고 정보 표시
* **의존성**: MVP-065

### MVP-072 subskillTag별 성취도 계산(진단)

* **우선순위**: P1 / **담당**: BE(또는 FE)
* **작업**: 태그별 정답률/오답 문항 카운트
* **DoD**: “막힌 지점”이 태그 단위로 보임
* **의존성**: MVP-065, MVP-200(문제 태그)

### MVP-073 클리어 판정 로직(>=80% 등)

* **우선순위**: P0 / **담당**: BE
* **작업**: 제출 결과로 node clear 판정 저장(세션/노드 진행 캐시)
* **DoD**: 클리어면 지도에서 즉시 CLEARED로 보임
* **의존성**: MVP-065, MVP-090(진행 조회)

### MVP-074 다음 노드 추천(필수: requires, 선택: prepares_for)

* **우선순위**: P0 / **담당**: FE+BE
* **작업**: 평가 페이지에서 다음 후보 노드 1~3개 제시
* **DoD**: “다음 단계로 이동” 버튼이 항상 의미 있게 동작
* **의존성**: MVP-020, MVP-073

### MVP-075 재도전 UX(동일 노드 다시 풀기)

* **우선순위**: P0 / **담당**: FE+BE
* **작업**: “재도전” 시 새 세션 생성 또는 기존 세션 reset 정책
* **DoD**: 재도전이 데이터 꼬임 없이 동작
* **의존성**: MVP-060, MVP-065

---

## EPIC H — 대시보드(학습 현황)

### MVP-080 대시보드 페이지 UI(요약/추천/최근 이력)

* **우선순위**: P0 / **담당**: FE
* **작업**: 완료 노드 수, 평균 정답률, 최근 제출, 이어하기, 추천
* **DoD**: 로그인 후 첫 화면으로 제공 가능
* **의존성**: MVP-022, MVP-090

### MVP-081 진행 요약 조회 API(노드 상태/통계)

* **우선순위**: P0 / **담당**: BE
* **작업**: `GET /student/progress/summary`

  * clearedCount, totalCount, avgAccuracy, lastActivities
* **DoD**: 대시보드에 필요한 데이터 1~2번 호출로 제공
* **의존성**: MVP-073, MVP-066

### MVP-082 추천 로직 v1(Available 우선)

* **우선순위**: P0 / **담당**: BE(또는 FE)
* **작업**: AVAILABLE 중 order가 낮은 것 우선 + IN_PROGRESS 우선 처리
* **DoD**: “오늘 할 것”이 매번 비지 않음
* **의존성**: MVP-041, MVP-081

---

## EPIC I — 학습 리포트

### MVP-090 노드별 진행 조회 API

* **우선순위**: P0 / **담당**: BE
* **작업**: `GET /student/progress/nodes` → nodeId별 status/accuracy/lastAttemptAt
* **DoD**: 지도에서 상태 오버레이를 이 데이터로 표시 가능
* **의존성**: MVP-073

### MVP-091 리포트 페이지 v1(영역별/태그별 요약)

* **우선순위**: P1 / **담당**: FE
* **작업**: 영역별 완료율/정답률, 약점 태그 Top N
* **DoD**: 사용자가 “어디가 약한지” 1분 내 파악 가능
* **의존성**: MVP-090, MVP-072

### MVP-092 리포트에서 노드/영역 클릭 시 지도 점프

* **우선순위**: P1 / **담당**: FE
* **작업**: 클릭→`/map?focus=nodeId` 이동 + 하이라이트
* **DoD**: 리포트 → 실행(학습)으로 연결됨
* **의존성**: MVP-040

---

## EPIC J — 콘텐츠(문제은행/태그) 최소 세팅

### MVP-200 MVP 코스 노드/엣지 데이터 입력(덧셈+규칙성 도전)

* **우선순위**: P0 / **담당**: PM+콘텐츠+BE
* **작업**: 아래 2) JSON 샘플 기반으로 실제 데이터 반영
* **DoD**: publish 후 학생이 최소 8~15 노드를 따라 학습 가능
* **의존성**: MVP-036

### MVP-201 노드별 문제 5~10개 제작 + 정답(숫자형) 확정

* **우선순위**: P0 / **담당**: 콘텐츠
* **작업**: nodeId별 problems 세트 구성(고정 order)
* **DoD**: 모든 학습 노드에 문제 세트 존재
* **의존성**: MVP-200

### MVP-202 subskillTag 체계 확정 + 문제에 태그 부여

* **우선순위**: P1 / **담당**: 콘텐츠+PM
* **작업**: carry_tens / carry_hundreds / place_value / pattern_next 등
* **DoD**: 진단(태그별 성취도) 계산 가능
* **의존성**: MVP-201

---

## EPIC K — QA/테스트/운영 체크

### MVP-300 채점 엔진 테스트(유닛 테스트)

* **우선순위**: P0 / **담당**: BE
* **작업**: normalize/숫자 비교 테스트 케이스 20+
* **DoD**: CI에서 자동 테스트 통과
* **의존성**: MVP-070

### MVP-301 상태 계산 테스트(유닛/통합)

* **우선순위**: P0 / **담당**: BE
* **작업**: cleared→available 해제 규칙, locked 사유 리스트 테스트
* **DoD**: 잠금/해제 규칙이 깨지지 않음
* **의존성**: MVP-041, MVP-090

### MVP-302 E2E 시나리오 테스트(로그인→학습→클리어→다음해제)

* **우선순위**: P1 / **담당**: FE+QA
* **작업**: Playwright/Cypress로 1개 코스 완주 자동화
* **DoD**: 배포 전 회귀 테스트 가능
* **의존성**: MVP-071, MVP-073

### MVP-303 로그/모니터링(최소)

* **우선순위**: P1 / **담당**: BE
* **작업**: submit 실패/DB 오류 등 서버 로그 정리
* **DoD**: 장애 시 원인 추적 가능
* **의존성**: MVP-065

---

# 2) MVP 코스(덧셈 + 규칙성 도전) 노드/엣지 JSON 샘플

아래는 “코스 단위”로 붙이기 쉬운 최소 샘플이야.
**의도**:

* Core(핵심 숙달) 트랙으로 덧셈을 단계화
* Challenge(도전/탐구) 트랙으로 규칙성을 연결
* Formal(정식 개념)은 “나중 확장”용으로만 넣어도 됨(잠김 처리 가능)

## 2.1 nodes.json 예시

```json
{
  "schemaVersion": "1.0",
  "courseId": "course-addition-patterns-v1",
  "nodes": [
    {
      "id": "COURSE_ADD_PAT_V1",
      "nodeType": "course",
      "category": "meta",
      "label": "MVP 코스: 덧셈 + 규칙성(도전)",
      "description": "덧셈 핵심 숙달 후, 규칙성 도전(공식 없이)으로 확장",
      "meta": { "domain": "NA", "gradeTags": ["E3", "E4"] },
      "isStart": false,
      "order": 0
    },

    {
      "id": "CORE_PLACE_VALUE_001",
      "nodeType": "skill",
      "category": "core",
      "label": "자리값(백/십/일) 이해",
      "description": "세 자리 수를 자리값으로 분해/구성할 수 있다.",
      "meta": { "domain": "NA", "gradeTags": ["E2", "E3"], "tags": ["place_value"] },
      "isStart": true,
      "order": 10
    },
    {
      "id": "CORE_ADD_NO_CARRY_001",
      "nodeType": "skill",
      "category": "core",
      "label": "받아올림 없는 덧셈(세 자리까지)",
      "description": "받아올림 없이 세 자리 수 덧셈을 정확히 계산한다.",
      "meta": { "domain": "NA", "gradeTags": ["E3"], "tags": ["addition", "no_carry"] },
      "isStart": false,
      "order": 20
    },
    {
      "id": "CORE_ADD_CARRY_TENS_001",
      "nodeType": "skill",
      "category": "core",
      "label": "받아올림(십의 자리) 덧셈",
      "description": "일의 자리에서 받아올림이 발생하는 덧셈을 계산한다.",
      "meta": { "domain": "NA", "gradeTags": ["E3"], "tags": ["addition", "carry_tens"] },
      "isStart": false,
      "order": 30
    },
    {
      "id": "CORE_ADD_CARRY_HUNDREDS_001",
      "nodeType": "skill",
      "category": "core",
      "label": "받아올림(백의 자리) 포함 덧셈",
      "description": "십의 자리에서 받아올림이 발생하는 덧셈을 계산한다.",
      "meta": { "domain": "NA", "gradeTags": ["E3", "E4"], "tags": ["addition", "carry_hundreds"] },
      "isStart": false,
      "order": 40
    },
    {
      "id": "CORE_ADD_WORD_001",
      "nodeType": "skill",
      "category": "core",
      "label": "덧셈 문장제(해석→식→답)",
      "description": "상황을 해석해 덧셈식을 세우고 답을 구한다.",
      "meta": { "domain": "NA", "gradeTags": ["E3", "E4"], "tags": ["word_problem", "addition"] },
      "isStart": false,
      "order": 50
    },
    {
      "id": "CORE_ADD_CHECK_001",
      "nodeType": "skill",
      "category": "core",
      "label": "덧셈 검산/어림으로 확인",
      "description": "어림하거나 다른 방법으로 답이 합리적인지 확인한다.",
      "meta": { "domain": "NA", "gradeTags": ["E3", "E4"], "tags": ["estimate", "check"] },
      "isStart": false,
      "order": 60
    },

    {
      "id": "CHAL_PATTERN_NEXT_001",
      "nodeType": "skill",
      "category": "challenge",
      "label": "도전: 규칙찾기(다음 항)",
      "description": "공식 없이, 주어진 수의 배열에서 규칙을 찾아 다음 항을 예측한다.",
      "meta": { "domain": "NA", "gradeTags": ["E3", "E4"], "tags": ["pattern", "pattern_next"] },
      "isStart": false,
      "order": 110
    },
    {
      "id": "CHAL_PATTERN_MISSING_001",
      "nodeType": "skill",
      "category": "challenge",
      "label": "도전: 빠진 항 찾기",
      "description": "공식 없이 규칙을 이용해 중간에 빠진 값을 찾는다.",
      "meta": { "domain": "NA", "gradeTags": ["E3", "E4"], "tags": ["pattern", "pattern_missing"] },
      "isStart": false,
      "order": 120
    },
    {
      "id": "CHAL_PATTERN_RULE_001",
      "nodeType": "skill",
      "category": "challenge",
      "label": "도전: 규칙을 말/표로 설명하기",
      "description": "‘매번 3씩 증가한다’처럼 규칙을 말/표로 표현한다.",
      "meta": { "domain": "NA", "gradeTags": ["E3", "E4"], "tags": ["pattern", "explain_rule"] },
      "isStart": false,
      "order": 130
    },
    {
      "id": "CHAL_PATTERN_NTH_001",
      "nodeType": "skill",
      "category": "challenge",
      "label": "도전: 멀리 점프(10번째/20번째 항)",
      "description": "하나씩 나열하지 않고, 규칙을 이용해 멀리 있는 항을 구한다(말/표 중심).",
      "meta": { "domain": "NA", "gradeTags": ["E4", "E5"], "tags": ["pattern", "nth_term_intuitive"] },
      "isStart": false,
      "order": 140
    },

    {
      "id": "FORM_ARITH_SEQ_001",
      "nodeType": "skill",
      "category": "formal",
      "label": "정식: 등차수열(개념)",
      "description": "일정한 차이로 증가/감소하는 수열을 등차수열로 이해한다(정식 용어 도입).",
      "meta": { "domain": "AL", "gradeTags": ["M1"], "tags": ["arithmetic_sequence"] },
      "isStart": false,
      "order": 210
    },
    {
      "id": "FORM_ARITH_SEQ_N_001",
      "nodeType": "skill",
      "category": "formal",
      "label": "정식: 등차수열의 n번째 항(일반항)",
      "description": "n번째 항을 식으로 표현한다(변수/기호화 필요).",
      "meta": { "domain": "AL", "gradeTags": ["M1"], "tags": ["arithmetic_sequence", "general_term"] },
      "isStart": false,
      "order": 220
    }
  ]
}
```

## 2.2 edges.json 예시

```json
{
  "schemaVersion": "1.0",
  "edges": [
    { "id": "c1", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "CORE_PLACE_VALUE_001", "note": "" },
    { "id": "c2", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "CORE_ADD_NO_CARRY_001", "note": "" },
    { "id": "c3", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "CORE_ADD_CARRY_TENS_001", "note": "" },
    { "id": "c4", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "CORE_ADD_CARRY_HUNDREDS_001", "note": "" },
    { "id": "c5", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "CORE_ADD_WORD_001", "note": "" },
    { "id": "c6", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "CORE_ADD_CHECK_001", "note": "" },

    { "id": "c7", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "CHAL_PATTERN_NEXT_001", "note": "" },
    { "id": "c8", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "CHAL_PATTERN_MISSING_001", "note": "" },
    { "id": "c9", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "CHAL_PATTERN_RULE_001", "note": "" },
    { "id": "c10", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "CHAL_PATTERN_NTH_001", "note": "" },

    { "id": "c11", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "FORM_ARITH_SEQ_001", "note": "확장(후속)" },
    { "id": "c12", "edgeType": "contains", "source": "COURSE_ADD_PAT_V1", "target": "FORM_ARITH_SEQ_N_001", "note": "확장(후속)" },

    { "id": "r1", "edgeType": "requires", "source": "CORE_PLACE_VALUE_001", "target": "CORE_ADD_NO_CARRY_001", "note": "자리값→덧셈" },
    { "id": "r2", "edgeType": "requires", "source": "CORE_ADD_NO_CARRY_001", "target": "CORE_ADD_CARRY_TENS_001", "note": "" },
    { "id": "r3", "edgeType": "requires", "source": "CORE_ADD_CARRY_TENS_001", "target": "CORE_ADD_CARRY_HUNDREDS_001", "note": "" },
    { "id": "r4", "edgeType": "requires", "source": "CORE_ADD_CARRY_HUNDREDS_001", "target": "CORE_ADD_WORD_001", "note": "" },
    { "id": "r5", "edgeType": "requires", "source": "CORE_ADD_WORD_001", "target": "CORE_ADD_CHECK_001", "note": "문장제→검산/어림" },

    { "id": "p1", "edgeType": "prepares_for", "source": "CORE_ADD_NO_CARRY_001", "target": "CHAL_PATTERN_NEXT_001", "note": "규칙성 도전(가벼운 시작)" },
    { "id": "p2", "edgeType": "prepares_for", "source": "CHAL_PATTERN_NEXT_001", "target": "CHAL_PATTERN_MISSING_001", "note": "" },
    { "id": "p3", "edgeType": "prepares_for", "source": "CHAL_PATTERN_MISSING_001", "target": "CHAL_PATTERN_RULE_001", "note": "" },
    { "id": "p4", "edgeType": "prepares_for", "source": "CHAL_PATTERN_RULE_001", "target": "CHAL_PATTERN_NTH_001", "note": "말/표로 10번째 항까지" },

    { "id": "p5", "edgeType": "prepares_for", "source": "CHAL_PATTERN_NTH_001", "target": "FORM_ARITH_SEQ_001", "note": "정식 등차수열로 연결(후속)" },
    { "id": "r6", "edgeType": "requires", "source": "FORM_ARITH_SEQ_001", "target": "FORM_ARITH_SEQ_N_001", "note": "개념→일반항(후속)" }
  ]
}
```

> **MVP에서 Formal 노드를 당장 노출하지 않으려면**

* FE에서 `category=formal`인 노드는 기본 숨김(설정 토글로만 보기)
* 또는 `isVisibleToStudent=false` 같은 필드를 추가하면 운영이 쉬워.

---

# 3) 화면별 상세 스펙 (대시보드/지도/문제/평가/리포트)

아래는 “개발자가 그대로 구현 가능한 수준”으로 화면 규격을 정의한 스펙이야.
(각 화면: 목적 → 데이터 → UI → 액션 → 상태/에러 → DoD)

---

## 3.1 대시보드 화면 `/dashboard`

### 목적

* 학생이 로그인 후 **내가 지금 어디까지 했고**
* **지금 무엇을 하면 되는지**를 10초 안에 결정하게 한다.

### 필요한 데이터

* `GET /student/progress/summary`

  * `graphVersionId`
  * `totalNodes`
  * `clearedNodes`
  * `inProgressNodes`
  * `avgAccuracy`(없으면 null)
  * `recommendedNodeIds[]` (1~3개)
  * `recentActivities[]` (최근 제출 5개: nodeId, nodeLabel, accuracy, submittedAt)

### UI 구성

1. **상단 요약 카드**

   * “클리어: X / 전체: Y”
   * “평균 정답률: Z%”(가능할 때만)
2. **이어서 하기 카드**

   * 진행 중 노드가 있으면 1순위로 표시(버튼: 이어서)
3. **오늘의 추천(Next)**

   * 추천 노드 1~3개
   * 각 항목에 [바로 도전] 버튼(지도 포커스 or 바로 문제로 이동)
4. **최근 학습 이력**

   * 최근 제출 목록(클릭 시 평가 결과로 이동 or 노드로 이동)

### 액션/동작

* [바로 도전] → `POST session/start` 후 `/learn/:nodeId`
* [지도 보기] → `/map?focus=<recommendedNodeId>` (가능하면)

### 에러/예외

* summary 로딩 실패: “네트워크 오류. 다시 시도”
* 그래프 버전 없음: “배포된 커리큘럼이 없습니다(관리자에게 문의)”

### DoD

* 로그인 후 대시보드에서 **추천 노드**로 바로 진입 가능
* 최근 이력이 실제 제출 결과와 일치

---

## 3.2 지도 화면 `/map`

### 목적

* 학생이 “지식 지도” 위에서
  **CLEARED / AVAILABLE / LOCKED / IN_PROGRESS**를 한눈에 보고,
  AVAILABLE 노드에만 도전할 수 있게 한다.

### 필요한 데이터

* `GET /student/graph/latest` (nodes/edges)
* `GET /student/progress/nodes` (nodeId별 status/accuracy)

### 상태 계산(필수 규칙: MVP 단순형)

* `CLEARED`: 클리어 판정 true
* `IN_PROGRESS`: DRAFT 세션이 존재하거나, SUBMITTED 했지만 기준 미달
* `AVAILABLE`: `isStart=true` OR (어떤 incoming edge( requires 또는 prepares_for )의 source가 CLEARED)
* `LOCKED`: 위 조건을 만족하지 않음

> “Challenge(도전)” 노드는 보통 prepares_for로 연결되므로,
> Core를 클리어하면 Challenge가 자연스럽게 AVAILABLE이 됨.

### UI 구성

* 중앙: React Flow 그래프(읽기 전용)
* 우측 패널: 선택 노드 상세

  * label / description / category 배지(core/challenge/formal)
  * status 표시
  * (가능하면) 내 정답률 표시
  * 버튼:

    * AVAILABLE/IN_PROGRESS: [도전하기] 또는 [이어풀기]
    * LOCKED: 비활성 + “선행 노드” 안내
* 범례(legend):

  * CLEARED / AVAILABLE / IN_PROGRESS / LOCKED 색 설명

### 액션/동작

* 노드 클릭 → 상세 패널 갱신
* [도전하기] → session/start → learn 페이지 이동
* LOCKED 노드 클릭 → “선행 노드 먼저 완료하세요: …” 메시지

### DoD

* 지도만 봐도 진행상태가 명확히 구분
* LOCKED는 실제로 도전 불가(버튼 비활성)
* CLEARED 노드가 생기면 연결된 노드가 AVAILABLE로 즉시 바뀜

---

## 3.3 문제 풀이 화면 `/learn/:nodeId`

### 목적

* 학생이 **주관식으로 문제를 모두 입력한 뒤**
  **제출 버튼으로 일괄 채점**을 수행한다.
* 제출 전에는 정답/정오를 절대 보여주지 않는다.

### 필요한 데이터/API

* `POST /student/node/:nodeId/session/start` → sessionId
* `GET /student/node/:nodeId/problems` → 문제 리스트(정답 제외)
* `PATCH /student/session/:id/response` → 임시저장
* `POST /student/session/:id/submit` → 채점/결과 생성

### UI 구성(폼 방식 권장)

* 상단:

  * 노드명, 카테고리(core/challenge)
  * “입력 완료 x/n”
  * “자동 저장됨” 표시(저장 성공/실패)
* 본문:

  * 문제 카드 리스트(고정 order)
  * 각 카드: prompt(plain/latex) + 입력칸
* 하단:

  * [제출] 버튼
  * [나가기] (지도로 돌아감)
  * (P1) 미입력 문항 안내

### 입력/저장 정책

* 입력마다 300~800ms 디바운스 자동 저장
* 저장 실패 시 “저장 실패(네트워크). 다시 시도” 표시
* 나가기 후 재진입하면 기존 입력 복원(DRAFT)

### 제출 정책

* 제출 클릭 시 확인 모달:

  * “제출하면 채점되고 결과가 기록됩니다”
* 제출 성공 → `/eval/:sessionId`로 이동(또는 동일 라우트 내 평가 섹션 전환)

### DoD

* 제출 전에는 정답/정오 노출 없음
* 새로고침/이탈 후에도 입력이 복원
* 제출하면 평가 화면으로 1회에 이동

---

## 3.4 평가(진단) 화면 `/eval/:sessionId`

### 목적

* 학생이 **무엇을 맞았고 틀렸는지**
* **어디에서 막혔는지(가능하면 태그 기반)**
* 그리고 **다음에 무엇을 해야 하는지**를 바로 알게 한다.

### 필요한 데이터/API

* `GET /student/session/:id/result`

  * overall: correctCount/total/accuracy
  * perProblem: prompt, input, correctAnswer, isCorrect, (optional) explanation, tags
  * nodeResult: cleared boolean
  * nextCandidates: nodeIds[] (requires 기반 + challenge(prepare) 보너스)

### UI 구성

1. 요약 카드

   * 점수/정답률
   * 클리어 여부(축하/재도전 안내)
2. 문항별 결과 리스트

   * 문제 / 내 답 / 정답 / 정오
   * (optional) 해설(explanation)이 있으면 접기/펼치기
3. (P1) 태그별 성취도

   * `carry_tens 100%`, `carry_hundreds 33%` 형태
4. 다음 행동 버튼(CTA)

   * cleared면: [다음 노드 도전하기]
   * 미달이면: [재도전], (선택) [선행 복습 노드로 이동], [관련 도전 노드]

### DoD

* 제출 직후 결과가 정확히 표시
* 클리어 시 지도 상태가 바뀌고 다음 노드가 열림
* 다음 행동 버튼이 실제 학습으로 이어짐

---

## 3.5 리포트 화면 `/report`

### 목적

* 사용자가 “내 약점/강점”을 한눈에 보고
* 다음 학습으로 바로 이동할 수 있게 한다.

### 필요한 데이터

* `GET /student/progress/report`

  * 영역별 통계(domain): 완료율, 평균정답률
  * 태그별 통계: 정답률 낮은 Top N
  * 최근 학습 요약
  * 추천 보완 노드(nodeIds)

### UI 구성

1. 전체 통계 요약
2. 영역별 성취도(표/막대)
3. 약점 태그 Top N
4. 추천 보완 학습(노드 리스트)

   * 클릭 시 `/map?focus=...` 또는 `/learn/...`

### DoD

* 리포트에서 약점 확인 → 클릭 한 번으로 학습 실행 가능

---

# (옵션) 바로 붙일 수 있는 “문제 JSON 샘플” (2문항만 예시)

> 너는 요청을 nodes/edges로만 했지만, 개발팀이 바로 테스트하려면 문제 예시 1~2개가 도움이 돼서 첨부해.

```json
{
  "schemaVersion": "1.0",
  "problems": [
    {
      "problemId": "P_ADD_NO_CARRY_001_01",
      "nodeId": "CORE_ADD_NO_CARRY_001",
      "order": 1,
      "promptFormat": "plain",
      "prompt": "342 + 156 = ?",
      "grading": { "mode": "numeric_equal", "normalize": ["trim", "removeSpaces", "removeCommas"] },
      "answer": { "type": "number", "value": "498", "tolerance": 0 },
      "subskillTags": ["addition", "no_carry"]
    },
    {
      "problemId": "P_PATTERN_NEXT_001_01",
      "nodeId": "CHAL_PATTERN_NEXT_001",
      "order": 1,
      "promptFormat": "plain",
      "prompt": "다음 수를 구하세요: 2, 5, 8, 11, (  )",
      "grading": { "mode": "numeric_equal", "normalize": ["trim", "removeSpaces"] },
      "answer": { "type": "number", "value": "14", "tolerance": 0 },
      "subskillTags": ["pattern", "pattern_next"]
    }
  ]
}
```

---

# 다음 단계 제안(바로 실행 순서)

지금 3개 산출물을 기반으로 “진짜 개발 착수”를 하려면, PM 입장에서는 다음 순서가 가장 안전해.

1. **P0 티켓만** 스프린트 백로그로 먼저 자른다(대략 25~35개)
2. 위 JSON 샘플을 실제 DB/seed에 넣고 **End-to-End(로그인→클리어→다음해제)**를 먼저 성공시킨다
3. 그 다음에 P1(KaTeX, 태그 진단, 리포트 강화)을 붙인다

원하면, 내가 위 티켓 중 **P0만 따로 모아서 “스프린트 1 백로그(순서/의존성 포함)”** 형태로 재정렬해줄게.
