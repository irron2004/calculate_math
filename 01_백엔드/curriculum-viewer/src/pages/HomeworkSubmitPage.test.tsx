import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomeworkSubmitPage from './HomeworkSubmitPage'

const getAssignmentMock = vi.fn()

vi.mock('../lib/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { username: 'student-1' } })
}))

vi.mock('../lib/homework/api', () => ({
  getAssignment: (...args: unknown[]) => getAssignmentMock(...args),
  submitHomework: vi.fn(),
  HomeworkApiError: class HomeworkApiError extends Error {}
}))

vi.mock('../components/ImageUploader', () => ({
  default: () => <div data-testid="image-uploader" />
}))

vi.mock('../components/Scratchpad', () => ({
  __esModule: true,
  default: () => <div data-testid="scratchpad" />
}))

describe('HomeworkSubmitPage math rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders formatted description and submitted answer', async () => {
    getAssignmentMock.mockResolvedValue({
      id: 'hw-1',
      title: '숙제 1',
      description: 'log_2 x^2 1/2',
      problems: [{ id: 'p1', type: 'subjective', question: 'q1' }],
      createdAt: '2026-02-01T00:00:00.000Z',
      submission: {
        id: 'sub-1',
        answers: { p1: '1/2' },
        submittedAt: '2026-02-01T12:00:00.000Z',
        files: [],
        reviewStatus: 'pending',
        reviewedAt: null,
        reviewedBy: null,
        problemReviews: {}
      }
    })

    render(
      <MemoryRouter initialEntries={['/mypage/homework/hw-1']}>
        <Routes>
          <Route path="/mypage/homework/:id" element={<HomeworkSubmitPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(getAssignmentMock).toHaveBeenCalled()
      const description = document.querySelector('.homework-description')
      expect(description?.querySelector('sub')).toBeTruthy()
      expect(description?.querySelector('sup')).toBeTruthy()
      expect(description?.querySelector('.math-frac')).toBeTruthy()

      const submittedAnswer = document.querySelector('.submitted-answer-text')
      expect(submittedAnswer?.querySelector('.math-frac')).toBeTruthy()
    })
  })
})
