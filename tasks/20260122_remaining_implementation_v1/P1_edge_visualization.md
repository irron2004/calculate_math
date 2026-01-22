# P1-2: Progression Edge 시각화

## 목표
엣지 타입별로 다른 스타일을 적용하고 범례를 제공한다.

## 엣지 타입 정의

| 타입 | 의미 | 스타일 |
|------|------|--------|
| `requires` | 선수 관계 (필수) | 실선, 파랑 |
| `prepares_for` | 연계 관계 (권장) | 점선, 초록 |
| `progression` | 학년 간 진행 | 파선, 회색 |
| `skip` | Grade 우회 | 얇은 점선, 회색 |

## 구현 항목

### 1. 엣지 스타일 정의
```typescript
// src/lib/curriculum/edgeStyles.ts

export const edgeStyleMap: Record<string, React.CSSProperties> = {
  requires: {
    stroke: '#3B82F6',
    strokeWidth: 2,
  },
  prepares_for: {
    stroke: '#10B981',
    strokeWidth: 2,
    strokeDasharray: '5,5',
  },
  progression: {
    stroke: '#9CA3AF',
    strokeWidth: 1.5,
    strokeDasharray: '10,5',
  },
  skip: {
    stroke: '#D1D5DB',
    strokeWidth: 1,
    strokeDasharray: '3,3',
  },
};
```

### 2. Custom Edge 컴포넌트
```tsx
// src/components/CustomEdge.tsx
import { getBezierPath } from 'reactflow';

export function CustomEdge({ data, ...props }) {
  const style = edgeStyleMap[data.type] || edgeStyleMap.requires;
  const [path] = getBezierPath(props);

  return (
    <path
      d={path}
      style={style}
      fill="none"
      className="react-flow__edge-path"
    />
  );
}
```

### 3. EdgeLegend 컴포넌트
```tsx
// src/components/EdgeLegend.tsx

export function EdgeLegend() {
  return (
    <div className="flex flex-col gap-2 p-3 bg-white rounded shadow">
      <h4 className="font-semibold">연결선 범례</h4>
      <LegendItem style="solid-blue" label="선수 관계 (requires)" />
      <LegendItem style="dashed-green" label="연계 관계 (prepares_for)" />
      <LegendItem style="dashed-gray" label="학년 진행 (progression)" />
    </div>
  );
}
```

### 4. 학년군 필터 제거
```tsx
// GraphPage.tsx - 필터 드롭다운 제거 또는 비활성화
// 전체 학년 동시 표시
```

## 관련 파일
- `src/lib/curriculum/edgeStyles.ts` (신규)
- `src/components/CustomEdge.tsx` (신규)
- `src/components/EdgeLegend.tsx` (신규)
- `src/components/CurriculumGraphView.tsx`
- `src/pages/GraphPage.tsx`
