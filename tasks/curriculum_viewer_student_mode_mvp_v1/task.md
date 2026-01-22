---
workflow: code
graph_profile: curriculum_viewer_v1
---

# Curriculum Viewer — Student Mode MVP (수학 문제풀이 앱)

## Goal
학생이 로그인하면 **그래프에서 현재 학습 상태(클리어/도전가능/잠김)를 확인**하고,
도전 가능한 노드에서 **주관식 문제를 모두 푼 뒤 제출(일괄 채점)**하여,
결과(정오/정답/진단)를 보고 **다음 연결 노드로 이동**하는 루프를 완주할 수 있어야 한다.

---

## Current Status
- 로그인/로그아웃 기능 존재 (localStorage 기반)
- `/learn/:nodeId` 학습 페이지 존재 (일괄 제출 방식으로 개선됨)
- 그래프 뷰 존재 (React Flow + dagre)
- 문제 데이터: `curriculum-viewer/public/data/problems_v1.json`
- 채점 로직: `curriculum-viewer/src/lib/learn/grading.ts`

---

## Requirements

### EPIC S-1: 문제 콘텐츠 데이터 모델

#### S-1-1 문제 데이터 스키마 확정 (P0)
- [ ] `Problem` 필드 확정:
  - `problemId`, `nodeId`, `order`, `prompt`, `promptFormat`, `grading`, `answer`, `tags[]`
- [ ] `promptFormat` 지원: `"plain"`, `"latex"` (KaTeX 렌더)
- [ ] `problems_v1.json` 스키마 문서 + 샘플 20문항 준비
- **DoD**: 프론트에서 problems.json을 읽어 렌더/입력/제출까지 가능

#### S-1-2 진단용 태그 체계(subskillTag) 도입 (P0)
- [ ] 각 문제에 최소 1개 이상 태그 부여
- [ ] 예시 태그: `place_value`, `carry_tens`, `carry_hundreds`, `word_problem`, `estimate`
- [ ] 태그 목록 문서 + problems.json에 반영
- **DoD**: 평가 페이지에서 "태그별 정답률" 계산 가능

#### S-1-3 문제 은행 최소 분량 정의 (P0)
- [ ] MVP 대상 노드 수 확정: 8~15개
- [ ] 각 노드별 문제 수: 최소 5문항, 권장 7~10문항
- **DoD**: 최소 1개 코스(덧셈) 완주 가능

---

### EPIC S-2: 문제 화면 UX (일괄 제출 방식)

#### S-2-1 수식/표현 렌더링 지원 (P0)
- [ ] prompt에 LaTeX 포함 시 KaTeX로 렌더링
- [ ] inline/block 수식 모두 지원
- **DoD**: 분수/곱셈/괄호 같은 기본 수식이 깨지지 않고 표시됨

#### S-2-2 "문제 폼" 방식 UI 구현 (P0)
- [ ] 한 노드의 문제를 고정 순서로 리스트 표시
- [ ] 각 문제에 입력칸 제공
- [ ] 상단에 `입력 완료 x/n` 표시
- **DoD**: 문제 10개가 있어도 스크롤/입력 가능

#### S-2-3 임시저장/이어풀기(DRAFT 세션) 구현 (P0)
- [ ] 노드 도전 시작 시 `attempt_session` 생성 (status=DRAFT)
- [ ] 입력 변경 시 디바운스로 `responses` 저장
- [ ] "나가기" 후 재진입 시 이어서 풀기
- **DoD**: 입력하다가 나가도 다시 들어오면 답이 남아있다. 제출 전에는 정오/정답 미노출

#### S-2-4 제출 전 검토 UX (P1)
- [ ] 제출 버튼 클릭 시 미입력 문항 목록 표시
- [ ] "그래도 제출" 또는 "돌아가기" 선택
- **DoD**: 빈칸 제출로 인한 불필요한 오답 감소

---

### EPIC S-3: 일괄 채점 + 평가(진단) 페이지

#### S-3-1 제출(Submit) API 및 서버 채점 (P0)
- [ ] 제출 시 normalize + grading 수행
- [ ] 결과: 문제별 정오 + 정답 + 요약 반환
- **DoD**: 제출 시 즉시 결과 생성, 세션 status=SUBMITTED 변경

#### S-3-2 평가 페이지 UI (P0)
- [ ] 상단 요약: 정답률(맞은/전체/%), 클리어 여부, 다음 행동 버튼
- [ ] 문제별 채점표: 문제, 내 답, 정답, 정오
- **DoD**: 새로고침해도 결과 조회 가능

#### S-3-3 "막힌 지점" 진단(태그별 결과) (P0)
- [ ] `subskillTag`별 정답률 계산
- [ ] "강점/약점" 섹션으로 표현
- **DoD**: 예: `carry_hundreds 33%` 같은 결과 표시

