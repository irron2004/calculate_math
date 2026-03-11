import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthorHomeworkStatusPage from './AuthorHomeworkStatusPage'
import { ToastProvider } from '../components/Toast'

const listStudentsMock = vi.fn()
const listAssignmentsAdminMock = vi.fn()
const listAssignmentsAdminForStudentMock = vi.fn()
const getAssignmentAdminMock = vi.fn()
const updateAssignmentAdminMock = vi.fn()

vi.mock('../lib/auth/api', () => ({
  listStudents: (...args: unknown[]) => listStudentsMock(...args)
}))

vi.mock('../lib/homework/api', () => ({
  listAssignmentsAdmin: (...args: unknown[]) => listAssignmentsAdminMock(...args),
  listAssignmentsAdminForStudent: (...args: unknown[]) => listAssignmentsAdminForStudentMock(...args),
  listWrongProblemsAdminForStudent: vi.fn(),
  getAssignmentAdmin: (...args: unknown[]) => getAssignmentAdminMock(...args),
  updateAssignmentAdmin: (...args: unknown[]) => updateAssignmentAdminMock(...args),
  getSubmissionAdmin: vi.fn(),
  getSubmissionFileUrl: vi.fn(),
  deleteAssignmentAdmin: vi.fn(),
  reviewSubmission: vi.fn(),
  HomeworkApiError: class HomeworkApiError extends Error {}
}))

describe('AuthorHomeworkStatusPage due date extension', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    localStorage.clear()

    listStudentsMock.mockResolvedValue([{ id: 's1', name: '학생1', grade: '3', email: 's1@example.com' }])
    listAssignmentsAdminForStudentMock.mockResolvedValue({ studentId: 's1', assignments: [] })
    listAssignmentsAdminMock.mockResolvedValue([
      {
        id: 'a1',
        title: '테스트 숙제',
        description: 'desc',
        problems: [{ id: 'p1', type: 'subjective', question: 'q1' }],
        dueAt: '2026-02-01T23:59:59',
        createdBy: 'admin',
        createdAt: '2026-01-31T10:00:00',
        totalStudents: 2,
        submittedCount: 1,
        pendingCount: 0,
        approvedCount: 0,
        returnedCount: 0,
        isScheduled: false
      }
    ])
    updateAssignmentAdminMock.mockResolvedValue({ success: true })
  })

  it('shows extend button for unsubmitted students and sends +7 days payload', async () => {
    getAssignmentAdminMock.mockResolvedValue({
      id: 'a1',
      title: '테스트 숙제',
      description: 'desc',
      problems: [{ id: 'p1', type: 'subjective', question: 'q1' }],
      dueAt: '2026-02-01T23:59:59',
      createdBy: 'admin',
      createdAt: '2026-01-31T10:00:00',
      students: [
        { studentId: 's1', assignedAt: '2026-01-31T10:00:00', submissionId: null, submittedAt: null, reviewStatus: null },
        { studentId: 's2', assignedAt: '2026-01-31T10:00:00', submissionId: 'sub-1', submittedAt: '2026-02-01T09:00:00', reviewStatus: 'pending' }
      ]
    })

    render(
      <ToastProvider>
        <AuthorHomeworkStatusPage />
      </ToastProvider>
    )

    await userEvent.click(await screen.findByRole('button', { name: '숙제별' }))
    
    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }))
    const extendButton = await screen.findByRole('button', { name: '마감 1주일 연장' })
    await userEvent.click(extendButton)

    await waitFor(() => {
      expect(updateAssignmentAdminMock).toHaveBeenCalledWith('a1', {
        title: '테스트 숙제',
        dueAt: '2026-02-08T23:59'
      })
    })
  })

  it('does not show extend button when everyone submitted', async () => {
    getAssignmentAdminMock.mockResolvedValue({
      id: 'a1',
      title: '테스트 숙제',
      description: 'desc',
      problems: [{ id: 'p1', type: 'subjective', question: 'q1' }],
      dueAt: '2026-02-01T23:59:59',
      createdBy: 'admin',
      createdAt: '2026-01-31T10:00:00',
      students: [
        { studentId: 's1', assignedAt: '2026-01-31T10:00:00', submissionId: 'sub-1', submittedAt: '2026-02-01T09:00:00', reviewStatus: 'pending' }
      ]
    })

    render(
      <ToastProvider>
        <AuthorHomeworkStatusPage />
      </ToastProvider>
    )

    await userEvent.click(await screen.findByRole('button', { name: '숙제별' }))

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '마감 1주일 연장' })).toBeNull()
    })
  })

  it('renders formatted description in assignment detail view', async () => {
    getAssignmentAdminMock.mockResolvedValue({
      id: 'a1',
      title: '테스트 숙제',
      description: 'log_2 설명',
      problems: [{ id: 'p1', type: 'subjective', question: 'q1' }],
      dueAt: '2026-02-01T23:59:59',
      createdBy: 'admin',
      createdAt: '2026-01-31T10:00:00',
      students: [
        { studentId: 's1', assignedAt: '2026-01-31T10:00:00', submissionId: null, submittedAt: null, reviewStatus: null }
      ]
    })

    render(
      <ToastProvider>
        <AuthorHomeworkStatusPage />
      </ToastProvider>
    )

    await userEvent.click(await screen.findByRole('button', { name: '숙제별' }))

    await userEvent.click(await screen.findByRole('button', { name: '상세 보기' }))
    await waitFor(() => {
      expect(document.querySelector('.admin-assignment-summary sub')).toBeTruthy()
    })
  })
})
