---
workflow: code
graph_profile: frontend
---

# MVP Author Mode (관리자 모드) 구현

## Goal
관리자가 **그래프 연결(requires/prepares_for)을 직접 편집**하고, 오류를 검증하고, 학생에게 **Published 버전**을 배포할 수 있는 Author Mode를 구현한다.

---

## Current Status
- `curriculum-viewer` 프론트엔드 존재
- 그래프 렌더링 기능 존재 (React Flow)
- 노드 상세 패널 존재
- Author 전용 편집/검증/배포 기능 없음

---

## 핵심 규칙
- **잠금 해제**: `edgeType=requires`만 사용
- **`edgeType=prepares_for`**: 추천/확장(창의 도전) 연결로만 사용 (진도 잠금 금지)
- **Challenge 노드**: 기본적으로 필수 통과 조건이 아님 (좌절/정체 방지)

---

## Requirements

### EPIC 0 — 데이터 계약/아키텍처 고정 (P0)

#### MVP-001 데이터 스키마 v1 확정 + 런타임 검증
- **담당**: FE
- **작업**:
  - TS 타입 정의 + zod 런타임 검증
  - `nodeCategory(core/challenge/formal)` 포함
  - `edgeType(requires/prepares_for/related/contains)` 포함
- **DoD**: 잘못된 JSON Import 시 실패 메시지, 정상 JSON은 렌더링

#### MVP-002 저장소(Repository) 레이어 추가
- **담당**: FE
- **작업**:
  - `GraphRepository`, `ProblemRepository`, `SessionRepository` 인터페이스 정의
  - 기본 구현은 LocalStorage 기반
- **DoD**: UI 컴포넌트는 LocalStorage 직접 접근 없이 repository만 사용

#### MVP-003 환경설정(Config) 및 정책값 중앙화
- **담당**: FE
- **작업**: `CLEAR_THRESHOLD(0.8)`, `UNLOCK_MODE(simple|strict)` 등 설정값 정의
- **DoD**: 설정값 변경 시 클리어/잠금 로직에 반영

#### MVP-004 MVP 샘플 그래프/문제 데이터 시드 구성
- **담당**: Content + FE
- **작업**: "덧셈+규칙성 도전" 코스 그래프 + 각 노드당 문제 5개 이상
- **DoD**: 설치 후 바로 end-to-end 가능

---

### EPIC 1 — Author Mode 핵심 기능 (P0)

#### MVP-006 Author 접근 제어 + 모드 전환
- **담당**: FE
- **작업**: `/author/*` 인증 없으면 접근 불가
- **DoD**: 로그아웃/전환 동작 확인

#### MVP-007 Author 그래프 편집: 엣지 추가/삭제/방향 변경
- **담당**: FE
- **작업**:
  - React Flow onConnect로 엣지 생성
  - 엣지 클릭 → 삭제/flip
- **DoD**: 엣지 추가/삭제/반전하고 저장하면 새로고침 후 유지

#### MVP-008 엣지 타입 선택 UI (requires/prepares_for/related)
- **담당**: FE
- **작업**: 생성 시 타입 선택 (기본 requires)
- **DoD**: 타입에 따라 선 스타일/범례 구분

#### MVP-009 노드 메타 편집 (core/challenge/formal, start 플래그)
- **담당**: FE
- **작업**: 노드가 학습 해제/추천/형식화 중 어떤 역할인지 정의
- **DoD**: 노드 상세 패널에서 `nodeCategory`, `start` 수정 가능 + 저장 유지

---

### EPIC 2 — Validation + 저장/배포 (P0)

#### MVP-010 Validation v1: requires 사이클/고아/중복/누락 탐지
- **담당**: FE
- **작업**:
  - requires에 사이클 탐지
  - nodeId 없는 edge 등 불량 데이터 탐지
- **DoD**: 사이클 생기면 오류로 잡힘

#### MVP-011 Validation 리포트 UI + 클릭 시 포커스 점프
- **담당**: FE
- **DoD**: 리포트 항목 클릭 → 그래프가 해당 노드로 센터링 + 강조

#### MVP-012 Draft 저장/자동저장 + "저장 안 됨(dirty)" 표시
- **담당**: FE
- **DoD**: 편집 후 dirty 표시가 뜨고, 저장 후 해제

#### MVP-013 Import/Export (JSON)
- **담당**: FE
- **DoD**: Export → Import 하면 동일 그래프 복원, 스키마 오류면 차단 + 이유

