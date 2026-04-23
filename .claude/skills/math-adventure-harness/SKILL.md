---
name: math-adventure-harness
description: 수학 모험(calculate_math) 서비스의 연구·개발·운영 전체 워크플로우를 조율하는 오케스트레이터. 커리큘럼 그래프 설계, 문제 출제, 진단 taxonomy, 상태 분석, 백엔드/프론트엔드 구현, 숙제 운영이 얽힌 작업을 7명 에이전트 팀으로 돌린다. "커리큘럼 구축", "단원 추가", "숙제 세트 배포", "주간 분석", "그래프 확장", "신규 노드 → 문제 → 구현", "재실행", "업데이트", "부분 수정", "다시 실행", "이전 결과 기반" 같은 표현이 나오면 이 스킬을 반드시 트리거한다. 단순한 파일 읽기·한 줄 질문은 직접 응답.
---

# Math Adventure Harness (오케스트레이터)

수학 모험 서비스의 전체 팀을 조율한다. 연구원 4명 + 개발자 2명 + 조교 1명이 교육과정 그래프 → 문제 → 구현 → 운영 → 분석 루프를 돌린다.

## 실행 모드

**하이브리드:**
- 기본값 = **에이전트 팀** — 2명 이상 협업이 기본
- 단일 도메인 작업(예: 오늘 미제출 학생 조회) = **서브 에이전트** — `Agent` 직접 호출
- Phase별 특성이 다르면 Phase 내부에서 모드 전환

모든 `Agent` 호출과 `TeamCreate`에는 `model: "opus"` 명시.

## 팀 구성

| 역할 | 에이전트 | 주요 스킬 |
|---|---|---|
| 연구: 그래프 | `curriculum-graph-designer` | `curriculum-graph-design` |
| 연구: 문제 | `problem-content-designer` | `problem-bank-curation` |
| 연구: 진단 | `learning-diagnostic-designer` | `diagnostic-taxonomy-design` |
| 연구: 상태 분석 | `student-state-researcher` | `student-state-analysis` |
| 개발: 백엔드 | `math-backend-engineer` | `math-backend-implementation` |
| 개발: 프론트 | `math-frontend-engineer` | `math-frontend-implementation` |
| 운영: 조교 | `homework-ta` | `homework-operations` |

## Phase 0: 컨텍스트 확인

워크플로우 시작 시 기존 산출물을 확인해 실행 모드를 결정한다.

```
calculate_math/_workspace/ 확인:
- 존재 + 사용자가 "재실행"/"업데이트"/"보완" 지시 → 부분 재실행 모드
- 존재 + 사용자가 새 입력 제공 → 기존 _workspace/ → _workspace_prev/ 이동, 새 실행
- 미존재 → 초기 실행
```

부분 재실행 모드에서는 **해당 에이전트만** 재호출한다. 전체 파이프라인을 다시 돌리지 않는다.

## Phase 1: 요청 분류

사용자 요청을 다음 유형 중 하나로 분류:

| 요청 유형 | 실행 모드 | 관여 에이전트 |
|---|---|---|
| **A. 신규 단원 구축** (그래프→문제→구현→배포) | 팀 (파이프라인) | 연구 4 + 개발 2 + 조교 1 |
| **B. 그래프만 수정** | 팀 (연구 중심) | 그래프 + 진단 + 상태분석 |
| **C. 문제 출제/숙제 세트** | 팀 (소규모) | 그래프 + 문제 + 진단 |
| **D. 진단 taxonomy 변경** | 팀 (영향 전파) | 진단 + 문제 + 상태분석 + BE |
| **E. 백엔드 변경만** | 팀 (계약 기반) | BE + FE (계약 합의) |
| **F. 프론트 변경만** | 서브 | FE 단독 |
| **G. 운영 조회/리마인드** | 서브 | 조교 단독 |
| **H. 주간 분석/KPI** | 팀 (연구 중심) | 상태분석 + 조교 데이터 + 진단 |

각 유형의 실행 흐름은 아래 Phase 2에서 상세 지시.

## Phase 2: 실행 흐름

### A. 신규 단원 구축 (파이프라인)

**실행 모드: 에이전트 팀 → 팀 재구성 → 팀**

