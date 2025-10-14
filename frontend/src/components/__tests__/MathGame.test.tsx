import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APISession, CurriculumConcept, CurriculumGraph } from '../../types';
import MathGame from '../MathGame';
import { resetCourseConceptOverrides } from '../../utils/skillMappings';

const mockLogin = vi.fn();
const mockLogout = vi.fn();

const authState = {
  user: { id: 'student-1', username: 'tester', role: 'student' as const, name: '테스터' },
  token: 'token-123',
  error: null,
  loading: false,
  login: mockLogin,
  logout: mockLogout,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../SkillTree', () => ({
  __esModule: true,
  default: () => <div data-testid="skill-tree" />,
}));

const createSessionMock = vi.fn();
const evaluateLRCMock = vi.fn();
const fetchConceptsMock = vi.fn();
const fetchCurriculumGraphMock = vi.fn();
const fetchTemplatesMock = vi.fn();
const fetchLatestLRCMock = vi.fn();
const generateTemplateInstanceMock = vi.fn();
const fetchSkillTreeMock = vi.fn();
const updateSkillProgressMock = vi.fn();

vi.mock('../../utils/api', () => ({
  createSession: (token?: string, config?: unknown) => createSessionMock(token, config),
  evaluateLRC: (payload: unknown) => evaluateLRCMock(payload),
  fetchConcepts: (step?: string) => fetchConceptsMock(step),
  fetchCurriculumGraph: () => fetchCurriculumGraphMock(),
  fetchTemplates: (concept?: string, step?: string) => fetchTemplatesMock(concept, step),
  fetchLatestLRC: (userId: string) => fetchLatestLRCMock(userId),
  fetchSkillTree: () => fetchSkillTreeMock(),
  generateTemplateInstance: (templateId: string, payload?: unknown) =>
    generateTemplateInstanceMock(templateId, payload),
  updateSkillProgress: (courseStepId: string, payload?: unknown) =>
    updateSkillProgressMock(courseStepId, payload),
}));

vi.mock('../../utils/analytics', () => ({
  trackBossPassed: vi.fn(),
  trackSessionStartedFromTree: vi.fn(),
  trackSkillUnlocked: vi.fn(),
  trackSkillViewed: vi.fn(),
}));

const baseConcept: CurriculumConcept = {
  id: 'ALG-AP',
  name: '기본 덧셈',
  lens: ['difference'],
  prerequisites: [],
  transfers: [],
  summary: '테스트용 개념',
  stage_span: ['S1'],
  focus_keywords: ['덧셈'],
};

const baseGraph: CurriculumGraph = {
  meta: { palette: {} },
  nodes: [
    {
      id: 'ALG-AP-S1',
      label: '기본 덧셈 · S1',
      concept: 'ALG-AP',
      step: 'S1',
      lens: ['difference'],
      grade_band: 'S1',
      micro_skills: [],
      mastery: 0,
    },
  ],
  edges: [],
};

const baseSession: APISession = {
  session_id: 42,
  problems: [
    { id: 1, left: 1, right: 2, answer: 3, options: [1, 2, 3, 4], operator: 'add' },
    { id: 2, left: 2, right: 3, answer: 5, options: [2, 3, 4, 5], operator: 'add' },
  ],
};

const skillTreeResponse = {
  version: 'test',
  palette: {},
  groups: [],
  nodes: [
    {
      id: 'C01-S1',
      label: '단위 테스트 노드',
      course: 'C01',
      group: 'arithmetic',
      tier: 1,
      lens: ['transform'],
      primary_color: '#000000',
      requires: [],
      teaches: [],
      xp: { per_try: 5, per_correct: 10 },
      lrc_min: {},
      misconceptions: [],
      state: { value: 'available', completed: false, available: true, unlocked: true },
      progress: {},
      session: {
        concept: 'ALG-AP',
        step: 'S1',
        problem_count: 12,
        generator: 'arithmetic',
        parameters: { op: 'add', count: 12 },
      },
    },
    {
      id: 'C01-S2',
      label: '단위 테스트 노드 2',
      course: 'C01',
      group: 'arithmetic',
      tier: 1,
      lens: ['transform'],
      primary_color: '#000000',
      requires: [],
      teaches: [],
      xp: { per_try: 5, per_correct: 10 },
      lrc_min: {},
      misconceptions: [],
      state: { value: 'available', completed: false, available: true, unlocked: true },
      progress: {},
      session: {
        concept: 'ALG-AP',
        step: 'S2',
        problem_count: 16,
        generator: 'arithmetic',
        parameters: { op: 'sub', count: 16, allow_carry: true },
      },
    },
  ],
  edges: [],
  skills: [],
  progress: { user_id: 'student-1', updated_at: null, total_xp: 0, nodes: {}, skills: {} },
} as const;

const renderGame = async () => {
  render(
    <MemoryRouter>
      <MathGame />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByRole('form', { name: '정답 제출 폼' })).toBeInTheDocument();
  });
};

