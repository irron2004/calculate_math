import { render, screen, waitFor } from '@testing-library/react';
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

describe('SkillTreePage', () => {
  beforeEach(() => {
    mockedFetchSkillTree.mockReset();
    mockedTrackExperimentExposure.mockReset();
  });

  it('renders list variant and tracks exposure metadata', async () => {
    mockedFetchSkillTree.mockResolvedValue({
      graph: sampleGraph,
      progress: {},
      unlocked: {},
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
    expect(screen.getByText('리스트 보기로 렌즈와 티어를 빠르게 확인하고 바로 학습을 시작하세요.')).toBeInTheDocument();
    expect(screen.getByText('학습 시작')).toBeInTheDocument();

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
      progress: {},
      unlocked: {},
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
