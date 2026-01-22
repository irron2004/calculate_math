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

describe('LearnPage route', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username: 'demo' }))
  })

  it('renders LearnPage at /learn/:nodeId', async () => {
    window.history.pushState({}, '', '/learn/1.1.1')
    render(<App />)

    // LearnPage should show learning heading
    expect(await screen.findByRole('heading', { name: '학습' })).toBeInTheDocument()
  })
})
