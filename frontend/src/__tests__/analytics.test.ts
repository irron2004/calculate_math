import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  trackBossPassed,
  trackExperimentExposure,
  trackSessionStartedFromTree,
  trackSkillUnlocked,
  trackSkillViewed,
} from '../utils/analytics';

declare global {
  interface Window {
    analytics?: {
      trackEvent?: (eventName: string, payload?: Record<string, unknown>) => void;
    };
  }
}

describe('analytics utility wrappers', () => {
  const trackEventMock = vi.fn();

  beforeEach(() => {
    trackEventMock.mockReset();
    window.analytics = { trackEvent: trackEventMock };
  });

  it('emits skill_viewed with sanitized payload', () => {
    trackSkillViewed({
      conceptId: 'ALG-AP',
      conceptName: 'Algebra',
      step: 'S1',
      nodeId: 'ALG-AP-S1',
      source: 'initial',
      sequenceIndex: 3,
      available: true,
      completed: false,
      lens: null,
      problemCount: 6,
      problemsSource: 'generated',
    });

    expect(trackEventMock).toHaveBeenCalledWith('skill_viewed', {
      concept_id: 'ALG-AP',
      concept_name: 'Algebra',
      step: 'S1',
      node_id: 'ALG-AP-S1',
      source: 'initial',
      sequence_index: 3,
      available: true,
      completed: false,
      problem_count: 6,
      problems_source: 'generated',
    });
    const [, payload] = trackEventMock.mock.calls[0];
    expect(payload).not.toHaveProperty('lens');
  });

  it('emits skill_unlocked including optional values', () => {
    trackSkillUnlocked({
      conceptId: 'RAT-PRO',
      conceptName: '비율',
      unlockedStep: 'S2',
      previousStep: 'S1',
      nodeId: 'RAT-PRO-S2',
      sequenceIndex: 5,
      lens: 'ratio',
    });

    expect(trackEventMock).toHaveBeenLastCalledWith('skill_unlocked', {
      concept_id: 'RAT-PRO',
      concept_name: '비율',
      unlocked_step: 'S2',
      previous_step: 'S1',
      node_id: 'RAT-PRO-S2',
      sequence_index: 5,
      lens: 'ratio',
    });
  });

  it('emits boss_passed with metrics payload', () => {
    trackBossPassed({
      conceptId: 'GEO-LIN',
      conceptName: '기하',
      step: 'S3',
      nodeId: 'GEO-LIN-S3',
      sequenceIndex: 8,
      status: 'gold',
      recommendation: 'promote',
      metrics: {
        accuracy: 0.95,
        rt_percentile: 0.8,
        rubric: 0.85,
      },
      score: 120,
      totalQuestions: 6,
      correctCount: 6,
    });

    expect(trackEventMock).toHaveBeenLastCalledWith('boss_passed', {
      concept_id: 'GEO-LIN',
      concept_name: '기하',
      step: 'S3',
      node_id: 'GEO-LIN-S3',
      sequence_index: 8,
      status: 'gold',
      recommendation: 'promote',
      metrics: {
        accuracy: 0.95,
        rt_percentile: 0.8,
        rubric: 0.85,
      },
      score: 120,
      total_questions: 6,
      correct_count: 6,
    });
  });

  it('emits session_started_from_tree event', () => {
    trackSessionStartedFromTree({
      conceptId: 'ALG-AP',
      conceptName: 'Algebra',
      step: 'S1',
      nodeId: 'ALG-AP-S1',
      sequenceIndex: 2,
      triggeredBy: 'skill_node',
      available: true,
      completed: false,
      lens: 'ratio',
    });

    expect(trackEventMock).toHaveBeenLastCalledWith('session_started_from_tree', {
      concept_id: 'ALG-AP',
      concept_name: 'Algebra',
      step: 'S1',
      node_id: 'ALG-AP-S1',
      sequence_index: 2,
      triggered_by: 'skill_node',
      available: true,
      completed: false,
      lens: 'ratio',
    });
  });

  it('emits experiment_exposure event with metadata', () => {
    trackExperimentExposure({
      experiment: 'skill_tree_layout',
      variant: 'list',
      source: 'assignment',
      bucket: 42,
      requestId: 'req-1',
      rollout: 50,
      surface: 'skill_tree_page',
    });

    expect(trackEventMock).toHaveBeenLastCalledWith('experiment_exposure', {
      experiment: 'skill_tree_layout',
      variant: 'list',
      source: 'assignment',
      bucket: 42,
      request_id: 'req-1',
      rollout: 50,
      surface: 'skill_tree_page',
    });
  });
});

