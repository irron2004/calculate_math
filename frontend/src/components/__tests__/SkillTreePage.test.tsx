import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SkillTreePage from '../SkillTreePage';
import type { SkillTreeResponse } from '../../types';
import { fetchSkillTree } from '../../utils/api';
import { trackExperimentExposure } from '../../utils/analytics';
import { resetCourseConceptOverrides } from '../../utils/skillMappings';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../utils/api', () => ({
  fetchSkillTree: vi.fn(),
}));

vi.mock('../../utils/analytics', () => ({
  trackExperimentExposure: vi.fn(),
}));

const mockedFetchSkillTree = vi.mocked(fetchSkillTree);
const mockedTrackExperimentExposure = vi.mocked(trackExperimentExposure);

const sampleProgress = {
  user_id: '1',
  updated_at: '2025-01-01T09:00:00+00:00',
  total_xp: 150,
  nodes: {
    'C01-S1': {
      xp_earned: 120,
      xp_required: 120,
      level: 1,
      unlocked: true,
      completed: false,
      lrc_status: 'gold',
      lrc_metrics: { accuracy: 0.94 },
      attempts: 6,
    },
  },
  skills: {
    'AS.PV.READ': { level: 1, xp: 40 },
  },
};

const sampleResponse: SkillTreeResponse = {
  version: '2025.10',
  palette: {
    transform: '#6C5CE7',
  },
  groups: [
    {
      id: 'arithmetic',
      label: '수·연산',
      order: 1,
      course_ids: ['C01', 'C02', 'C03'],
    },
  ],
  nodes: [
    {
      id: 'C01-S1',
      label: 'C01·S1 자리가치·분해',
      course: 'C01',
      group: 'arithmetic',
      tier: 1,
      lens: ['transform'],
      primary_color: '#6C5CE7',
      requires: [
        {
          skill_id: 'AS.PV.READ',
          label: '자릿값 읽기',
          domain: '자릿값',
          lens: ['transform'],
          min_level: 1,
          current_level: 1,
          met: true,
        },
      ],
      teaches: [
        {
          skill_id: 'AS.PV.DECOMP',
          label: '분해/재구성',
          domain: '분해/재구성',
          lens: ['transform'],
          delta_level: 1,
        },
      ],
      xp: { per_try: 5, per_correct: 10 },
      lrc_min: { acc: 0.9 },
      misconceptions: ['0은 빈칸으로 착각'],
      state: {
        value: 'available',
        completed: false,
        available: true,
        unlocked: true,
      },
      session: {
        concept: 'ALG-AP',
        step: 'S1',
        problem_count: 12,
        generator: 'arithmetic',
        parameters: { op: 'add', count: 12 },
      },
      progress: sampleProgress.nodes['C01-S1'],
    },
  ],
  edges: [{ from: 'C01-S1', to: 'C01-S2' }],
  skills: [
    {
      id: 'AS.PV.READ',
      label: '자릿값 읽기',
      domain: '자릿값',
      lens: ['transform'],
      levels: 3,
      level: 1,
      xp: { per_try: 1, per_correct: 2, earned: 40 },
    },
    {
      id: 'AS.PV.DECOMP',
      label: '분해/재구성',
      domain: '분해/재구성',
      lens: ['transform'],
      levels: 3,
      level: 1,
      xp: { per_try: 1, per_correct: 2, earned: 30 },
    },
    {
      id: 'AS.MUL.POW10',
      label: '×10/×100 스케일',
      domain: '연산·스케일',
      lens: ['scale'],
      levels: 3,
      level: 1,
      xp: { per_try: 1, per_correct: 2, earned: 25 },
    },
  ],
  progress: sampleProgress,
  graph: {
    version: '2025-10-12.bipartite.v1.ui.v1',
    trees: [
      { id: 'arithmetic', label: '수와 연산', order: 1 },
      { id: 'fraction_ratio', label: '분수·소수·비율', order: 2 },
      { id: 'algebra_geo_stats', label: '대수·기하·해석·통계', order: 3 },
    ],
    nodes: [
      {
        id: 'C01-S1',
        tree: 'arithmetic',
        tier: 1,
        label: 'C01·S1 자리가치·분해',
        lens: ['transform'],
        requires: [
          { skill_id: 'AS.PV.READ', min_level: 1 },
          { skill_id: 'AS.PV.DECOMP', min_level: 1 },
          { skill_id: 'AS.MUL.POW10', min_level: 1 },
        ],
        xp: { per_try: 5, per_correct: 10 },
        boss: false,
        grid: { row: 1, col: 1 },
      },
    ],
    edges: [],
  },
  unlocked: { 'C01-S1': true },
  experiment: {
    name: 'skill_tree_layout',
    variant: 'list',
    source: 'assignment',
    request_id: 'req-1',
    rollout: 50,
    bucket: 12,
  },
};

const refreshedResponse: SkillTreeResponse = {
  ...sampleResponse,
  progress: {
    ...sampleResponse.progress,
    total_xp: 300,
    nodes: {
      ...sampleResponse.progress.nodes,
      'C01-S1': {
        ...sampleResponse.progress.nodes['C01-S1'],
        xp_earned: 200,
        level: 2,
      },
    },
  },
};