#### MVP-014 Publish (스냅샷) + Published Preview
- **담당**: FE
- **작업**:
  - Draft 수정해도 Published 유지
  - Publish 후 학생 화면이 새 버전 사용
- **DoD**: publish 후 학생 모드 최신 그래프가 갱신

---

### EPIC 3 — 진행 엔진 (잠금/해제) (P0)

#### MVP-019 노드 상태 모델 정의 + 계산 로직
- **담당**: FE
- **작업**: 상태 4종: `LOCKED/AVAILABLE/IN_PROGRESS/CLEARED`
- **DoD**: `computeNodeStatus()` 유틸 존재

#### MVP-020 잠금/해제 규칙 구현 (기본 simple)
- **담당**: FE
- **규칙**:
  - start 노드 → AVAILABLE
  - CLEARED에서 나가는 `requires` 타겟 → AVAILABLE
  - 그 외 → LOCKED
- **DoD**: 샘플 그래프에서 잠금/해제 동작

#### MVP-021 클리어 판정 (제출 결과 기반)
- **담당**: FE
- **작업**: 정답률 >= 0.8 → CLEARED
- **DoD**: 제출 후 점수에 따라 상태 변경

#### MVP-022 지도 상태 시각화 + 범례
- **담당**: FE
- **DoD**: CLEARED/AVAILABLE/LOCKED/IN_PROGRESS 색/아이콘 구분, LOCKED 흐림 처리

#### MVP-023 노드 상세 패널: 상태/선행 이유/CTA
- **담당**: FE
- **DoD**: LOCKED면 "필요 선행 노드" 목록, AVAILABLE면 "도전하기" 버튼 활성

---

### EPIC 4 — 문제 풀이 + 채점 (P0)

#### MVP-026 노드별 문제 로딩 (Repository 기반)
- **담당**: FE
- **DoD**: nodeId로 문제 리스트를 가져와 고정 순서 표시

#### MVP-027 풀이 세션 (DRAFT) 생성/재개
- **담당**: FE
- **DoD**: 노드 진입 시 DRAFT 세션 생성, 중간에 나갔다 돌아오면 입력 복원

#### MVP-028 문제 풀이 화면 UI
- **담당**: FE
- **DoD**: 문제 리스트 + 입력칸 + 진행률, 제출 전 정답/정오 노출 없음

#### MVP-029 제출 UX: 확인 모달 + 미입력 안내
- **담당**: FE
- **DoD**: 제출 확인, 미입력 문항 목록 표시

#### MVP-030 채점 엔진 v1: numeric_equal + normalize
- **담당**: FE
- **DoD**: 공백/쉼표 제거 등 정규화 후 숫자 비교 정확 동작

#### MVP-031 제출 파이프라인: 일괄 채점 + 결과 저장
- **담당**: FE
- **DoD**: 세션이 SUBMITTED로 변경, 제출 후 답안 수정 불가

#### MVP-032 평가 페이지 UI: 요약 + 문항별 리뷰
- **담당**: FE
- **DoD**: 점수/정답률, 문항별 정오 표시

#### MVP-034 평가 후 액션: 재도전/다음 노드 이동/지도 복귀
- **담당**: FE
- **DoD**: 버튼 3개 동작 (다시 풀기/다음 노드/지도 보기)

---

### EPIC 5 — 대시보드/리포트 (P0)

#### MVP-035 대시보드 화면 UI
- **담당**: FE
- **DoD**: 전체 진행률, 추천, 최근 이력 UI 표시

#### MVP-036 대시보드 집계 로직
- **담당**: FE
- **DoD**: 클리어 노드 수/전체 계산, 최근 제출 세션 5~10개 표시

#### MVP-037 "이어서 하기" 동작
- **담당**: FE
- **DoD**: 진행중 세션 있으면 그 노드로 점프, 없으면 최근 노드로

---

### EPIC 6 — 콘텐츠 파이프라인 (P0)

#### MVP-041 MVP 코스 노드 목록 확정
- **담당**: Content + PM
- **DoD**: 코스 포함 노드 확정 문서 존재

#### MVP-042 문제은행 제작: 노드당 5~10문항 + subskillTag
- **담당**: Content
- **DoD**: problems.json에 nodeId 매핑 누락 없음, 각 문제에 태그 1개 이상

#### MVP-043 콘텐츠 검증 스크립트
- **담당**: FE
- **DoD**: nodeId 존재/중복 order/정답 타입 오류/태그 누락 자동 검출

---

### EPIC 7 — QA/릴리스 (P0)

