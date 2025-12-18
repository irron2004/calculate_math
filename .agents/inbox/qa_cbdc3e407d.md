# QA Request cbdc3e407d

아래 티켓과 Dev 전달 내용을 기준으로 검증해줘.

[티켓 파일]
/mnt/c/Users/irron/Desktop/my/english_egg/tasks/task1/tickets/BE-6-
  2.md

[Dev 전달 내용]
[QA 전달]

  - 변경 요약: Push subscribe/test endpoints now validate
    and upsert subscriptions, return metadata (including
    lastSuccessAt), call the stubbed sender, and persist
    NotificationLog entries with status/HTTP codes; tests
    cover validation, upsert, and logging behaviors, and
    new dev dependencies support the suite.
  - 변경 파일: backend/src/api/v1/push.py; backend/src/
    db/models/entities.py; backend/src/db/models/init.py;
    backend/src/schemas/api.py; backend/src/services/
    push.py; backend/tests/conftest.py; backend/tests/
    test_push.py; backend/requirements.txt
  - 실행 방법: uvicorn backend.src.main:app --reload
  - 테스트 방법: python -m pytest backend (pending:
    dependency install /tmp/ee-venv/bin/pip install
    -r backend/requirements.txt failed with repeated
    “Temporary failure in name resolution” while fetching
    fastapi)
  - 확인 포인트(AC 매핑): 1) /push/subscribe validates
    required fields, upserts by device, and surfaces
    metadata/lastSuccessAt (backend/src/api/v1/
    push.py:35-144, backend/src/schemas/api.py:165-
    185); 2) /push/test exercises the sender, writes
    NotificationLog entries with status codes/
    messages, and returns the log ID (backend/src/
    api/v1/push.py:107-144, backend/src/db/models/
    entities.py:177-213); 3) New pytest coverage catches
    validation failures, upserts, and log creation
    (backend/tests/test_push.py:1-92, fixture at backend/
    tests/conftest.py:10-33).
    [/QA 전달]

규칙(엄수):
- 첫 줄은 반드시 OK 또는 FAIL 로 시작해라.
- 가능한 경우 Dev가 제시한 테스트 커맨드를 실제로 실행하고, 결과(성공/실패/로그 요약)를 리포트에 포함해라.
- Dev가 테스트 방법을 비워뒀거나, 변경이 있는데 테스트가 없다면 그 자체를 FAIL 사유로 삼아도 된다(특히 버그 수정/회귀 위험이 큰 변경).
- FAIL이면 반드시 포함:
  - 재현 단계
  - 어떤 로그/증상이 문제인지
  - 원인 추정
  - 수정 제안(Dev가 바로 고칠 수 있게)
- 마지막에 아래 마커를 정확히 출력해라.

###BEGIN:cbdc3e407d###
(여기에 네 QA 리포트 본문을 작성)
###DONE:cbdc3e407d###
