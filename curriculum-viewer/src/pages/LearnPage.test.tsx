import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from '../App'
import { AUTH_STORAGE_KEY } from '../lib/auth/AuthProvider'

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

describe('LearnPage bulk submit', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username: 'demo' }))
  })

  it('grades only after all answers are filled', async () => {
    window.history.pushState({}, '', '/learn/1.1.1')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '학습' })).toBeInTheDocument()
    expect(await screen.findByText('1 + 1 = ?')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: '제출' })).not.toBeInTheDocument()

    const gradeButton = screen.getByRole('button', { name: '채점하기' })
    expect(gradeButton).toBeDisabled()

    const user = userEvent.setup()
    const inputs = screen.getAllByPlaceholderText('정답 입력')
    await user.type(inputs[0], '2')
    expect(gradeButton).toBeDisabled()

    await user.type(inputs[1], '4')
    expect(gradeButton).toBeEnabled()

    await user.click(gradeButton)
    expect(await screen.findByText('점수: 1 / 2')).toBeInTheDocument()
    expect(screen.getByText('정답 · 정답: 2')).toBeInTheDocument()
    expect(screen.getByText('오답 · 정답: 5')).toBeInTheDocument()

    const stored = window.localStorage.getItem('curriculum-viewer:learn:lastResult:1.1.1')
    expect(stored).not.toBeNull()
  })

  it('clears grading result when answers change', async () => {
    window.history.pushState({}, '', '/learn/1.1.1')
    render(<App />)

    const user = userEvent.setup()
    const inputs = await screen.findAllByPlaceholderText('정답 입력')
    await user.type(inputs[0], '2')
    await user.type(inputs[1], '5')
    await user.click(screen.getByRole('button', { name: '채점하기' }))

    expect(await screen.findByText('점수: 2 / 2')).toBeInTheDocument()

    await user.clear(inputs[0])
    await user.type(inputs[0], '3')

    await waitFor(() =>
      expect(screen.queryByText(/점수:/)).not.toBeInTheDocument()
    )
    expect(
      window.localStorage.getItem('curriculum-viewer:learn:lastResult:1.1.1')
    ).toBeNull()
  })
})

