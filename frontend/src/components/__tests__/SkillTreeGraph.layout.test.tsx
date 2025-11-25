import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import SkillTreeGraph from '../SkillTreeGraph';
import type { SkillTreeGraphNodeView, SkillTreeGraphTree, SkillTreeEdge } from '../../types';

// ELK 레이아웃을 단순화해 레이아웃 비동기 영향 없이 fallback 레이아웃을 사용하도록 mock
vi.mock('elkjs/lib/elk.bundled.js', () => ({
  default: class MockElk {
    async layout() {
      return { children: [] };
    }
  },
}));

const palette = { math: '#2563eb' };

const baseNode = {
  lens: ['math'],
  boss: false,
  grid: { row: 0, col: 0 },
  xp: { per_try: 1, per_correct: 2 },
  requires: [],
  teaches: [],
  progress: null,
  state: 'unlocked' as const,
  resolvedState: 'unlocked' as const,
};

const nodes: SkillTreeGraphNodeView[] = [
  {
    ...baseNode,
    id: 'n1',
    tree: 'g1',
    tier: 1,
    label: 'C01 S1 덧셈 기초',
  },
  {
    ...baseNode,
    id: 'n2',
    tree: 'g1',
    tier: 1,
    label: 'C01 S2 곱셈 도입',
    grid: { row: 1, col: 0 },
  },
  {
    ...baseNode,
    id: 'n3',
    tree: 'g1',
    tier: 2,
    label: 'C02 S1 분수',
  },
];

const trees: SkillTreeGraphTree[] = [{ id: 'g1', label: '수와 연산', order: 1 }];
const edges: SkillTreeEdge[] = [];

describe('SkillTreeGraph layout', () => {
  it('짧은 라벨을 사용하고 같은 티어는 같은 열에 정렬한다', async () => {
    render(
      <SkillTreeGraph
        nodes={nodes}
        edges={edges}
        trees={trees}
        palette={palette}
        onStart={vi.fn()}
      />,
    );

    const tier1First = await screen.findByText('S1 덧셈 기초');
    const tier1Second = await screen.findByText('S2 곱셈 도입');
    const tier2First = await screen.findByText('S1 분수');

    expect(tier1First.textContent).not.toContain('C01');

    const tier1FirstCard = tier1First.closest('article')!;
    const tier1SecondCard = tier1Second.closest('article')!;
    const tier2FirstCard = tier2First.closest('article')!;

    // 같은 티어(1)는 같은 x 좌표(열)에 배치된다.
    expect(tier1FirstCard.style.left).toBe(tier1SecondCard.style.left);
    expect(tier1FirstCard.style.left).toBe('40px');

    // 같은 열에서 행이 내려가며 ROW_GAP(120px) 만큼 간격이 난다.
    expect(tier1SecondCard.style.top).toBe('120px');

    // 티어 2는 다음 열로 이동한다.
    expect(tier2FirstCard.style.left).toBe('220px');
  });
});
