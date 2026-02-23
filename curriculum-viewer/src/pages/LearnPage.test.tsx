import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from '../App'
import { AUTH_STORAGE_KEY } from '../lib/auth/AuthProvider'
import { getAttemptSessionsStorageKey } from '../lib/studentLearning/storage'

vi.mock('../lib/learn/problems', async () => {
  const actual = await vi.importActual<typeof import('../lib/learn/problems')>(
    '../lib/learn/problems'
  )

  return {
    ...actual,
    loadProblemBank: vi.fn(async () => ({
      version: 1,
      problemsByNodeId: {
        '1.1.1': [
          { id: 'p-1', type: 'numeric', prompt: '1 + 1 = ?', answer: '2' },
          { id: 'p-2', type: 'numeric', prompt: '10 / 2 = ?', answer: '5' }
        ]
      }
    }))
  }
})

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

describe('LearnPage route', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
  })

  it('renders LearnPage at /learn/:nodeId', async () => {
    window.history.pushState({}, '', '/learn/1.1.1')
    render(<App />)

    // LearnPage should show learning heading
    expect(await screen.findByRole('heading', { name: '학습' })).toBeInTheDocument()
  })
})
