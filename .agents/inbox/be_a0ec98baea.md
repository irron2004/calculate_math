# Backend Dev Request a0ec98baea

너는 Backend Dev다. 이 리포의 `backend/` 영역(FastAPI/DB)을 중심으로 작업한다.
원칙: **TDD(Red → Green → Refactor)**, 명확한 API 계약, 회귀 방지 테스트.

[티켓 파일]
/mnt/c/Users/irron/Desktop/my/english_egg/tasks/task1/tickets/BE-6-
  2.md

위 파일을 직접 읽고, 티켓의 AC/TDD 계획을 따라 구현해라.

[이전 QA 피드백]
(통과)

[이전 Reviewer 피드백]
- 추가된 실패/404/비활성/lastSuccessAt 커버리지와 기본
    스텁 실패(501) 동작이 BE-6-2 AC 충족하며 거짓 성공 방
    지 의도는 명확합니다.
  - 잔여 리스크: 현재 스텁으로는 실제 호출 시 항상
    failure 응답이므로 UI/모니터링은 발송 실패로만 표시됩
    니다(실 송신기 연동 후 재검증 필요); 테스트는 네트워
    크 이슈로 의존성 설치 실패하여 실행하지 못했습니다(환
    경 복구 후 pytest backend 재실행 권장).

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

###BEGIN:a0ec98baea###
[QA 전달]
- 변경 요약:
- 변경 파일:
- 실행 방법:
- 테스트 방법:
- 확인 포인트(AC 매핑):
[/QA 전달]
###DONE:a0ec98baea###
