# 프로젝트 기획 요약: 스킬트리 기반 초등 연산 학습 서비스

본 문서는 본 프로젝트의 핵심 기획을 간결하게 정리한 개요입니다. 목표는 “문서→코드→테스트→자동수정→배포”로 이어지는 자동화 파이프라인 위에서, 초등 연산 학습을 디아블로식 스킬트리로 제공하는 웹서비스를 구현·운영하는 것입니다.

자세한 최대 상세 기획서는 `docs/pm/spec_skill_tree_v1.0.md`와 PRD는 `docs/pm/prd_skill_tree_v1.0.md`(Single Source of Truth)를 참고하세요. 제품 결정 로그는 `docs/pm/DECISIONS.md`에 기록합니다.

## Archives
- 초기 기획(교재 제작 절차, v0): `docs/pm/archive/initial_plan_2025-11-10.md`

## 1) 제품(학습 서비스)
- 목표: 초1–2 연산 중심 학습을 스킬트리로 시각화하여, 선행→해금→보스전 흐름으로 동기부여.
- 핵심 화면:
  - SkillTreePage(그래프): 노드(스킬)·엣지(선행관계), 잠김/해금/완료/마스터 상태, 보스 노드.
  - SkillDetailPanel: 라벨, 난이도, 해제 조건, XP 바, “연습 시작”.
  - PracticeSession: 문제 카드/피드백, BossBattle: 티어 평가(10문).
- 학습 로직: 정답·오답에 따른 XP/레벨업, 2회 오답 자동 패스, 보스 통과 시 다음 티어 일괄 해금.
- 데이터 모델: `docs/dag.md`(마커 JSON) → converter로 `app/data/skills.json` 생성(노드/엣지/티어/보스/XP).
- 정책/접근성: 아동 보호(noindex, AdSense NPA), 오류는 RFC 9457, 키보드/스크린리더 대응.

## 2) 백엔드(API)
- 주요 API:
  - `GET /api/v1/skills/tree` → 그래프 + `unlocked` + (선택) `requires_titles`
  - `POST /api/v1/skills/progress` → 세션 결과 반영, `new_unlocked_ids` 반환
  - (옵션) `ws://…/skills/events` → 실시간 해금 알림
- 성공 응답은 평문 JSON, 오류는 Problem Details(RFC 9457)로 일관화.

## 3) 프론트엔드(FE)
- 스킬트리 렌더: React Flow(or ELK 레이아웃) 기반 그래프, 줌/팬/미니맵, 포커스 경로 강조.
- 상태 시각화: 잠김(점선+🔒), 해금(점선+애니메), 열림(실선), 완료(녹색), 마스터(★ 배지) + 툴팁.
- 피드백 애니메이션: 해금 시 엣지 pulse → 노드 glow/scale-in, 라이브리전 ARIA 안내.

## 4) 자동화 파이프라인(codex)
- 문서 주도: `docs/idea.md → PRD.md/architecture.md/test_plan.md` 자동 생성·동기화.
- 데이터 생성: `dag_to_json.py`로 `skills.json` 빌드·검증(사이클/누락 체크).
- 테스트 루프: `pytest` 실패 → `codex_loop.py`가 패치(diff) 제안·적용→재테스트(제약: 파일 스코프, 표준 에러 정책, 비동기 클라이언트 사용).
- E2E: Docker Compose로 BE/FE/DB 기동, API/Playwright 테스트.
- 배포: Railway(Nixpacks or Docker). `main` 머지 시 배포 + 스모크(`/health`, `/skills/tree` 200/503).
- CI/CD: GitHub Actions — `docs-to-pr`, `ci`, `e2e-compose`, `deploy-railway`.
- 비밀/변수: `LLM_API_KEY`, `RAILWAY_*`, `BACKEND_URL` 등.

## 5) 운영 지표
- Problems Served, Attempts, Correct Rate, Avg Solve Time, Autopass Rate, p95 latency,
- `skill_viewed/skill_start/skill_unlocked/zoom_changed/contrast_toggled` 이벤트 수집.

## Spec-Loop(스펙·기획 루프)
- “요구사항 접수 → Claude가 초안 작성 → Codex가 리뷰 → Claude 재검토 → Codex 재검토 … (양쪽 승인까지 반복)” 자동화.
- 실행 스크립트: `scripts/spec/spec_loop.py` — 산출물은 `docs/specs/<TASK>/spec_v*.md`, `SPEC_FINAL.md`, 변경내역은 `changelog.md`, 라운드는 `logs/<TASK>/spec/spec-loop.jsonl`에 기록.
- 실행 예시:
  - 환경: `CLAUDE_CMD_TEMPLATE`, `CODEX_CMD_TEMPLATE` 설정
- 명령: `make spec-loop TASK=TASK-0008 REQ=docs/intake/TASK-0008_requirements.md`

---

### 한 줄 요약
스킬트리 형태의 초등 연산 학습 서비스를, 문서→코드→테스트→자동수정→배포가 이어지는 codex 파이프라인으로 지속적으로 발전시키는 프로젝트입니다.

## Guides
- 교습·커리큘럼 가이드(SOP): `docs/handbook/forensic_curriculum_sop.md`
- 전이 커리큘럼 묶음 패키지: `docs/handbook/transfer_curriculum_package.md`
- 전이 커리큘럼 키워드·교수 포인트: `docs/handbook/transfer_curriculum_keywords_points.md`

## Research
- 2022 개정 수학과 교육과정(초1~고3) 자료조사: `docs/analysis/kr_2022_math_curriculum_research.md`

## Reviews
- PRD 리뷰(원문): `docs/pm/prd_review_2025-11-10.md`
- 리뷰 평가/수용 계획: `docs/pm/prd_review_evaluation_2025-11-10.md`
- 정밀 검토 결과 및 대책: `docs/pm/precision_review_and_actions_2025-11-10.md`
