import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SkillTreePage from '../SkillTreePage';
import type { SkillTreeResponse } from '../../types';
import { fetchSkillTree } from '../../utils/api';
import { trackExperimentExposure } from '../../utils/analytics';

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
  ],
  progress: sampleProgress,
  experiment: {
    name: 'skill_tree_layout',
    variant: 'list',
    source: 'assignment',
    request_id: 'req-1',
    rollout: 50,
    bucket: 12,
  },
};

describe('SkillTreePage', () => {
  beforeEach(() => {
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

    await waitFor(() =>
      expect(screen.getByTestId('skill-tree-page')).toHaveAttribute('data-experiment-variant', 'list')
    );
    expect(screen.getByText('C01·S1 자리가치·분해')).toBeInTheDocument();
    expect(screen.getByText(/필요 스킬/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '학습 시작' })).toBeEnabled();
    expect(screen.getByText(/총 XP 150/)).toBeInTheDocument();

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

    await waitFor(() =>
      expect(screen.getByTestId('skill-tree-page')).toHaveAttribute('data-experiment-variant', 'tree')
    );
    expect(mockedTrackExperimentExposure).not.toHaveBeenCalled();
  });

  it('navigates with session parameters when starting an available node', async () => {
    mockedFetchSkillTree.mockResolvedValue(sampleResponse);

    render(
      <MemoryRouter>
        <SkillTreePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('C01·S1 자리가치·분해')).toBeInTheDocument());

    const button = screen.getByRole('button', { name: '학습 시작' });
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const destination = mockNavigate.mock.calls[0][0] as string;
    expect(destination).toContain('skill=C01-S1');
    expect(destination).toContain('concept=ALG-AP');
    expect(destination).toContain('step=S1');
    expect(destination).toContain('session=');
  });
});
