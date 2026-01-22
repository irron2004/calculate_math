# P2: 선택 기능

## 1. LaTeX 렌더링 (KaTeX)

### 설치
```bash
npm install katex
npm install @types/katex --save-dev
```

### 구현
```tsx
// src/components/MathRenderer.tsx
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  content: string;
}

export function MathRenderer({ content }: Props) {
  const html = useMemo(() => {
    // $...$ 또는 $$...$$ 패턴을 KaTeX로 변환
    return content.replace(/\$\$(.*?)\$\$|\$(.*?)\$/g, (match, block, inline) => {
      const tex = block || inline;
      const displayMode = !!block;
      try {
        return katex.renderToString(tex, { displayMode });
      } catch {
        return match; // 파싱 실패 시 원본 반환
      }
    });
  }, [content]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

### 사용
```tsx
<MathRenderer content="분수 $\frac{1}{2}$을 소수로 변환하시오." />
```

---

## 2. 문제별 해설 표시

### 데이터 구조
```json
{
  "id": "prob-001",
  "content": "1 + 1 = ?",
  "answer": "2",
  "explanation": "1에 1을 더하면 2가 됩니다."
}
```

### 구현
```tsx
// EvalResultList.tsx

{results.map((r, i) => (
  <div key={r.problemId} className="p-4 border rounded">
    <div className="flex justify-between">
      <span>{i + 1}번</span>
      <span className={r.isCorrect ? 'text-green-600' : 'text-red-600'}>
        {r.isCorrect ? '정답' : '오답'}
      </span>
    </div>

    {!r.isCorrect && r.explanation && (
      <details className="mt-2">
        <summary className="cursor-pointer text-blue-600">해설 보기</summary>
        <div className="mt-2 p-2 bg-gray-50 rounded">
          <MathRenderer content={r.explanation} />
        </div>
      </details>
    )}
  </div>
))}
```

---

## 3. 고급 검증 규칙

### 사이클 감지
```typescript
// src/lib/curriculum/validate.ts

export function detectCycles(graph: SkillGraph): string[][] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(nodeId: string, path: string[]): boolean {
    if (stack.has(nodeId)) {
      cycles.push([...path, nodeId]);
      return true;
    }
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    stack.add(nodeId);

    const outgoing = graph.edges.filter(e => e.source === nodeId);
    for (const edge of outgoing) {
      dfs(edge.target, [...path, nodeId]);
    }

    stack.delete(nodeId);
    return false;
  }

  for (const node of graph.nodes) {
    dfs(node.id, []);
  }

  return cycles;
}
```

### 고아 노드 검출
```typescript
export function findOrphanNodes(graph: SkillGraph): string[] {
  const connectedIds = new Set<string>();

  for (const edge of graph.edges) {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }

  return graph.nodes
    .filter(n => !connectedIds.has(n.id))
    .map(n => n.id);
}
```

### 중복 엣지 검출
```typescript
export function findDuplicateEdges(graph: SkillGraph): Edge[] {
  const seen = new Set<string>();
  const duplicates: Edge[] = [];

  for (const edge of graph.edges) {
    const key = `${edge.source}-${edge.target}`;
    if (seen.has(key)) {
      duplicates.push(edge);
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}
```

---

## 4. Author Preview 고급

### 가능한 노드 패널
```tsx
// 현재 선택된 노드에서 연결 가능한 후보 노드 목록
const availableTargets = useMemo(() => {
  if (!selectedNode) return [];
  const existingTargets = new Set(
    edges.filter(e => e.source === selectedNode.id).map(e => e.target)
  );
  return nodes.filter(n =>
    n.id !== selectedNode.id &&
    !existingTargets.has(n.id)
  );
}, [selectedNode, nodes, edges]);
```

### 레이아웃 저장
```typescript
// 사용자가 드래그한 위치를 저장
const saveLayout = (positions: Record<string, { x: number; y: number }>) => {
  localStorage.setItem(`layout_${graphId}`, JSON.stringify(positions));
};

const loadLayout = (graphId: string) => {
  const saved = localStorage.getItem(`layout_${graphId}`);
  return saved ? JSON.parse(saved) : null;
};
```

---

## 관련 파일
- `src/components/MathRenderer.tsx` (신규)
- `src/components/EvalResultList.tsx`
- `src/lib/curriculum/validate.ts`
- `src/pages/AuthorEditorPage.tsx`
