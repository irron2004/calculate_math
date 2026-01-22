# P1-1: 진단/통계 시스템

## 목표
학생별 태그 정답률, 취약 영역, 대시보드 통계를 제공한다.

## 구현 항목

### 1. 태그별 정답률 집계
```typescript
// src/lib/progress/diagnostics.ts

interface TagStats {
  tag: string;
  total: number;
  correct: number;
  rate: number; // 0-100
}

export function calculateTagStats(
  submissions: Submission[],
  problems: Problem[]
): TagStats[] {
  const stats = new Map<string, { total: number; correct: number }>();

  for (const sub of submissions) {
    const problem = problems.find(p => p.id === sub.problemId);
    if (!problem) continue;

    for (const tag of problem.tags || []) {
      const current = stats.get(tag) || { total: 0, correct: 0 };
      current.total++;
      if (sub.isCorrect) current.correct++;
      stats.set(tag, current);
    }
  }

  return Array.from(stats.entries()).map(([tag, data]) => ({
    tag,
    total: data.total,
    correct: data.correct,
    rate: Math.round((data.correct / data.total) * 100),
  }));
}
```

### 2. 취약 영역 분석
```typescript
export function findWeakAreas(stats: TagStats[], threshold = 60): TagStats[] {
  return stats
    .filter(s => s.rate < threshold && s.total >= 3)
    .sort((a, b) => a.rate - b.rate);
}
```

### 3. 대시보드 차트 (Recharts)
```tsx
// src/pages/DashboardPage.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

<BarChart data={tagStats} width={600} height={300}>
  <XAxis dataKey="tag" />
  <YAxis domain={[0, 100]} />
  <Bar dataKey="rate" fill="#3B82F6" />
  <Tooltip />
</BarChart>
```

### 4. nodeId별 상태 계산
```typescript
interface NodeProgress {
  nodeId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  correctRate: number;
  attemptCount: number;
}
```

## 관련 파일
- `src/lib/progress/diagnostics.ts` (신규)
- `src/pages/DashboardPage.tsx`
- `src/pages/StudentReportPage.tsx`
