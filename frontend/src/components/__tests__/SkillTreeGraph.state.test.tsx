import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import SkillTreeGraph from '../SkillTreeGraph';
import type { SkillTreeGraphNodeView, SkillTreeGraphTree, SkillTreeEdge } from '../../types';

// 레이아웃 비동기 의존성을 줄이기 위해 ELK를 단순 mock
vi.mock('elkjs/lib/elk.bundled.js', () => ({
  default: class MockElk {
    async layout() {
      return { children: [] };
    }
  },
}));

const palette = { math: '#2563eb' };

const baseNode: Omit<SkillTreeGraphNodeView, 'id' | 'tree' | 'tier' | 'label' | 'resolvedState' | 'state'> = {
  lens: ['math'],
  boss: false,
  grid: { row: 0, col: 0 },
  xp: { per_try: 1, per_correct: 2 },
  requires: [],
  teaches: [],
  progress: null,
};

const trees: SkillTreeGraphTree[] = [{ id: 'g1', label: '수와 연산', order: 1 }];
const edges: SkillTreeEdge[] = [];

describe('SkillTreeGraph node 상태 표현', () => {
  it('unlockable 노드는 반짝임(shimmer) 표시와 활성 버튼을 가진다', async () => {
    const nodes: SkillTreeGraphNodeView[] = [
      {
        ...baseNode,
        id: 'u1',
        tree: 'g1',
        tier: 1,
        label: 'C01 S1 덧셈 기초',
        state: 'unlockable',
        resolvedState: 'unlockable',
      },
    ];

    render(
      <SkillTreeGraph nodes={nodes} edges={edges} trees={trees} palette={palette} onStart={vi.fn()} />,
    );

    const card = await screen.findByRole('article');
    const button = await screen.findByRole('button', { name: '학습 시작' });

    expect(card.getAttribute('data-state')).toBe('unlockable');
    // 새로운 시각 효과가 적용됐는지 데이터 속성으로 표시해야 한다.
    expect(card.getAttribute('data-shimmer')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('locked 노드는 muted 표시가 있고 버튼은 비활성화된다', async () => {
    const nodes: SkillTreeGraphNodeView[] = [
      {
        ...baseNode,
        id: 'l1',
        tree: 'g1',
        tier: 1,
        label: 'C01 S2 곱셈 도입',
        state: 'locked',
        resolvedState: 'locked',
      },
    ];

    render(
      <SkillTreeGraph nodes={nodes} edges={edges} trees={trees} palette={palette} onStart={vi.fn()} />,
    );

    const card = await screen.findByRole('article');
    const button = await screen.findByRole('button', { name: '학습 시작' });

    expect(card.getAttribute('data-state')).toBe('locked');
    expect(card.getAttribute('data-muted')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('completed/mastered 노드는 활성화(active) 플래그를 갖는다', async () => {
    const nodes: SkillTreeGraphNodeView[] = [
      {
        ...baseNode,
        id: 'c1',
        tree: 'g1',
        tier: 1,
        label: 'C01 S3 항등식',
        state: 'completed',
        resolvedState: 'completed',
      },
      {
        ...baseNode,
        id: 'm1',
        tree: 'g1',
        tier: 2,
        label: 'C02 S1 분수',
        state: 'mastered',
        resolvedState: 'mastered',
      },
    ];

    render(
      <SkillTreeGraph nodes={nodes} edges={edges} trees={trees} palette={palette} onStart={vi.fn()} />,
    );

    const completed = await screen.findByRole('article', { name: /항등식/ });
    const mastered = await screen.findByRole('article', { name: /분수/ });

    expect(completed.getAttribute('data-active')).toBe('true');
    expect(mastered.getAttribute('data-active')).toBe('true');
  });
});
