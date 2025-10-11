# 해야 할 일

- [ ] 로그인 기능 도입: 일일 학습 기록과 진행 상황을 사용자 단위로 추적할 수 있도록 인증/세션을 구현
- [ ] 수학 학습과 무관한 문서(로컬 개발 가이드, 안전/프라이버시 등) 정리 또는 제거
- [ ] 실시간 학습 지표를 사용자별로 개인화할 수 있도록 데이터 모델/뷰 재구성
- [ ] Web Vitals·WCAG 관련 안내는 내부 품질 체크리스트로만 유지하고, 학습 화면에는 노출하지 않도록 정리
- [ ] 학습 화면에서 ‘허브로 돌아가기’ 등 공유/탐색용 버튼을 제거하여 개인 학습 흐름에 집중
- [ ] 메인 화면에서 헬스체크/허브 공유 안내를 제거하고 학습 전용 메시지로 단순화 (`app/templates/index.html`)
- [x] `docs/problem_generation_plan.md` 지침에 따라 템플릿·문제 데이터 구조와 파라미터를 업데이트해 생성 문제를 개선 (`app/data/templates.json`, `app/template_engine.py`, `app/routers/curriculum.py`)
- [x] 덧셈 등 개념 선택 시 S1→S2→S3를 스킬 트리 단계별로 노출하고 단계 완료 시 다음 단계가 활성화되도록 UX 재구성 (`frontend/src/components/MathGame.tsx`, `frontend/src/components/SkillTree.tsx`, `frontend/src/components/MathGame.css`, `frontend/src/components/SkillTree.css`)
- [ ] MathGame에서 정답 입력 후 `확인` 버튼/엔터를 눌러도 제출되지 않는 사례를 재현하고 입력 검증 로직을 개선
- [x] MathGame에서 `확인` 버튼 클릭 시 정답 피드백이 표시되지 않는 이슈 수정 및 모든 문제 풀이 후 `답변 제출` 아래 정답률 표시 추가 (`frontend/src/components/MathGame.tsx`, `frontend/src/components/MathGame.css`)
- [x] 커리큘럼을 Skill Tree 형태로 시각화하는 UI 구현 (`frontend/src/components/SkillTree.tsx`, `frontend/src/components/SkillTree.css`, `frontend/src/components/skillTreeHelpers.ts`)
- [x] 콘텐츠 스튜디오에서 바로 임포트할 수 있도록 100개 템플릿을 JSON/NDJSON으로 패키징하고 샘플 파일 생성 (`docs/content_templates.ndjson`)
- [x] 온보딩 진단 v0.9 스펙 정리 (스레드별 S1 3문항 구성, 점수 산식, 추천 로직) (`docs/onboarding_diagnostic_v0.9.md`)
- [x] 교사 콘솔 "수업 악보" 자동 생성 규칙 설계 및 출력 포맷 정의 (`docs/teacher_lesson_score_rules.md`)
- [x] `pytest` 실행 시 타임아웃 발생 원인 분석 및 수정 - async 테스트로 전환하여 해결됨 (`tests/test_api.py`, `tests/test_curriculum.py`, `tests/test_invites.py`, `tests/test_pages.py`, `tests/test_curriculum_graph.py`)
