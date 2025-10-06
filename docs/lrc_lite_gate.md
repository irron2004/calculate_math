# LRC-lite 게이트 로직 메모

Invite 생성 조건을 기존 "정확도 80%"에서 **정확 + 반응시간 + 설명** 3축으로 확장하기 위한 최소 구현안입니다.

## 1. 지표 정의
- **정확도(Accuracy)**: `정답 수 / 총 문제 수`
- **반응시간(RT)**: 문제 시작(입력/설명 필드 focus)부터 제출까지의 ms 평균
- **설명 점수(Explanation)**: 설명 칸 입력 여부(선택 사항) — 차후 키워드 매칭으로 확장 예정

## 2. 임계치 제안
| 축 | 조건 | 비고 |
|----|------|------|
| 정확도 | ≥ 85% | 기존 80%에서 상향 |
| 반응시간 | 상위 40% (혹은 평균 ≤ 35초) | 초과 시 경고 메시지 |
| 설명 | 입력 시 +5 보너스 | 빈칸이면 0 |

## 3. 게이트 판정 로직 (의사코드)
```js
function lrcLiteGate(stats) {
  const accuracyPass = stats.accuracy >= 0.85;
  const rtPass = stats.avgReactionMs <= 35000;
  const explanationBoost = stats.explanationCount > 0;

  if (accuracyPass && rtPass) {
    return explanationBoost ? 'gold' : 'silver';
  }
  if (accuracyPass || rtPass) {
    return 'pending';
  }
  return 'retry';
}
```

- `gold`: Invite 즉시 발급 + QR 노출
- `silver`: Invite 발급, 설명 입력 권장 메시지
- `pending`: 동형 3형제 추천 후 재도전 안내
- `retry`: S1 반복 또는 S2 브리지 추천

## 4. UI 업데이트 노트
- 요약 카드에 `정확`, `RT`, `설명` 세 개 게이지 추가
- Invite 버튼 툴팁/문구를 등급에 맞춰 변경 (예: Gold/Silver)
- 경고 메시지 예시: "평균 반응시간 37초 — 설명을 먼저 생각하며 풀어볼까요?"

## 5. 데이터 수집
- 프런트: `problem:rt`, `problem:explanation` 콘솔 이벤트를 Matomo/GA4 커스텀 이벤트로 전송 예정
- 백엔드: Invite 생성 API에 `accuracy`, `avg_rt`, `explanation_count` 전달하도록 확장 (차후)