describe('MathGame navigation-free flow', () => {
  it('shows a fallback message when generated problems are unavailable', async () => {
    fetchTemplatesMock.mockResolvedValue([]);
    createSessionMock.mockRejectedValueOnce(new Error('network'));

    await renderGame();

    await waitFor(() => expect(screen.getByText('문제 세트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')).toBeInTheDocument());
  });

  beforeEach(() => {
    resetCourseConceptOverrides();
    createSessionMock.mockReset();
    fetchConceptsMock.mockReset();
    fetchCurriculumGraphMock.mockReset();
    fetchTemplatesMock.mockReset();
    fetchLatestLRCMock.mockReset();
    evaluateLRCMock.mockReset();
    generateTemplateInstanceMock.mockReset();
    fetchSkillTreeMock.mockReset();
    updateSkillProgressMock.mockReset();

    createSessionMock.mockResolvedValue(baseSession);
    fetchConceptsMock.mockResolvedValue([baseConcept]);
    fetchCurriculumGraphMock.mockResolvedValue(baseGraph);
    fetchTemplatesMock.mockResolvedValue([]);
    fetchLatestLRCMock.mockResolvedValue(null);
    evaluateLRCMock.mockResolvedValue({
      passed: true,
      status: 'gold',
      recommendation: 'promote',
      metrics: {},
    });
    fetchSkillTreeMock.mockResolvedValue(skillTreeResponse);
    updateSkillProgressMock.mockResolvedValue({
      user_id: 'student-1',
      updated_at: new Date().toISOString(),
      total_xp: 0,
      nodes: {},
      skills: {},
    });
    mockLogin.mockReset();
    mockLogout.mockReset();
  });

  it('requests practice session payload with generator parameters when templates are missing', async () => {
    fetchTemplatesMock.mockResolvedValue([]);

    await renderGame();

    expect(createSessionMock).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({
        generator: 'arithmetic',
        op: 'add',
        count: 12,
        concept: 'ALG-AP',
        step: 'S1',
      })
    );
  });

  it('updates skill progress when a session meeting the threshold is submitted', async () => {
    await renderGame();

    const user = userEvent.setup();

    const answerInput = screen.getByLabelText('정답 입력');
    const confirmButton = screen.getByRole('button', { name: '확인' });

    await user.clear(answerInput);
    await user.type(answerInput, '3');
    await user.click(confirmButton);

    await user.clear(answerInput);
    await user.type(answerInput, '5');
    await user.click(confirmButton);

    await screen.findByText('결과를 확인하려면 제출 버튼을 눌러주세요.');

    const submitButton = screen.getByRole('button', { name: '제출' });
    await user.click(submitButton);

    await waitFor(() => expect(updateSkillProgressMock).toHaveBeenCalled());
    expect(
      screen.getByText('진행 상황이 저장되었습니다. 다음 단계로 이동할 수 있어요!')
    ).toBeInTheDocument();
    expect(updateSkillProgressMock).toHaveBeenCalledWith(
      'C01-S1',
      expect.objectContaining({
        correct: true,
        attempts: 1,
        userId: 'student-1',
      })
    );
  });

  it('shows a warning when skill progress update fails', async () => {
    updateSkillProgressMock.mockRejectedValueOnce(new Error('offline'));

    await renderGame();

    const user = userEvent.setup();

    const answerInput = screen.getByLabelText('정답 입력');
    const confirmButton = screen.getByRole('button', { name: '확인' });

    await user.clear(answerInput);
    await user.type(answerInput, '3');
    await user.click(confirmButton);

    await user.clear(answerInput);
    await user.type(answerInput, '5');
    await user.click(confirmButton);

    await screen.findByText('결과를 확인하려면 제출 버튼을 눌러주세요.');
    await user.click(screen.getByRole('button', { name: '제출' }));

    await waitFor(() => expect(updateSkillProgressMock).toHaveBeenCalled());
    expect(
      screen.getByText('진행 상황이 저장되었습니다. 다음 단계로 이동할 수 있어요!')
    ).toBeInTheDocument();
    expect(
      screen.getByText('진행 상황을 저장하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해주세요.')
    ).toBeInTheDocument();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows progress details without dashboard controls during play', async () => {
    await renderGame();

    expect(screen.queryByRole('button', { name: /대시보드/ })).toBeNull();

    const progressbar = screen.getByRole('progressbar', { name: '문제 풀이 진행률' });
    expect(progressbar.getAttribute('aria-valuenow')).toBe('50');
    expect(progressbar.getAttribute('aria-valuemin')).toBe('0');
    expect(progressbar.getAttribute('aria-valuemax')).toBe('100');

    expect(screen.getByText(/문제 1\/2/)).toBeInTheDocument();
  });

  it('cycles focus through in-game controls when tabbing', async () => {
    await renderGame();

    const form = screen.getByRole('form', { name: '정답 제출 폼' });
    const hintButton = within(form).getByRole('button', { name: '키워드 힌트' });
    const explanationField = within(form).getByLabelText('풀이 설명 입력');
    const answerField = within(form).getByLabelText('정답 입력');
    const submitButton = within(form).getByRole('button', { name: '확인' });

    const user = userEvent.setup();

    await user.tab({ focusTrap: form });
    expect(document.activeElement).toBe(hintButton);

    await user.tab({ focusTrap: form });
    expect(document.activeElement).toBe(explanationField);

    await user.tab({ focusTrap: form });
    expect(document.activeElement).toBe(answerField);

    await user.tab({ focusTrap: form });
    expect(document.activeElement).toBe(submitButton);

    await user.tab({ focusTrap: form });
    expect(document.activeElement).toBe(hintButton);
  });
});
