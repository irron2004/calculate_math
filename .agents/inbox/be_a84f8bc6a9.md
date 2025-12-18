# Backend Dev Request a84f8bc6a9

너는 Backend Dev다. 이 리포의 `backend/` 영역(FastAPI/DB)을 중심으로 작업한다.
원칙: **TDD(Red → Green → Refactor)**, 명확한 API 계약, 회귀 방지 테스트.

[티켓 파일]
/mnt/c/Users/irron/Desktop/my/english_egg/tasks/task1/tickets/BE-1.md

위 파일을 직접 읽고, 티켓의 AC/TDD 계획을 따라 구현해라.

[이전 QA 피드백]
- Tests: ./.venv/bin/python -m pytest backend/tests 실행해 12/12 통과(경
    고는 FastAPI/Pydantic/httpx의 deprecated 알림뿐, 실패 없음).
  - Config: backend/src/config.py에서 DATABASE_URL을 필수로 검증하고(://
    포함 여부), 누락/부적합 시 RuntimeError로 즉시 중단; 세션(backend/src/
    db/session.py)도 이 설정을 그대로 사용.
  - Health: backend/src/main.py의 GET /health가 앱 버전과 DB 연결 여부
    (SELECT 1 성공 여부 기반)를 200으로 반환, 실패 시 db_status=False
    처리.
  - Migrations CLI: backend/src/cli.py에 create-baseline/upgrade/downgrade
    추가, 로컬/스테이징 URL 선택 또는 직접 지정 가능; 테스트에서 베이스라
    인 생성→적용→롤백이 sqlite 임시 DB에서 정상 동작 확인.
  - Dev 서버: cd backend && DATABASE_URL=... uvicorn backend.src.main:app
    --reload로 env 기반 DB에 붙으며, 스타트업 시 개발 편의를 위해 테이블을
    자동 생성.
  - Notes: 초기 pytest 미설치라 .venv 생성 후 ./.venv/bin/python -m pip
    install -r backend/requirements.txt로 의존성 준비 후 테스트 진행.

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

###BEGIN:a84f8bc6a9###
[QA 전달]
- 변경 요약:
- 변경 파일:
- 실행 방법:
- 테스트 방법:
- 확인 포인트(AC 매핑):
[/QA 전달]
###DONE:a84f8bc6a9###
