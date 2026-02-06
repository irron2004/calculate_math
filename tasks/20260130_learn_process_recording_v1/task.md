---
workflow: code
graph_profile: frontend
---

# PRD — 풀이 과정 기록 기능 (레벨 2)

## 목적 (MVP)
- 학생이 문제를 풀 때 **어떤 문항에서 오래 걸렸고**, **몇 번 답을 바꿨고**, **어떤 메모(필기)를 남겼는지**를 문항 단위로 기록한다.
- 레벨 2 정의: 문항별 스냅샷/메모 + 행동 로그 (리플레이 기능은 레벨 3으로 제외)

## 레벨 2에서 기록할 데이터

문항별(ProblemAttempt)로 다음 3개를 저장:

1. **timeSpentMs** — 해당 문항에 집중한 시간
2. **answerEditCount** — 답을 고쳐 쓴 횟수
3. **scratchpadStrokesJson** — 필기 메모 (스트로크 데이터 JSON, 이미지 아님)

## UI/UX 설계

### 화면 레이아웃
- **왼쪽 50%**: 문제 리스트 + 주관식 입력 (기존)
- **오른쪽 50%**: 문항별 메모장 (펜 입력)

### 문항별 메모장 UX
- 학생이 3번 문제 입력칸을 클릭 → 오른쪽 메모장이 "3번 메모"로 전환
- 4번으로 넘어가면 → "4번 메모"로 전환
- 다시 3번으로 가면 → 3번에 적었던 필기가 그대로 복원

### 메모장 도구 (초3 친화적 최소 구성)
- 펜 (굵기 2~3단계)
- 전체 지우기
- 되돌리기 (Undo)

## 시간 측정 규칙

- `activeProblemId`를 하나 유지
- 전환 트리거:
  1. 문항 입력칸 focus
  2. 문항 카드/번호 클릭
  3. 해당 문항의 메모장에서 pen stroke 시작
- active가 바뀌는 순간: `직전 문항의 timeSpentMs += (now - activeStartedAt)`
- 탭 백그라운드 시(`visibilitychange`) 타이머 일시정지

## 답 수정 횟수 측정 규칙

- 입력칸 `focus` 시점에 `valueAtFocus` 저장
- `blur` 시점에 값이 바뀌었으면 `answerEditCount += 1`

## 데이터 모델 (AttemptResponse 확장)

```typescript
type AttemptResponse = {
  problemId: string
  inputRaw: string
  updatedAt: string
  // 레벨 2 추가
  timeSpentMs: number
  answerEditCount: number
  scratchpadStrokesJson: string | null
}
```

## 현재 구조 참고

- 학습 데이터는 **Frontend localStorage**에만 저장 (Backend 제출 API 없음)
- 채점은 클라이언트 사이드에서 처리
- 주요 파일:
  - `/curriculum-viewer/src/pages/LearnPage.tsx`
  - `/curriculum-viewer/src/lib/studentLearning/types.ts`
  - `/curriculum-viewer/src/lib/studentLearning/attemptSession.ts`

## 비범위 (Non-goals)
- 필기 리플레이 (타임라인 재생) — 레벨 3
- Backend API 연동 — 추후 작업
- 이미지 저장 — 스트로크 JSON만 저장

## Commands
- run: `cd curriculum-viewer && npm run dev`
- test: `cd curriculum-viewer && npm run test`
