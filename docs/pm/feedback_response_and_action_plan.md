---
title: 시니어 기획자 피드백 대응 및 실행 계획
author: PM Team
date: 2025-11-10
status: active
type: response-plan
related_docs:
  - docs/pm/senior_pm_feedback.md
  - docs/pm/prd_skill_tree_v1.0.md
  - docs/pm/spec_skill_tree_v1.0.md
  - docs/pm/DECISIONS.md
  - docs/pm/review_response_2025-11-10.md
---

## 개요
시니어 기획자 피드백(원문: `docs/pm/senior_pm_feedback.md`)에 대한 팀의 공식 대응과 실행 계획입니다. 본 계획은 메인 PRD(v1.0.1, `docs/pm/prd_skill_tree_v1.0.md`)와 구현 스펙(`docs/pm/spec_skill_tree_v1.0.md`)에 즉시 반영되었습니다. 제품 결정 로그는 `docs/pm/DECISIONS.md`에 기록합니다.

## 핵심 합의(요약)
- Single Source of Truth: PRD는 `docs/pm/prd_skill_tree_v1.0.md`로 단일화(구 PRD는 Archived).
- Phase 1 범위/대상/일정: 초2~초4, 코스 3개×S1/S2, 템플릿 30개, 10–12주.
- Unlock 규칙: Phase 1=ALL, 제한적 ANY=교사 모드 + Phase 2.
- 보스전: 합격 80/100, 쿨다운 없음, 실패 시 리미디얼 추천 UX.
- 접근성: 대체 UI(리스트 뷰) 추가.
- 설명 채점: Phase 1 선택, S3에서만 필수(키워드 매칭). 임베딩/음성은 후속 단계.
- 문제 생성 최소 품질 게이트: 중복 방지/범위·자릿수 검증/파라미터 제약. IRT는 Phase 2.
- 수익화: 무료=S1 무제한 + S2 일부(3개), 유료=전체 + 부모 리포트 + 교사 콘솔, S2 2회 완료 시 전환 모달.

## 항목별 조치(반박/추가조사/수정)
1) 문서 불일치 → PRD 단일화 수용. 구 PRD Archived, Spec은 Implementation Spec으로 명시.
2) 미결 의사결정 → 확정(ALL/ANY, 노드 노출, 보스전). DECISIONS.md 기록.
3) 타겟/범위 → Phase 1을 초2~초4로 축소. 중등은 흐림 노출 + Phase 2 이관.
4) UX 플로우 → 세션 종료/보스 실패 플로우 보강(해금 애니메이션/자동 포커스/리미디얼 CTA).
5) 문제 생성 → 최소 품질 게이트 정의(중복 금지/검증/제약). IRT는 파일럿 후 Phase 2.
6) 설명 채점 → Phase 1 축소(S3 필수, 키워드 매칭만). 임베딩/음성은 후속.
7) 접근성 → 리스트 대체 UI 도입(A/B 포함).
8) 수익화 → 무료/유료 경계 및 전환 타이밍 명시.
9) DAG 운영 → 편집 워크플로우/CI 검증/버전 필드 문서화.
10) 일정 → 10–12주로 현실화.
11) 법무 → 저작 가이드 법무 검토 및 라이선스 로그 파일 도입.
12–15) 조사 플랜 → 경쟁분석/사용자리서치/IRT요구/A-B 인프라 문서 초안 작성.

## 실행 계획(액션 아이템)
| 우선 | 액션 | 산출물/링크 | 담당 | 기한 | 상태 |
|---|---|---|---|---|---|
| P0 | PRD 단일화/버전 정리 | prd_skill_tree_v1.0.md(v1.0.1), docs/PRD.md(archived) | PM | +3일 | 완료 |
| P0 | 의사결정 3종 확정 | docs/pm/DECISIONS.md | PM+팀 | +3일 | 완료 |
| P0 | Phase 1 타겟 확정 | PRD 업데이트 | PM | +3일 | 완료 |
| P1 | MVP 범위 재정의 | PRD v1.0.1(범위표) | PM | +1주 | 진행 |
| P1 | 세션 종료/보스 실패 UX | Spec 업데이트 | UX | +1주 | 예정 |
| P1 | 법무 검토 의뢰 | 저작 가이드 초안 + 요청서 | PM | +2주 | 예정 |
| P2 | 경쟁 분석 | docs/analysis/competitive_analysis_plan.md | PM | +2주 | 예정 |
| P2 | 사용자 인터뷰 5–10가구 | docs/analysis/user_research_plan.md | UXR | +3주 | 예정 |
| P2 | IRT 데이터 요건 정리 | docs/analysis/irt_data_requirements.md | DS | +3주 | 예정 |
| P2 | A/B 인프라 초안 | docs/experiments/ab_testing_infra.md | ENG | +3주 | 예정 |

## Spec 문서 검토 결과(`docs/pm/spec_skill_tree_v1.0.md`)
- “다음 의사결정” 섹션에 v1.0.1 결정사항(ALL/ANY, 보스전, 노드 노출) 반영 완료.
- Spec-Loop 연계: 본 계획 승인 후 `make spec-loop TASK=TASK-0011 REQ=docs/pm/prd_skill_tree_v1.0.md`로 SPEC_FINAL 수렴 권장.

## 추적/링크
- 메인 PRD: `docs/pm/prd_skill_tree_v1.0.md`
- 구현 스펙: `docs/pm/spec_skill_tree_v1.0.md`
- 의사결정 로그: `docs/pm/DECISIONS.md`
- 피드백 원문: `docs/pm/senior_pm_feedback.md`
- 상세 응답: `docs/pm/review_response_2025-11-10.md`