```
Stage 1 (연구팀): TeamCreate members=[curriculum-graph-designer, problem-content-designer, learning-diagnostic-designer, student-state-researcher]
  - graph-designer가 노드 제안 → diagnostic-designer가 weakTag 후보 제시 → problem-designer가 문제 세트 설계
  - 산출물: _workspace/stage1_*.md, .json
  - 완료 후 TeamDelete

Stage 2 (개발팀): TeamCreate members=[math-backend-engineer, math-frontend-engineer]
  - BE가 API 계약 작성 → FE가 검토 합의 → 동시 구현
  - 산출물: 코드 + _workspace/api_contract_*.md
  - 완료 후 TeamDelete

Stage 3 (운영): Agent(homework-ta, model=opus) — 서브 호출
  - 숙제 세트 배포 및 초기 현황 확인
```

### B. 그래프만 수정

**실행 모드: 에이전트 팀**

```
TeamCreate members=[curriculum-graph-designer, learning-diagnostic-designer, student-state-researcher]
- graph-designer 주도, 나머지가 영향 리뷰
- 대규모 변경(10개+ 노드)은 math-backend-engineer에게 마이그레이션 영향 사전 공유
```

### C. 문제 출제

**실행 모드: 에이전트 팀 (소규모)**

```
TeamCreate members=[problem-content-designer, learning-diagnostic-designer, curriculum-graph-designer]
- problem-designer 주도
- 새 weakTag 필요 시 diagnostic-designer에게 요청 → 승인 후 진행
- 기존 그래프에 없는 선수지식 발견 시 graph-designer에게 에스컬레이션
```

### D. 진단 taxonomy 변경

**실행 모드: 에이전트 팀**

```
TeamCreate members=[learning-diagnostic-designer, problem-content-designer, student-state-researcher, math-backend-engineer]
- diagnostic-designer가 버전업 제안
- problem-designer: 재태깅 범위 산정
- researcher: 과거 데이터 재분석 영향
- BE: 스키마/enum 변경 영향 + 마이그레이션 설계
```

### E. 백엔드 변경

**실행 모드: 에이전트 팀 (계약 합의 중심)**

```
TeamCreate members=[math-backend-engineer, math-frontend-engineer]
- BE가 _workspace/api_contract_{feature}.md 먼저 작성
- FE가 shape 검토 + 합의
- BE 구현 → FE 연결
- shape 불일치는 즉시 SendMessage로 수정
```

### F. 프론트 변경만

**실행 모드: 서브 에이전트**

```
Agent(subagent_type=math-frontend-engineer, model=opus, prompt="...")
- 기존 계약 변경 없는 UI 수정만 해당
- 변경이 API 응답을 요구하면 Phase 2-E로 돌린다
```

### G. 운영 조회

**실행 모드: 서브 에이전트**

```
Agent(subagent_type=homework-ta, model=opus, prompt="...")
- admin API만 호출 (CLAUDE.md 규칙)
- 반복 이슈 발견 시 operations_issues_{date}.md 생성 후 팀 모드로 전환
```

### H. 주간 분석

**실행 모드: 에이전트 팀**

```
Stage 1: Agent(subagent_type=homework-ta, run_in_background=true) — 운영 데이터 수집
Stage 2: TeamCreate members=[student-state-researcher, learning-diagnostic-designer]
- researcher 주도 리포트 작성
- diagnostic-designer가 상태 전이 규칙 적합도 검토
- 정책 개선 제안 → 해당 오너에게 TaskCreate
```

## Phase 3: 데이터 전달 프로토콜

**파일 기반 (산출물):**
- 모든 중간 산출물은 `calculate_math/_workspace/` 하위
- 파일명: `{phase|stage}_{agent}_{artifact}.{ext}`
- 예: `stage1_graph_proposal.json`, `api_contract_related_nodes.md`
- 최종 산출물만 프로젝트 지정 경로로 이동, `_workspace/`는 보존 (감사 추적)

**메시지 기반 (실시간 조율):**
- 팀 모드에서 `SendMessage`로 실시간 토론
- 정책 변경/에스컬레이션은 반드시 이 경로

**태스크 기반:**
- `TaskCreate`로 작업 의존성 명시
- 정책 개선 제안 → 해당 에이전트 소유 태스크로 발행

## Phase 4: 에러 핸들링

