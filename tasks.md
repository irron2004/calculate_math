# 해야 할 일

- [x] MathGame에서 `확인` 버튼 클릭 시 정답 피드백이 표시되지 않는 이슈 수정 및 모든 문제 풀이 후 `답변 제출` 아래 정답률 표시 추가 (`frontend/src/components/MathGame.tsx`, `frontend/src/components/MathGame.css`)
- [x] 커리큘럼을 Skill Tree 형태로 시각화하는 UI 구현 (`frontend/src/components/SkillTree.tsx`, `frontend/src/components/SkillTree.css`, `frontend/src/components/skillTreeHelpers.ts`)
- [x] 콘텐츠 스튜디오에서 바로 임포트할 수 있도록 100개 템플릿을 JSON/NDJSON으로 패키징하고 샘플 파일 생성 (`docs/content_templates.ndjson`)
- [x] 온보딩 진단 v0.9 스펙 정리 (스레드별 S1 3문항 구성, 점수 산식, 추천 로직) (`docs/onboarding_diagnostic_v0.9.md`)
- [x] 교사 콘솔 "수업 악보" 자동 생성 규칙 설계 및 출력 포맷 정의 (`docs/teacher_lesson_score_rules.md`)
- [x] `pytest` 실행 시 타임아웃 발생 원인 분석 및 수정 - async 테스트로 전환하여 해결됨 (`tests/test_api.py`, `tests/test_curriculum.py`, `tests/test_invites.py`, `tests/test_pages.py`, `tests/test_curriculum_graph.py`)
