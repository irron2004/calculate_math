# P1-3: UX 개선

## 목표
문제 풀이 과정의 사용성을 개선한다.

## 구현 항목

### 1. 미입력 안내 모달
```tsx
// src/components/UnansweredModal.tsx

interface Props {
  unanswered: number[]; // 미입력 문항 번호
  onContinue: () => void; // 그래도 제출
  onCancel: () => void;   // 돌아가기
}

export function UnansweredModal({ unanswered, onContinue, onCancel }: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>미입력 문항이 있습니다</h3>
        <p>
          {unanswered.join(', ')}번 문제를 입력하지 않았습니다.
          그래도 제출하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-primary">
            돌아가서 입력하기
          </button>
          <button onClick={onContinue} className="btn-secondary">
            그냥 제출하기
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 2. 제출 확인 모달
```tsx
// src/components/SubmitConfirmModal.tsx

export function SubmitConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>제출하시겠습니까?</h3>
        <p>제출 후에는 답을 수정할 수 없습니다.</p>
        <div className="flex gap-2">
          <button onClick={onConfirm} className="btn-primary">
            제출하기
          </button>
          <button onClick={onCancel} className="btn-secondary">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. 다시 풀기 버튼
```tsx
// EvalPage.tsx

<button
  onClick={() => {
    clearDraft(userId, nodeId);
    navigate(`/learn/${nodeId}`);
  }}
  className="btn-secondary"
>
  다시 풀기
</button>
```

### 4. 로딩/에러 상태
```tsx
// 로딩 스피너
{isLoading && (
  <div className="flex items-center justify-center p-8">
    <Spinner />
    <span className="ml-2">불러오는 중...</span>
  </div>
)}

// 에러 메시지
{error && (
  <div className="p-4 bg-red-100 text-red-700 rounded">
    {error.message}
    <button onClick={retry}>다시 시도</button>
  </div>
)}
```

## 관련 파일
- `src/components/UnansweredModal.tsx` (신규)
- `src/components/SubmitConfirmModal.tsx` (신규)
- `src/components/Spinner.tsx` (신규)
- `src/pages/LearnPage.tsx`
- `src/pages/EvalPage.tsx`