#### S-3-4 다음 노드 추천/강조 (P0)
- [ ] 통과(CLEARED) 시 다음 노드(AVAILABLE 후보) 제공
- [ ] 미통과 시 "재도전"과 "관련 보조 노드" 제안
- **DoD**: 평가에서 "다음으로 이동"이 자연스럽게 가능

---

### EPIC S-4: 진행 상태 계산 (클리어/도전가능/잠김)

#### S-4-1 상태 계산 엔진 (P0)
- [ ] node 상태 계산:
  - CLEARED: SUBMITTED 결과가 기준 충족
  - IN_PROGRESS: DRAFT 존재 or SUBMITTED 했지만 기준 미달
  - AVAILABLE: CLEARED 노드에서 prereq로 연결된 노드
  - LOCKED: 그 외
- [ ] "Start Node" 정책: prereq incoming이 없는 노드 or Author 지정
- **DoD**: 로그인 시 상태가 한 번에 계산되어 그래프에 반영됨

#### S-4-2 잠김 노드 UX (P0)
- [ ] LOCKED 노드는 흐림 처리
- [ ] 클릭 시 "선행 노드를 완료하세요: [노드명 목록]" 표시
- **DoD**: 학생이 '왜 안 되는지' 이해 가능

#### S-4-3 클리어 기준 설정 가능 (P1)
- [ ] 기본값: 정답률 >= 80% (문항 최소 5개)
- [ ] 설정으로 변경 가능
- **DoD**: 기준 변경 시 클리어 판정에 반영됨

---

### EPIC S-5: 로그인/계정/데이터 저장

#### S-5-1 로그인/세션 유지 (P0)
- [ ] 로그인 후 토큰/세션 유지
- [ ] 사용자별 진행 데이터 분리
- **DoD**: 다른 계정으로 로그인하면 진행상태가 달라야 함

#### S-5-2 graphVersion 정책 적용 (P0)
- [ ] Student는 최신 Published graphVersion 로드
- [ ] attempts/session/결과는 graphVersionId로 구분 저장
- **DoD**: Publish로 그래프 변경 시 이전 기록이 섞이지 않음

#### S-5-3 "내 진행 요약" 위젯 (P1)
- [ ] 그래프 화면 상단: 전체 클리어 수/전체 노드 수, 전체 정답률(선택)
- **DoD**: 학생이 현재 상태를 한눈에 이해

---

### EPIC S-6: 품질 보장 (QA/테스트)

#### S-6-1 채점 유닛 테스트 (P0)
- [ ] normalize 테스트: 공백/쉼표/전각 숫자 등
- [ ] numeric_equal 판정 테스트
- **DoD**: 대표 케이스 20개 이상 자동 테스트 통과

#### S-6-2 상태 계산 테스트 (P0)
- [ ] CLEARED에 따른 AVAILABLE 해제 규칙 테스트
- [ ] LOCKED 메시지 대상 노드 목록 테스트
- **DoD**: 그래프 잠금/해제 로직이 케이스별로 검증됨

#### S-6-3 E2E 시나리오 테스트 (P1)
- [ ] 로그인 -> 도전 가능 노드 -> 문제 입력 -> 제출 -> 평가 -> 다음 노드 해제
- **DoD**: 최소 1개 코스 흐름이 자동 테스트로 통과

---

## Out of Scope
- 문제 타입 확장 (서술형/객관식 등)
- Author Mode (그래프 편집 기능)
- 서버 기반 사용자 관리/권한 (진짜 보안)
- AI 기반 진단/추천 (태그 기반 진단으로 대체)
- 대규모 문제 은행 구축/품질 관리

---

## Implementation Notes
- 수정 중심 파일:
  - `curriculum-viewer/src/pages/LearnPage.tsx`
  - `curriculum-viewer/src/lib/learn/grading.ts`
  - `curriculum-viewer/src/lib/curriculum/` (상태 계산 엔진)
  - `curriculum-viewer/public/data/problems_v1.json`
- 기존 localStorage 저장 구조 활용하되, graphVersion 구분 추가
- KaTeX 라이브러리 추가 (`npm install katex`)

---

## Verification (최종 인수 기준)
- [ ] 로그인 -> 그래프 로드 -> 이전 클리어 노드가 클리어 색으로 보임
- [ ] 클리어와 연결된 노드는 도전 가능 버튼 활성
- [ ] 연결되지 않은 노드는 흐림/비활성 + 이유 안내
- [ ] 노드 도전 -> 문제를 모두 입력 (정오 표시 없음)
- [ ] 제출 -> 일괄 채점 -> 평가 페이지에서 정오/정답/요약 확인
- [ ] 기준 충족 시 해당 노드 CLEARED로 변경
- [ ] 다음 연결 노드가 AVAILABLE로 해제되고 "도전하기" 활성
- [ ] 새로고침/재로그인해도 진행이 유지됨
- [ ] prompt에 수식이 있어도 깨지지 않음 (KaTeX 동작)
- [ ] `npm test`, `npm run build` 통과
