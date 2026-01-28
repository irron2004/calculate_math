---
workflow: code
graph_profile: frontend
---

# Learning status label alignment (CLEARED vs COMPLETED)

## Goal
학생 학습 상태 표기(“CLEARED” vs “COMPLETED”)를 UI/테스트/타입 정의에 걸쳐
일관되게 맞춘다.

## Background
- `NodeStatus`는 `CLEARED`를 사용하지만, 일부 테스트는 `COMPLETED`를 기대함.
- `LearningStatusLegend`는 현재 `CLEARED`를 표시.
- 테스트 실패 원인: 라벨 불일치.

## Scope (In)
- 사용자 표시 라벨의 기준을 확정(CLEARED 또는 COMPLETED).
- 표시 라벨 매핑 추가(내부 키 유지 시).
- `LearningStatusLegend`/`LearningStatusBadge` 및 관련 UI 텍스트 정리.
- 관련 테스트 업데이트.
- 상태 키 변경 시 CSS 클래스/매핑/문서 동기화.

## Out of Scope
- 학습 상태 계산 로직/임계치 변경.

## Acceptance Criteria
- `LearningStatusLegend` 테스트가 통과한다.
- UI에 표시되는 라벨이 전체 앱에서 동일하다.
- 상태 키와 CSS 클래스 매핑이 깨지지 않는다.

## Commands
- `cd curriculum-viewer && npm test`
