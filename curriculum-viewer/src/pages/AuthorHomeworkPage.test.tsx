import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import AuthorHomeworkPage from './AuthorHomeworkPage'

vi.mock('../lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'author-1', role: 'admin' }
  })
}))

vi.mock('../lib/auth/api', () => ({
  listStudents: vi.fn(async () => [
    {
      id: 'student-1',
      name: '학생 1',
      grade: '1',
      role: 'student',
      profile: null,
    },
  ]),
}))

vi.mock('../lib/homework/api', () => ({
  createAssignment: vi.fn(),
  createProblemBankLabel: vi.fn(),
  HomeworkApiError: class HomeworkApiError extends Error {},
  importProblemBank: vi.fn(),
  listProblemBankLabels: vi.fn(async () => []),
  listProblemBankProblems: vi.fn(async () => []),
  setProblemBankProblemLabels: vi.fn(),
}))

describe('AuthorHomeworkPage previews', () => {
  it('keeps raw inputs and renders formatted preview blocks', async () => {
    render(<AuthorHomeworkPage />)

    await screen.findByRole('heading', { name: '숙제 출제' })

    const description = screen.getByPlaceholderText('숙제에 대한 설명을 입력하세요.')
    fireEvent.change(description, { target: { value: 'log_2 x + x^2 + 1/2' } })
    expect(description).toHaveValue('log_2 x + x^2 + 1/2')

    const question = screen.getByPlaceholderText('문제 내용을 입력하세요.')
    fireEvent.change(question, { target: { value: 'log_3 y' } })
    expect(question).toHaveValue('log_3 y')

    fireEvent.click(screen.getByLabelText('객관식'))

    const option1 = screen.getByPlaceholderText('보기 1')
    fireEvent.change(option1, { target: { value: 'x^2' } })
    expect(option1).toHaveValue('x^2')

    const answer = screen.getByPlaceholderText('정답 번호 (예: 1)')
    fireEvent.change(answer, { target: { value: '1/2' } })
    expect(answer).toHaveValue('1/2')

    const sub = document.querySelector('sub')
    const sup = document.querySelector('sup')
    const frac = document.querySelector('.math-frac')

    expect(sub).toBeTruthy()
    expect(sup).toBeTruthy()
    expect(frac).toBeTruthy()
  })
})