| 상황 | 대응 |
|---|---|
| 에이전트 1회 실패 | 1회 재시도 |
| 재시도 후도 실패 | 해당 결과 누락으로 진행, 최종 리포트에 명시 |
| 팀원 간 상충된 결론 | 삭제하지 않고 출처 병기. 사용자에게 어느 쪽을 채택할지 질문 |
| BE-FE 계약 불일치 | Phase 2-E로 롤백, BE에서 재합의 |
| 그래프 변경이 문제은행 대량 재태깅 요구 | 영향 범위를 먼저 추정, 사용자 승인 후 진행 |
| admin API로 해결 불가 판단 | 새 API 만들기 전에 실패 증거를 `_workspace/`에 기록, 사용자에게 보고 |

## Phase 5: 검증

각 Phase 완료 후:
- 팀 모드: 팀원 전원이 산출물 요약을 공유 (`SendMessage`)
- 서브 모드: 반환값 + `_workspace/` 산출물 확인
- 코드 변경이 있으면: 관련 테스트 실행 (`pytest`, `npm run test`)
- 대규모 변경: `npm run validate:data`, `make verify` 실행 제안

## Phase 6: 사용자 피드백

실행 완료 후 사용자에게:
1. 산출물 요약 (파일 경로 포함)
2. 개선 요청 여부 질문
3. 같은 유형 피드백 2회 이상 반복 시 하네스 진화 제안 (`harness` 스킬 재호출)

## 테스트 시나리오

### 정상 흐름 (A. 신규 단원 구축)
1. 사용자: "NA 갈래에 3자리 곱셈 노드 추가하고, 문제 20개 만들어서 배포 준비까지"
2. Phase 0: `_workspace/` 미존재 → 초기 실행
3. Phase 1: 유형 A 분류
4. Stage 1: 연구팀 4명 팀 구성 → 노드 제안(3자리곱셈, requires=2자리곱셈) → weakTag(자리값_혼동, 받아올림_다중) → 문제 20개
5. Stage 2: BE가 문제 업로드 API 계약 → FE가 배포 UI 합의 → 구현
6. Stage 3: 조교가 테스트 반 1명에 배포, daily-summary 확인
7. 최종 리포트: 산출물 경로, 다음 주 state-researcher가 볼 지표

### 에러 흐름 (D. taxonomy 변경 중 BE 마이그레이션 실패)
1. 사용자: "weakTag v0.3으로 올려줘"
2. Phase 1: 유형 D
3. 팀 구성, diagnostic-designer가 v0.3 제안
4. BE가 마이그레이션 dry-run → 과거 레코드 500건 변환 실패
5. 1회 재시도 실패
6. 팀에 `SendMessage`: "실패, 원인 = 기존 태그 X는 새 enum에 매핑 불가"
7. 사용자에게 보고: 방안 (a) 실패 태그 수동 매핑 (b) v0.3 보류
8. 사용자 결정 대기, `_workspace/`에 전체 과정 기록

## 의존 스킬

이 하네스가 조율하는 7개 서브 스킬:

| 스킬 | 역할 | 언제 호출하는가 |
|---|---|---|
| `curriculum-graph-design` | 그래프 설계 | 새 노드/선수관계 추가 시 |
| `problem-bank-curation` | 문제 출제 | 노드에 문제 세트 연결 시 |
| `diagnostic-taxonomy-design` | 진단 체계 | weakTag/상태 전이 규칙 변경 시 |
| `student-state-analysis` | 상태 분석 | KPI 리포트, 정책 개선 시 |
| `math-backend-implementation` | 백엔드 개발 | API/스키마/마이그레이션 시 |
| `math-frontend-implementation` | 프론트 개발 | UI/화면/ReactFlow 수정 시 |
| `homework-operations` | 운영 조교 | 숙제 배정·현황·리마인드 시 |

## 트리거 키워드 (should-trigger)

"커리큘럼 구축", "단원 추가", "새 노드", "문제 출제", "숙제 세트 배포", "taxonomy 변경", "weakTag 추가", "주간 리포트", "KPI 확인", "약점 분석", "그래프 확장", "신규 단원 → 문제 → 구현", "재실행", "업데이트", "수정", "보완", "이전 결과 기반", "부분만 다시"

## 트리거 제외 (should-NOT-trigger)

- "이 파일 읽어줘" → 직접 Read
- "CLAUDE.md가 뭐야?" → 직접 답
- "npm run dev 어떻게 해?" → 직접 답변 (CLAUDE.md 참고)
- 단일 버그 원인 파악 질문 → 직접 조사 후 필요 시에만 BE/FE 에이전트 호출
