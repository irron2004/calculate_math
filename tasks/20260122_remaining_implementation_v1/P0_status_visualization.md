# P0-2: 상태 시각화 완성

## 목표
학생이 그래프에서 각 노드의 학습 상태를 한눈에 파악할 수 있게 한다.

## 현재 상태
- LearningNodeLabel.tsx 존재
- 기본 렌더링만 구현
- **상태별 색상/아이콘 미구현**

## 학습 상태 정의

| 상태 | 조건 | 색상 | 아이콘 |
|------|------|------|--------|
| `locked` | 선수 노드 미완료 | 회색 (#9CA3AF) | 🔒 잠금 |
| `available` | 선수 노드 완료, 아직 시작 안함 | 파랑 (#3B82F6) | ▶️ 시작 가능 |
| `in_progress` | 시작했으나 미완료 | 노랑 (#F59E0B) | ⏳ 진행중 |
| `completed` | 통과 기준 달성 | 초록 (#10B981) | ✓ 완료 |

## 구현 항목

### 1. 상태 계산 로직
```typescript
// src/lib/progress/nodeStatus.ts
type NodeStatus = 'locked' | 'available' | 'in_progress' | 'completed';

function calculateNodeStatus(
  nodeId: string,
  progress: ProgressData,
  graph: SkillGraph
): NodeStatus {
  const node = graph.nodes.find(n => n.id === nodeId);
  const prereqs = getPrerequisites(nodeId, graph);

  // 모든 선수 노드가 completed인지 확인
  const allPrereqsCompleted = prereqs.every(
    p => progress[p]?.status === 'completed'
  );

  if (!allPrereqsCompleted) return 'locked';

  const nodeProgress = progress[nodeId];
  if (!nodeProgress) return 'available';
  if (nodeProgress.status === 'completed') return 'completed';
  return 'in_progress';
}
```

### 2. LearningNodeLabel 스타일링
```tsx
// src/components/LearningNodeLabel.tsx
const statusStyles: Record<NodeStatus, string> = {
  locked: 'bg-gray-200 text-gray-500 border-gray-300',
  available: 'bg-blue-100 text-blue-700 border-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-400',
  completed: 'bg-green-100 text-green-700 border-green-400',
};

const statusIcons: Record<NodeStatus, ReactNode> = {
  locked: <LockIcon className="w-4 h-4" />,
  available: <PlayIcon className="w-4 h-4" />,
  in_progress: <ClockIcon className="w-4 h-4" />,
  completed: <CheckIcon className="w-4 h-4" />,
};
```

### 3. LearningStatusLegend 컴포넌트
```tsx
// src/components/LearningStatusLegend.tsx
export function LearningStatusLegend() {
  return (
    <div className="flex gap-4 p-2 bg-white rounded shadow">
      <LegendItem color="gray" icon="🔒" label="잠김" />
      <LegendItem color="blue" icon="▶️" label="시작 가능" />
      <LegendItem color="yellow" icon="⏳" label="진행중" />
      <LegendItem color="green" icon="✓" label="완료" />
    </div>
  );
}
```

### 4. 진행률 바 (선택)
```tsx
// 노드 내부에 미니 진행률 바 표시
<div className="w-full h-1 bg-gray-200 rounded">
  <div
    className="h-full bg-green-500 rounded"
    style={{ width: `${correctRate}%` }}
  />
</div>
```

## 테스트 시나리오

1. 학생 로그인 → 그래프 페이지 진입
2. 완료한 노드는 초록색 + 체크 아이콘
3. 시작 가능한 노드는 파란색 + 시작 아이콘
4. 선수 미완료 노드는 회색 + 잠금 아이콘
5. 범례 패널에서 색상 의미 확인 가능

## 관련 파일
- `src/components/LearningNodeLabel.tsx`
- `src/components/LearningStatusLegend.tsx` (신규)
- `src/lib/progress/nodeStatus.ts` (신규)
- `src/pages/GraphPage.tsx`
