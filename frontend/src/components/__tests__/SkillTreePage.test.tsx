import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SkillTreePage from '../SkillTreePage';
import { fetchSkillTree } from '../../utils/api';
import { trackExperimentExposure } from '../../utils/analytics';

vi.mock('../../utils/api', () => ({
  fetchSkillTree: vi.fn(),
}));

vi.mock('../../utils/analytics', () => ({
  trackExperimentExposure: vi.fn(),
}));

const mockedFetchSkillTree = vi.mocked(fetchSkillTree);
const mockedTrackExperimentExposure = vi.mocked(trackExperimentExposure);

const sampleNode = {
  id: 'ALG-1',
  label: '덧셈 기초',
  tier: 1,
  kind: 'core',
  requires: null,
  xp_per_try: 5,
  xp_per_correct: 10,
  xp_to_level: [10, 20],
  lens: ['ratio'],
  keywords: ['덧셈'],
  micro_skills: [],
  misconceptions: [],
  boss: null,
};

const sampleGraph = {
  version: '1.0.0',
  palette: {},
  nodes: [sampleNode],
  edges: [],
};

const sampleBipartiteGraph = {
  version: '2025-10-12',
  palette: {
    transform: '#6C5CE7',
    difference: '#E4572E',
  },
  nodes: [
    {
      type: 'course_step',
      id: 'C01-S1',
      label: 'C01·S1 자리가치·분해',
      tier: 1,
      lens: ['transform'],
      misconceptions: ['0은 빈칸'],
      xp: { per_try: 5, per_correct: 10 },
      lrc_min: { acc: 0.9 },
    },
    {
      type: 'skill',
      id: 'AS.MUL.FACTS',
      label: '곱셈 사실',
      domain: '연산',
      lens: ['difference'],
      levels: 3,
      xp_per_try: 1,
      xp_per_correct: 2,
    },
  ],
  edges: [
    { from: 'AS.MUL.FACTS', to: 'C01-S1', type: 'requires', min_level: 1 },
    { from: 'C01-S1', to: 'AS.MUL.FACTS', type: 'teaches', delta_level: 1 },
  ],
};

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
      completed: true,
      lrc_status: 'gold',
      lrc_metrics: { accuracy: 0.94 },
      attempts: 6,
    },
  },
  skills: {
    'AS.MUL.FACTS': { level: 1, xp: 40 },
  },
};

describe('SkillTreePage', () => {
  beforeEach(() => {
    mockedFetchSkillTree.mockReset();
    mockedTrackExperimentExposure.mockReset();
  });

  it('renders list variant and tracks exposure metadata', async () => {
    mockedFetchSkillTree.mockResolvedValue({
      graph: sampleGraph,
      bipartite_graph: sampleBipartiteGraph,
      progress: sampleProgress,
      unlocked: { 'C01-S1': true, 'AS.MUL.FACTS': true, 'ALG-1': false },
      experiment: {
        name: 'skill_tree_layout',
        variant: 'list',
        source: 'assignment',
        request_id: 'req-1',
        rollout: 50,
        bucket: 12,
      },
    });

    render(
      <MemoryRouter>
        <SkillTreePage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('skill-tree-page')).toHaveAttribute('data-experiment-variant', 'list')
    );
    expect(screen.getByTestId('view-toggle-course')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('C01·S1 자리가치·분해')).toBeInTheDocument();
    expect(screen.getByText(/총 XP 150/)).toBeInTheDocument();
    expect(screen.getByTestId('requirements-C01-S1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('view-toggle-atomic'));
    await waitFor(() => expect(screen.getByTestId('atomic-skills')).toBeInTheDocument());
    expect(screen.getByTestId('taught-by-AS.MUL.FACTS')).toBeInTheDocument();
    expect(screen.getByText('리스트 보기로 렌즈와 티어를 빠르게 확인하고 바로 학습을 시작하세요.')).toBeInTheDocument();
    const actionButton = screen.getByRole('button', { name: '잠김' });
    expect(actionButton).toBeDisabled();

    expect(mockedTrackExperimentExposure).toHaveBeenCalledTimes(1);
    expect(mockedTrackExperimentExposure).toHaveBeenCalledWith({
      experiment: 'skill_tree_layout',
      variant: 'list',
      source: 'assignment',
      bucket: 12,
      requestId: 'req-1',
      rollout: 50,
      surface: 'skill_tree_page',
    });
  });

  it('falls back to tree variant when experiment is absent', async () => {
    mockedFetchSkillTree.mockResolvedValue({
      graph: sampleGraph,
      bipartite_graph: sampleBipartiteGraph,
      progress: sampleProgress,
      unlocked: { 'C01-S1': true, 'AS.MUL.FACTS': true, 'ALG-1': true },
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
    expect(screen.getByText('노드를 선택하면 해당 스킬에 맞춘 학습 세션으로 이동합니다. 잠금 조건은 ALL 방식으로 모든 선행 스킬을 완료해야 합니다.')).toBeInTheDocument();
  });
});
