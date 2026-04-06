import { describe, expect, it, beforeEach, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignupPage from './SignupPage'
import { AuthProvider } from '../lib/auth/AuthProvider'
import { registerUser } from '../lib/auth/api'

vi.mock('../lib/auth/api', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  fetchMe: vi.fn().mockRejectedValue(new Error('no session')),
  logoutUser: vi.fn().mockResolvedValue(undefined)
}))

function renderSignupPage() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <AuthProvider>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
          <Route path="/onboarding/placement" element={<h1>Placement</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

async function fillSignupForm() {
  await userEvent.type(screen.getByRole('textbox', { name: '아이디' }), 'signup_test_user')
  await userEvent.type(screen.getByLabelText('비밀번호'), 'password1234')
  await userEvent.type(screen.getByRole('textbox', { name: '이름' }), '테스트 사용자')
  await userEvent.type(screen.getByRole('textbox', { name: '학년' }), '3')
  await userEvent.type(screen.getByRole('textbox', { name: '이메일' }), 'signup_test_user@example.com')
}

describe('SignupPage hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
  })

  it('shows a clear error for invalid grade and does not call register API', async () => {
    renderSignupPage()

    await userEvent.type(screen.getByRole('textbox', { name: '아이디' }), 'invalid_grade_user')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password1234')
    await userEvent.type(screen.getByRole('textbox', { name: '이름' }), '테스트 사용자')
    await userEvent.type(screen.getByRole('textbox', { name: '학년' }), '9')
    await userEvent.type(screen.getByRole('textbox', { name: '이메일' }), 'invalid_grade_user@example.com')

    await userEvent.click(screen.getByRole('button', { name: '회원가입' }))

    expect(await screen.findByText('학년은 1~6 사이 숫자로 입력해 주세요.')).toBeVisible()
    expect(registerUser).not.toHaveBeenCalled()
  })

  it('falls back to dashboard when sessionStorage is unavailable', async () => {
    const originalSetItem = Storage.prototype.setItem
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === 'onboarding:survey:v1') {
          throw new Error('blocked')
        }
        return originalSetItem.call(this, key, value)
      })

    vi.mocked(registerUser).mockResolvedValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: {
        id: 'u-1',
        username: 'signup_test_user',
        name: '테스트 사용자',
        grade: '3',
        email: 'signup_test_user@example.com',
        role: 'student',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        praiseStickerEnabled: false
      }
    })

    renderSignupPage()
    await fillSignupForm()

    await userEvent.click(screen.getByRole('button', { name: '회원가입' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    })

    setItemSpy.mockRestore()
  })
})
