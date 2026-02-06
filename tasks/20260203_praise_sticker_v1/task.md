---
workflow: code
graph_profile: fullstack
---

# 칭찬스티커 시스템 (Demo v1)

## Goal
학생들의 학습 동기부여를 위한 칭찬스티커 시스템을 구현한다.
- 숙제를 **제시간에 제출**하고 **90점 이상**이면 자동으로 스티커 2개 지급
- 관리자가 **보너스 스티커**를 수동으로 지급할 수 있는 화면
- 스티커에 마우스를 올리면 **받은 이유**가 표시됨

> Demo 버전 전용 기능으로, 추후 정식 버전에서 확장 가능하도록 설계한다.

## Background
- 현재 숙제 시스템: `HomeworkAssignment`, `HomeworkSubmissionInfo` 타입 사용
- 숙제 리뷰 상태: `pending | approved | returned`
- 학생 정보: `/my` 페이지에서 확인 가능
- Demo 모드 판별: 기존 demo 관련 플래그 또는 환경변수 활용

## Design (Data Model)

### 1) 스티커 기록 스키마
```typescript
type PraiseSticker = {
  id: string
  studentId: string
  count: number              // 지급 개수 (보통 1~2)
  reason: string             // 지급 사유 (hover 시 표시)
  reasonType: 'homework_excellent' | 'bonus'  // 자동/수동 구분
  homeworkId?: string        // 숙제 관련 시 연결
  grantedBy?: string         // 보너스 시 관리자 ID
  grantedAt: string          // ISO timestamp
}
```

### 2) 자동 지급 조건
- **제시간 제출**: `submittedAt <= dueAt`
- **90점 이상**: 리뷰 결과 기준 (approved 상태 + 점수 계산 로직 필요)
- 지급 시점: 관리자가 숙제를 `approved`로 변경할 때

### 3) API 엔드포인트 (제안)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/students/{id}/stickers` | 학생의 스티커 목록 조회 |
| POST | `/api/students/{id}/stickers` | 보너스 스티커 지급 (관리자) |
| GET | `/api/students/{id}/sticker-summary` | 총 스티커 수 + 최근 내역 |

### 4) UI 컴포넌트
- `StickerDisplay`: 스티커 아이콘 + 개수 표시, hover 시 tooltip
- `StickerGrantModal`: 관리자용 보너스 스티커 지급 모달
- `StickerHistory`: 스티커 획득 내역 리스트

## Scope (In)
- [ ] Backend: 스티커 DB 모델 및 API 구현
- [ ] Backend: 숙제 approved 시 자동 스티커 지급 로직
- [ ] Frontend: 학생 마이페이지에 스티커 표시 (개수 + hover tooltip)
- [ ] Frontend: 관리자 화면에서 보너스 스티커 지급 UI
- [ ] Demo 모드에서만 스티커 기능 활성화

## Out of Scope
- 스티커 디자인 다양화 (v1은 단일 스티커 아이콘)
- 스티커 교환/보상 시스템
- 스티커 랭킹/리더보드
- 점수 계산 고도화 (v1은 approved = 90점 이상으로 간주)

## Acceptance Criteria
- [ ] 숙제를 제시간에 제출하고 approved 받으면 스티커 2개가 자동 지급된다
- [ ] 마이페이지에서 획득한 스티커 총 개수가 표시된다
- [ ] 스티커 아이콘에 마우스를 올리면 획득 사유가 tooltip으로 표시된다
- [ ] 관리자가 특정 학생에게 보너스 스티커를 지급할 수 있다
- [ ] 보너스 스티커 지급 시 사유를 입력할 수 있다
- [ ] Demo 모드가 아닐 때는 스티커 기능이 표시되지 않는다

## Technical Notes

### 점수 판정 (v1 간소화)
v1에서는 점수 계산 로직을 단순화한다:
- `approved` = 90점 이상으로 간주
- `returned` = 90점 미만으로 간주
- 향후 문제별 채점 시스템 도입 시 확장

### Demo 모드 판별
```typescript
// 기존 demo 판별 로직 활용 또는 새로 추가
const isDemoMode = () => {
  // localStorage, env, 또는 user role 기반
}
```

## Commands
- `cd backend && uvicorn app.main:app --reload`
- `cd curriculum-viewer && npm run dev`
- `cd curriculum-viewer && npm test`
- `cd backend && pytest`

## File Structure (예상)
```
backend/
  app/
    models.py          # PraiseSticker 모델 추가
    api.py             # 스티커 API 엔드포인트 추가

curriculum-viewer/
  src/
    lib/sticker/
      types.ts         # 스티커 타입 정의
      api.ts           # 스티커 API 호출
    components/
      StickerDisplay.tsx
      StickerGrantModal.tsx
    pages/
      MyPage.tsx       # 스티커 표시 추가
      (관리자 페이지)   # 보너스 지급 UI 추가
```