#### MVP-044 E2E 스모크 시나리오 + 릴리스 체크리스트
- **담당**: QA + FE
- **DoD**: 핵심 루프 1개 코스 테스트, 릴리스 전 점검 항목 문서화

---

## MVP 코스 JSON 샘플

노드/엣지 데이터 시드용:

```json
{
  "schemaVersion": "skill-graph-v1",
  "graphId": "COURSE_ADD_PATTERN_V1",
  "title": "MVP 코스: 덧셈(Core) + 규칙성 도전(Challenge)",
  "nodes": [
    {"id": "CORE_PLACE_VALUE_3DIGIT", "nodeCategory": "core", "label": "자리값(백/십/일) 이해", "start": true, "order": 10},
    {"id": "CORE_ADD_NO_CARRY_3DIGIT", "nodeCategory": "core", "label": "받아올림 없는 세 자리 덧셈", "order": 20},
    {"id": "CORE_ADD_CARRY_TENS", "nodeCategory": "core", "label": "받아올림(십의 자리) 덧셈", "order": 30},
    {"id": "CORE_ADD_CARRY_HUNDREDS", "nodeCategory": "core", "label": "받아올림(백의 자리) 덧셈", "order": 40},
    {"id": "CORE_ADD_THREE_ADDENDS", "nodeCategory": "core", "label": "세 수의 덧셈", "order": 50},
    {"id": "CORE_ADD_WORD_PROBLEMS", "nodeCategory": "core", "label": "덧셈 문장제", "order": 60},
    {"id": "CHAL_PATTERN_NEXT_TERM", "nodeCategory": "challenge", "label": "도전: 다음 항 찾기", "order": 110},
    {"id": "CHAL_PATTERN_MISSING_TERM", "nodeCategory": "challenge", "label": "도전: 빠진 항 찾기", "order": 120},
    {"id": "CHAL_PATTERN_DESCRIBE_RULE", "nodeCategory": "challenge", "label": "도전: 규칙 설명하기", "order": 130},
    {"id": "CHAL_PATTERN_NTH_TERM", "nodeCategory": "challenge", "label": "도전: n번째 항 구하기", "order": 140}
  ],
  "edges": [
    {"edgeType": "requires", "source": "CORE_PLACE_VALUE_3DIGIT", "target": "CORE_ADD_NO_CARRY_3DIGIT"},
    {"edgeType": "requires", "source": "CORE_ADD_NO_CARRY_3DIGIT", "target": "CORE_ADD_CARRY_TENS"},
    {"edgeType": "requires", "source": "CORE_ADD_CARRY_TENS", "target": "CORE_ADD_CARRY_HUNDREDS"},
    {"edgeType": "requires", "source": "CORE_ADD_CARRY_HUNDREDS", "target": "CORE_ADD_THREE_ADDENDS"},
    {"edgeType": "requires", "source": "CORE_ADD_THREE_ADDENDS", "target": "CORE_ADD_WORD_PROBLEMS"},
    {"edgeType": "requires", "source": "CORE_ADD_NO_CARRY_3DIGIT", "target": "CHAL_PATTERN_NEXT_TERM"},
    {"edgeType": "requires", "source": "CHAL_PATTERN_NEXT_TERM", "target": "CHAL_PATTERN_MISSING_TERM"},
    {"edgeType": "requires", "source": "CHAL_PATTERN_MISSING_TERM", "target": "CHAL_PATTERN_DESCRIBE_RULE"},
    {"edgeType": "requires", "source": "CHAL_PATTERN_DESCRIBE_RULE", "target": "CHAL_PATTERN_NTH_TERM"}
  ]
}
```

---

## Out of Scope
- 백엔드 API 개발 (프론트엔드 중심, LocalStorage 활용)
- AI 기반 진단/추천 시스템
- 대규모 문제 은행 구축

---

## Verification

### Author Mode
- [ ] `/author/*` 접근 제어 동작
- [ ] 엣지 추가/삭제/타입 변경 후 저장 유지
- [ ] Validation에서 사이클 탐지
- [ ] Import/Export 정상 동작
- [ ] Publish 후 학생 모드에서 새 버전 사용

### 잠금/해제
- [ ] start 노드 AVAILABLE
- [ ] requires 엣지 기반 잠금해제 동작
- [ ] 클리어 판정 (>=80%) 동작

### 핵심 플로우
- [ ] 지도 → 문제풀이 → 채점 → 다음노드 해제 동작

### 품질
- [ ] `npm test` 통과
- [ ] `npm run build` 통과
