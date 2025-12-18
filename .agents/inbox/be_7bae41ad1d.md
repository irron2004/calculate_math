# Backend Dev Request 7bae41ad1d

너는 Backend Dev다. 이 리포의 `backend/` 영역(FastAPI/DB)을 중심으로 작업한다.
원칙: **TDD(Red → Green → Refactor)**, 명확한 API 계약, 회귀 방지 테스트.

[티켓 파일]
/mnt/c/Users/irron/Desktop/my/english_egg/tasks/task1/tickets/BE-1.md

위 파일을 직접 읽고, 티켓의 AC/TDD 계획을 따라 구현해라.

[이전 QA 피드백]
- Tests: .venv/bin/python -m pytest backend/tests 실행해 12/12 통과(Dev
    제시 경로는 없어서 로컬 venv 사용). 로그는 deprecated 경고(FastAPI/
    Pydantic/httpx/utcnow)만 발생, 실패 없음.
  - Health: GET /health가 버전/DB 상태 반환하며 DB 연결 실패 시
    db_status=False로 응답. DB URL은 env에서 읽고 미설정/형식 오류 시
    RuntimeError로 즉시 중단.
  - Migrations CLI: create-baseline/upgrade/downgrade 흐름이 테스트에서 임
    시 sqlite DB로 생성→적용→롤백까지 성공, 로컬·staging URL 선택/직접 지
    정 로직 포함.
  - Dev 서버: cd backend && DATABASE_URL=... uvicorn backend.src.main:app
    --reload로 env 기반 DB에 붙으며 스타트업에 개발 편의를 위한 테이블 자
    동 생성.

[이전 Reviewer 피드백]
(없음)

해야 할 일:
1) 티켓 AC를 기준으로 “실패하는 테스트(Red)”부터 작성한다.
   - FastAPI라면 `pytest` + `fastapi.testclient`(또는 `httpx`) 기반 테스트를 우선 고려.
2) 최소 구현(Green)으로 통과시킨다.
3) 리팩터(Refactor)로 구조/가독성/에러처리 개선.
4) DB/환경변수/외부 API(OpenAI 등) 의존이 있으면:
   - 테스트 더블/fixture로 격리하거나,
   - 최소한의 통합 테스트 전략을 제시한다.
5) 실행/테스트 방법을 항상 명시한다.

출력 규칙:
- 마지막 출력은 반드시 아래 마커 블록을 포함한다.
- `변경 파일`에는 실제 수정/추가한 파일 경로를 모두 적는다.

###BEGIN:7bae41ad1d###
[QA 전달]
- 변경 요약:
- 변경 파일:
- 실행 방법:
- 테스트 방법:
- 확인 포인트(AC 매핑):
[/QA 전달]
###DONE:7bae41ad1d###
