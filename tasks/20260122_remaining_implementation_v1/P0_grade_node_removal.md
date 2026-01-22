# P0-3: Grade 노드 제거

## 목표
그래프에서 type === 'grade' 노드를 숨기고, 해당 노드를 거치는 엣지를 스킵 엣지로 변환한다.

## 현재 상태
- Grade 노드가 그래프에 그대로 표시됨
- 불필요한 시각적 노이즈 발생
- **필터링/스킵 엣지 로직 미구현**

## 구현 항목

### 1. Grade 노드 필터링
```typescript
// src/lib/curriculum/graphLayout.ts

export function filterGradeNodes(graph: SkillGraph): SkillGraph {
  const gradeNodeIds = new Set(
    graph.nodes
      .filter(n => n.type === 'grade')
      .map(n => n.id)
  );

  const filteredNodes = graph.nodes.filter(n => n.type !== 'grade');

  // 엣지도 필터링 (grade 노드 참조 제거)
  const filteredEdges = graph.edges.filter(
    e => !gradeNodeIds.has(e.source) && !gradeNodeIds.has(e.target)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}
```

### 2. 스킵 엣지 생성
Grade 노드를 거치는 연결을 직접 연결로 변환:

```
Before: A → Grade → B
After:  A → B (skip edge)
```

```typescript
export function createSkipEdges(graph: SkillGraph): Edge[] {
  const gradeNodeIds = new Set(
    graph.nodes.filter(n => n.type === 'grade').map(n => n.id)
  );

  const skipEdges: Edge[] = [];

  for (const gradeId of gradeNodeIds) {
    // grade로 들어오는 엣지들
    const incoming = graph.edges.filter(e => e.target === gradeId);
    // grade에서 나가는 엣지들
    const outgoing = graph.edges.filter(e => e.source === gradeId);

    // 조합해서 스킵 엣지 생성
    for (const inEdge of incoming) {
      for (const outEdge of outgoing) {
        skipEdges.push({
          id: `skip-${inEdge.source}-${outEdge.target}`,
          source: inEdge.source,
          target: outEdge.target,
          type: 'skip', // 스타일 구분용
        });
      }
    }
  }

  return skipEdges;
}
```

### 3. 통합 함수
```typescript
export function processGraphForDisplay(graph: SkillGraph): SkillGraph {
  const skipEdges = createSkipEdges(graph);
  const filtered = filterGradeNodes(graph);

  return {
    nodes: filtered.nodes,
    edges: [...filtered.edges, ...skipEdges],
  };
}
```

### 4. 레이아웃 재계산
Grade 노드 제거 후 dagre 레이아웃 재실행:

```typescript
const processedGraph = processGraphForDisplay(rawGraph);
const layoutedGraph = applyDagreLayout(processedGraph);
```

## 스킵 엣지 스타일링 (선택)
```tsx
// 스킵 엣지는 점선으로 표시
const edgeStyles = {
  skip: { strokeDasharray: '5,5', stroke: '#9CA3AF' },
  requires: { stroke: '#3B82F6' },
  prepares_for: { stroke: '#10B981' },
};
```

## 테스트 시나리오

1. 그래프 데이터에 grade 노드 포함
2. 페이지 로드 시 grade 노드 안 보임
3. grade를 거치던 연결이 스킵 엣지로 표시됨
4. 레이아웃이 자연스럽게 정렬됨

## 관련 파일
- `src/lib/curriculum/graphLayout.ts`
- `src/pages/GraphPage.tsx`
- `src/components/CurriculumGraphView.tsx`
