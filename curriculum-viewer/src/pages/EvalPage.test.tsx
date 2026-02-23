import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from '../App'
import { AUTH_STORAGE_KEY } from '../lib/auth/AuthProvider'
import { getAttemptSessionsStorageKey } from '../lib/studentLearning/storage'
import type { AttemptSessionStoreV1 } from '../lib/studentLearning/types'

vi.mock('../lib/studentLearning/graph', () => {
  return {
    loadLearningGraphV1: vi.fn(async () => ({
      version: 1,
      nodes: [
        { id: 'A', isStart: true, order: 1 },
        { id: 'B', isStart: true, order: 2 }
      ],
      edges: [{ sourceId: 'A', targetId: 'B', type: 'prepares_for' }]
    }))
  }
})

function writeStore(userId: string, store: AttemptSessionStoreV1) {
  window.localStorage.setItem(getAttemptSessionsStorageKey(userId), JSON.stringify(store))
}

const buildStoredUser = (username = 'demo') => ({
  id: username,
  username,
  name: 'Demo User',
  grade: '1',
  email: `${username}@example.com`,
  role: 'student' as const,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null
})

describe('EvalPage route', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
  })

  it('renders EvalPage at /eval/:sessionId', async () => {
    writeStore('demo', {
      version: 1,
      sessionsById: {
        s1: {
          nodeId: 'A',
          sessionId: 's1',
          status: 'SUBMITTED',
          responses: {
            p1: {
              problemId: 'p1',
              inputRaw: '2',
              updatedAt: '2026-01-15T00:00:00.000Z',
              timeSpentMs: 0,
              answerEditCount: 0,
              scratchpadStrokesJson: null
            }
          },
          grading: {
            totalCount: 1,
            correctCount: 1,
            accuracy: 1,
            cleared: true,
            perProblem: { p1: { isCorrect: true, expectedAnswer: '2' } }
          },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:00:01.000Z'
        }
      },
      draftSessionIdByNodeId: {}
    })

    window.history.pushState({}, '', '/eval/s1')
    render(<App />)

    // EvalPage should show evaluation heading
    expect(await screen.findByRole('heading', { name: '평가' })).toBeInTheDocument()
  })
})
