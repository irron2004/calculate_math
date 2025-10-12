import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APISession, CurriculumConcept, CurriculumGraph } from '../../types';
import MathGame from '../MathGame';

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

vi.mock('../../utils/api', () => ({
  createSession: (token?: string) => createSessionMock(token),
  evaluateLRC: (payload: unknown) => evaluateLRCMock(payload),
  fetchConcepts: (step?: string) => fetchConceptsMock(step),
  fetchCurriculumGraph: () => fetchCurriculumGraphMock(),
  fetchTemplates: (concept?: string, step?: string) => fetchTemplatesMock(concept, step),
  fetchLatestLRC: (userId: string) => fetchLatestLRCMock(userId),
  generateTemplateInstance: (templateId: string, payload?: unknown) =>
    generateTemplateInstanceMock(templateId, payload),
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
    { id: 1, left: 1, right: 2, answer: 3, options: [] },
    { id: 2, left: 2, right: 3, answer: 5, options: [] },
  ],
};

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
  beforeEach(() => {
    createSessionMock.mockReset();
    fetchConceptsMock.mockReset();
    fetchCurriculumGraphMock.mockReset();
    fetchTemplatesMock.mockReset();
    fetchLatestLRCMock.mockReset();
    evaluateLRCMock.mockReset();
    generateTemplateInstanceMock.mockReset();

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
    mockLogin.mockReset();
    mockLogout.mockReset();
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
