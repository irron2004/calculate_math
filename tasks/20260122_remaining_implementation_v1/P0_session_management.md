# P0-4: 학습 세션 관리 (임시저장/이어풀기)

## 목표
학생이 문제를 풀다가 나가도 답안이 유지되고, 재방문 시 이어서 풀 수 있게 한다.

## 현재 상태
- LearnPage.tsx에서 답안 입력 가능
- 페이지 이탈 시 답안 소실
- **임시저장/복원 로직 미구현**

## 구현 항목

### 1. 세션 스토리지 모듈
```typescript
// src/lib/learn/sessionStorage.ts

interface DraftSession {
  nodeId: string;
  answers: Record<string, string>; // problemId → answer
  savedAt: number; // timestamp
}

const DRAFT_KEY_PREFIX = 'learn_draft_';

export function saveDraft(userId: string, nodeId: string, answers: Record<string, string>) {
  const key = `${DRAFT_KEY_PREFIX}${userId}_${nodeId}`;
  const session: DraftSession = {
    nodeId,
    answers,
    savedAt: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(session));
}

export function loadDraft(userId: string, nodeId: string): DraftSession | null {
  const key = `${DRAFT_KEY_PREFIX}${userId}_${nodeId}`;
  const data = localStorage.getItem(key);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function clearDraft(userId: string, nodeId: string) {
  const key = `${DRAFT_KEY_PREFIX}${userId}_${nodeId}`;
  localStorage.removeItem(key);
}
```

### 2. 자동 저장 (디바운스)
```typescript
// LearnPage.tsx

const debouncedSave = useMemo(
  () => debounce((answers: Record<string, string>) => {
    saveDraft(userId, nodeId, answers);
  }, 1000), // 1초 디바운스
  [userId, nodeId]
);

// 답안 변경 시 자동 저장
useEffect(() => {
  debouncedSave(answers);
}, [answers, debouncedSave]);
```

### 3. 이어풀기 복원
```typescript
// LearnPage.tsx

useEffect(() => {
  const draft = loadDraft(userId, nodeId);
  if (draft) {
    setShowRestoreModal(true);
    setPendingDraft(draft);
  }
}, [userId, nodeId]);

const handleRestore = () => {
  setAnswers(pendingDraft.answers);
  setShowRestoreModal(false);
};

const handleDiscard = () => {
  clearDraft(userId, nodeId);
  setShowRestoreModal(false);
};
```

### 4. DraftRestoreModal 컴포넌트
```tsx
// src/components/DraftRestoreModal.tsx

interface Props {
  isOpen: boolean;
  savedAt: Date;
  onRestore: () => void;
  onDiscard: () => void;
}

export function DraftRestoreModal({ isOpen, savedAt, onRestore, onDiscard }: Props) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>이전 답안이 있습니다</h3>
        <p>
          {formatDate(savedAt)}에 저장된 답안을 불러오시겠습니까?
        </p>
        <div className="flex gap-2">
          <button onClick={onRestore} className="btn-primary">
            이어서 풀기
          </button>
          <button onClick={onDiscard} className="btn-secondary">
            처음부터 풀기
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 5. 제출 완료 시 초기화
```typescript
const handleSubmit = async () => {
  const result = await submitAnswers(answers);
  clearDraft(userId, nodeId); // 제출 성공 시 draft 삭제
  navigate(`/eval/${nodeId}`);
};
```

### 6. 브라우저 종료 경고 (선택)
```typescript
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (Object.keys(answers).length > 0) {
      e.preventDefault();
      e.returnValue = ''; // 표준 메시지 표시
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [answers]);
```

## 테스트 시나리오

1. 학생이 문제 3개 중 2개 입력
2. 브라우저 탭 닫기
3. 다시 같은 페이지 방문
4. "이전 답안이 있습니다" 모달 표시
5. "이어서 풀기" 클릭 → 2개 답안 복원됨
6. 제출 완료 후 다시 방문 → 모달 안 뜸

## 관련 파일
- `src/lib/learn/sessionStorage.ts` (신규)
- `src/pages/LearnPage.tsx`
- `src/components/DraftRestoreModal.tsx` (신규)
