import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import StudentDashboard from '../StudentDashboard';

const mockUseAuth = vi.fn();
const mockFetchUserMetrics = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../utils/api', () => ({
  fetchUserMetrics: (...args: unknown[]) => mockFetchUserMetrics(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('StudentDashboard', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockFetchUserMetrics.mockReset();
    mockNavigate.mockReset();
  });

  it('renders personalised metrics for authenticated students', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        username: 'student01',
        role: 'student',
        name: 'student01',
      },
      token: 'session-token',
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      loading: false,
    });

    mockFetchUserMetrics.mockResolvedValue({
      user_id: '1',
      attempts: {
        total: 12,
        correct: 9,
        accuracy_rate: 75,
        streak_days: 4,
        last_attempt_at: '2024-01-01T00:00:00Z',
      },
      progress: {
        total_xp: 220,
        unlocked_nodes: 6,
        completed_nodes: 3,
        mastered_skills: 1,
      },
      skill_levels: {
        algebra: 2,
      },
    });

    render(<StudentDashboard />);

    await waitFor(() => expect(mockFetchUserMetrics).toHaveBeenCalledWith('session-token'));

    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('220 XP')).toBeInTheDocument();
    expect(screen.getByText('4일')).toBeInTheDocument();
  });

  it('skips metrics fetch for guest users', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'guest',
        username: 'guest',
        role: 'guest',
        name: 'Guest',
      },
      token: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      loading: false,
    });

    render(<StudentDashboard />);

    expect(screen.getByText('게스트는 기록이 저장되지 않습니다')).toBeInTheDocument();
    expect(mockFetchUserMetrics).not.toHaveBeenCalled();
  });
});

