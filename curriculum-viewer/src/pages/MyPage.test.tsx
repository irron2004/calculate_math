import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MyPage from './MyPage'

const { mockLogout, mockListAssignments, mockUser } = vi.hoisted(() => ({
  mockLogout: vi.fn().mockResolvedValue(undefined),
  mockListAssignments: vi.fn().mockResolvedValue([]),
  mockUser: { username: 'student1', name: '학생' }
}))

vi.mock('../lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout
  })
}))

vi.mock('../lib/auth/api', () => ({
  changePassword: vi.fn()
}))

vi.mock('../lib/homework/api', () => {
  class HomeworkApiError extends Error {}

  return {
    HomeworkApiError,
    listAssignments: mockListAssignments
  }
})

describe('MyPage (/mypage)', () => {
  it('hides the password form until the user opens it', async () => {
    render(
      <MemoryRouter initialEntries={['/mypage']}>
        <Routes>
          <Route path="/mypage" element={<MyPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(mockListAssignments).toHaveBeenCalled())
    await screen.findByText('할당된 숙제가 없습니다.')

    expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    expect(await screen.findByLabelText('현재 비밀번호')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '닫기' }))
    await waitFor(() => {
      expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '비밀번호 변경' })).toBeInTheDocument()
  })
})
