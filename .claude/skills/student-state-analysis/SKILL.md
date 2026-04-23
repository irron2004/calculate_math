---
name: student-state-analysis
description: 실제 운영 데이터로 학생 상태·약점 해결 여부·KPI를 분석하고 정책 개선안을 제안한다. 주간 리포트 작성, 개념 해결 분석, North Star(주간 해결된 약점 개념 수) 모니터링, 추천/진단 정책 개선이 필요할 때 반드시 이 스킬을 쓴다. "주간 리포트", "학생 분석", "약점 해결", "KPI 확인", "정책 개선" 표현이 나오면 트리거한다.
---

# Student State Analysis

설계된 taxonomy·전이 규칙이 실제 데이터에서 어떻게 작동하는지 검증하고 정책 개선으로 순환시키는 절차.

## 언제 쓰는가

- 주간 KPI 리포트 작성
- 특정 노드/학생의 개념 해결 여부 분석
- taxonomy·전이 규칙 현장 적합도 검증
- 추천/진단 정책 개선안 도출

## 워크플로우

### 1. 데이터 소스 접근

우선순위:
1. **admin API**: `GET /api/homework/admin/students/{id}/daily-summary`, `.../submission-status`, `.../submissions/{id}/answer-check`
2. **DB 직접**: `backend/data/app.db` (읽기 전용)

admin API로 답이 나오지 않을 때만 DB를 본다.

### 2. 기간·대상 설정

- 기본 기간: 최근 1주 (월~일)
- 비교 기간: 직전 1주 (전주 대비 델타)
- 대상 단위: 전체 / 학년 / 반 / 개별 학생

### 3. 4축 KPI 동시 측정

학습 효과 KPI 하나만 보지 않는다. 항상 4축을 같이 본다:

| 축 | 지표 | 계산 |
|---|---|---|
| A. 학습 효과 | 주간 해결된 약점 개념 수 (North Star) | `COUNT(weakTag WHERE state 이번주 내 해결됨으로 전이)` |
| A. 학습 효과 | 약점 개념 해결률 | 해결됨 전이 / 약점확인 진입 |
| A. 학습 효과 | 재도전 후 정답률 개선율 | (재도전 정답률 - 최초 정답률) |
| B. 학습 참여 | 24시간 숙제 제출률 | 24h 내 제출 / 배정 |
| B. 학습 참여 | 7일 재방문율 | 7일 내 재방문 / 이전 주 활성 |
| C. 설명가능성 | 오답 원인 자기진단 입력률 | 입력 / 오답 |
| D. 운영 품질 | 제출 후 검토 완료까지 평균 시간 | AVG(reviewedAt - submittedAt) |

하나가 오르고 다른 하나가 내려가는 패턴을 놓치지 않는다.

### 4. 해석 원칙

- **사례가 아닌 분포** — n≥30 기준, n이 낮으면 "표본 부족"을 명시하고 결론 보류
- **단일 원인 단정 지양** — "이것 때문이다" 대신 "A, B, C 가능성 중 A가 가장 가능성 높음"
- **비교 기준 명시** — "개선됨"은 전주 대비 +X%p, 신뢰구간 명기

### 5. 정책 개선 제안 형식

관찰만으로 끝내지 않는다. 실행 가능한 제안으로.

```markdown
## 제안 1: na_add_decimal 노드 선수관계 보강
- **관찰**: 이 노드 진입 학생의 38%가 받아올림_누락 태그로 약점확인 상태에 머무름
- **가설**: na_add_2digit_carry 해결 없이 진입한 학생 비율이 높음 (실제 측정: 41%)
- **제안**: na_add_decimal의 requires에 na_add_2digit_carry 추가
- **예상 영향**: 약점확인 비율 38% → 추정 25% (신뢰구간 ±5%p)
- **오너**: curriculum-graph-designer
```

### 6. 산출물

- `_workspace/weekly_state_report.md` — 4축 KPI + 해설 + 전주 대비
- `_workspace/policy_improvement_proposals.md` — 제안 목록
- `_workspace/concept_resolution_analysis_{nodeId}.md` — 개별 개념 분석 (요청 시)

### 7. 순환 피드백

제안은 해당 정책 오너에게 `SendMessage`로 전달:
- 그래프 변경 제안 → `curriculum-graph-designer`
- taxonomy 변경 제안 → `learning-diagnostic-designer`
- 운영 개선 → `homework-ta`

## 의존 스킬

- `homework-operations` — admin API로 숙제/제출 데이터 수집
- `diagnostic-taxonomy-design` — 상태 전이 규칙 현장 적합도 검토
- `curriculum-graph-design` — 그래프 변경 제안 시 노드 정보 확인

## 데이터 취급 원칙

- **PII 마스킹** — 학생 이름은 분석 결과에 ID로 표기, 실명 노출 금지
- **최소 접근** — 분석에 필요한 필드만 조회, 원본 답안은 익명화 후 처리
- **보존 기간** — 상세 풀이 로그는 90일 후 집계 데이터로 대체
- **접근 제어** — admin API는 인증된 관리자 스코프만 사용

## 원칙

- **North Star 우선** — 주간 해결된 약점 개념 수를 중심에 둔다
- **4축 동시 관찰** — 단일 지표 최적화 금지
- **사례 < 분포** — 표본·구간 명시
- **관찰 → 실행 가능 제안** — 제안 없는 분석은 반쪽
- **설명 가능성 우선** — 블랙박스 개선 지양

## 참고
- `03_문서/docs/service_goals_kpi_and_roles.md` §2
- `03_문서/docs/homework_daily_answer_check_v1_be_owner_output.md`
- `03_문서/docs/problem_ops_and_progress_management.md`