describe('SkillTreePage', () => {
  beforeEach(() => {
    resetCourseConceptOverrides();
    mockedFetchSkillTree.mockReset();
    mockedTrackExperimentExposure.mockReset();
    mockNavigate.mockReset();
  });

  it('renders experiment variant and tracks exposure metadata', async () => {
    mockedFetchSkillTree.mockResolvedValue(sampleResponse);

    render(
      <MemoryRouter>
        <SkillTreePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const page = screen.getByTestId('skill-tree-page');
      expect(page.getAttribute('data-experiment-variant')).toBe('list');
    });
    expect(screen.queryByTestId('skill-tree-graph')).not.toBeNull();
    expect(screen.queryByText('C01·S1 자리가치·분해')).not.toBeNull();
    expect(screen.queryByText(/필요 조건:/)).not.toBeNull();
    expect(screen.getByRole('button', { name: '학습 시작' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText(/총 XP 150/)).not.toBeNull();

    expect(mockedTrackExperimentExposure).toHaveBeenCalledTimes(1);
    expect(mockedTrackExperimentExposure).toHaveBeenLastCalledWith({
      experiment: 'skill_tree_layout',
      variant: 'list',
      source: 'assignment',
      bucket: 12,
      requestId: 'req-1',
      rollout: 50,
      surface: 'skill_tree_page',
    });
  });

  it('derives a fallback layout when the UI graph specification is missing', async () => {
    mockedFetchSkillTree.mockResolvedValue({
      ...sampleResponse,
      graph: null,
    });

    render(
      <MemoryRouter>
        <SkillTreePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      screen.getByTestId('skill-tree-graph');
    });
    expect(screen.queryByText('표시할 스킬 트리 데이터가 없습니다.')).toBeNull();
    expect(screen.queryByText('C01·S1 자리가치·분해')).not.toBeNull();
  });

  it('falls back to tree variant and skips analytics when experiment data is absent', async () => {
    mockedFetchSkillTree.mockResolvedValue({
      ...sampleResponse,
      experiment: undefined,
    });

    render(
      <MemoryRouter>
        <SkillTreePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const page = screen.getByTestId('skill-tree-page');
      expect(page.getAttribute('data-experiment-variant')).toBe('tree');
    });
    expect(mockedTrackExperimentExposure).not.toHaveBeenCalled();
  });

  it('navigates with session parameters when starting an available node', async () => {
    mockedFetchSkillTree.mockResolvedValue(sampleResponse);

    render(
      <MemoryRouter>
        <SkillTreePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      screen.getByText('C01·S1 자리가치·분해');
    });

    const button = screen.getByRole('button', { name: '학습 시작' });
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const destination = mockNavigate.mock.calls[0][0] as string;
    expect(destination).toContain('skill=C01-S1');
    expect(destination).toContain('concept=ALG-AP');
    expect(destination).toContain('step=S1');
    expect(destination).toContain('session=');
  });

  it('opens a node detail overlay when graph nodes are selected', async () => {
    mockedFetchSkillTree.mockResolvedValue(sampleResponse);

    render(
      <MemoryRouter>
        <SkillTreePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      screen.getByText('C01·S1 자리가치·분해');
    });

    const node = screen.getByRole('button', { name: /C01·S1 자리가치·분해/ });
    fireEvent.click(node);

    await waitFor(() => {
      screen.getByTestId('skill-node-overlay');
    });
    expect(screen.queryByText('필요 조건')).not.toBeNull();
    expect(screen.queryByText('누적 XP 120')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => {
      expect(screen.queryByTestId('skill-node-overlay')).toBeNull();
    });
  });

  it('traps focus inside the overlay and supports closing with Escape', async () => {
    mockedFetchSkillTree.mockResolvedValue(sampleResponse);

    render(
      <MemoryRouter>
        <SkillTreePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      screen.getByText('C01·S1 자리가치·분해');
    });

    const node = screen.getByRole('button', { name: /C01·S1 자리가치·분해/ });
    node.focus();
    fireEvent.keyDown(node, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      screen.getByTestId('skill-node-overlay');
    });
    const closeButton = screen.getByRole('button', { name: '닫기' });
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('skill-node-overlay')).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(node);
    });
  });

  it('refreshes skill data when a progress update event is observed', async () => {
    mockedFetchSkillTree.mockResolvedValueOnce(sampleResponse);
    mockedFetchSkillTree.mockResolvedValueOnce(refreshedResponse);

    render(
      <MemoryRouter>
        <SkillTreePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      screen.getByText(/총 XP 150/);
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('skill-tree:progress-updated', {
          detail: { courseStepId: 'C01-S1', correct: true },
        })
      );
    });

    await waitFor(() => expect(mockedFetchSkillTree).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      screen.getByText(/총 XP 300/);
    });
    expect(screen.queryByText('진행도 갱신 중…')).toBeNull();
  });
});
