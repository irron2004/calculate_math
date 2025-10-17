# Codex Orchestration

본 폴더는 "문서 → 코드 → 테스트 → 자동 수정 → 배포 → 사후 테스트" 자동화를 위한 설정/프롬프트를 담습니다.

## 파이프라인 개요
1) docs-to-pr: `docs/idea.md`/`docs/dag.md`가 바뀌면 PRD/skills.json을 생성/검증하여 PR 생성
2) ci: pytest + skills.json 검증 (동기 TestClient 금지, httpx.AsyncClient 권장)
3) ci-autofix(옵션): 실패 시 `.codex/prompts/autofix.md`로 LLM 패치 제안 → 별도 PR
4) e2e-compose: docker-compose로 FE/BE/DB 기동 후 API/브라우저 E2E
5) deploy-railway: main 병합 → Railway 배포 → 사후 스모크 테스트

## 프롬프트 위치
- 문서 생성/갱신: `.codex/prompts/docs_gen.md`
- 자동 수정(autofix): `.codex/prompts/autofix.md`

## 비밀/변수
- `LLM_API_KEY` (필수) — codex 자동 수정/문서생성에 필요
- `LLM_BASE_URL`, `LLM_MODEL` (선택)
- 배포(Railway): `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_BACKEND`, `RAILWAY_SERVICE_FRONTEND`, `BACKEND_URL`

## 모델 전략 (Aider + vLLM 등)
- 빠른 계획/탐색: 로컬 vLLM(예: OpenAI 호환 서버) → `LLM_PLAN_MODEL`로 지정
- 최종 패치: 더 강한 모델(호스팅)을 `LLM_MODEL`로 지정해 정확도 확보
- `LLM_BASE_URL`을 로컬 vLLM endpoint로 설정하면 프라이버시/비용 최적화 가능

## Codex CLI 기반 루프
- `bin/codex-autofix` 제공: Plan→Diff→Verify(ruff/mypy/pytest) 자동화
- 사용법: `chmod +x bin/codex-autofix && bin/codex-autofix 2`

