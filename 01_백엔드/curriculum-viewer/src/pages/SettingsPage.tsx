import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { changePassword } from '../lib/auth/api'
import { ROUTES } from '../routes'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [passwordFormOpen, setPasswordFormOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  const resetPasswordForm = useCallback(() => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setPasswordSuccess(null)
  }, [])

  if (!user) {
    return (
      <section>
        <h1>설정</h1>
        <p className="error">로그인이 필요합니다.</p>
      </section>
    )
  }

  return (
    <section>
      <h1>설정</h1>
      <p className="muted">{user.name ?? user.username}님의 계정 설정입니다.</p>

      <section className="mypage-account-section">
        <div className="mypage-account-header">
          <h2>계정</h2>
          <button
            type="button"
            className="button button-ghost"
            disabled={passwordSubmitting}
            aria-expanded={passwordFormOpen}
            onClick={() => {
              if (passwordFormOpen) {
                resetPasswordForm()
                setPasswordFormOpen(false)
                return
              }
              resetPasswordForm()
              setPasswordFormOpen(true)
            }}
          >
            {passwordFormOpen ? '닫기' : '비밀번호 변경'}
          </button>
        </div>

        {passwordFormOpen ? (
          <form
            className="form"
            onSubmit={async (event) => {
              event.preventDefault()
              setPasswordError(null)
              setPasswordSuccess(null)

              if (!currentPassword || !newPassword || !confirmPassword) {
                setPasswordError('모든 비밀번호 항목을 입력하세요.')
                return
              }
              if (newPassword.length < 8) {
                setPasswordError('새 비밀번호는 8자 이상이어야 합니다.')
                return
              }
              if (newPassword !== confirmPassword) {
                setPasswordError('새 비밀번호가 일치하지 않습니다.')
                return
              }
              if (currentPassword === newPassword) {
                setPasswordError('현재 비밀번호와 다른 비밀번호를 입력하세요.')
                return
              }

              try {
                setPasswordSubmitting(true)
                await changePassword(currentPassword, newPassword)
                await logout()
                navigate(ROUTES.login, {
                  replace: true,
                  state: { notice: '비밀번호가 변경되었습니다. 다시 로그인해 주세요.' }
                })
              } catch (err) {
                setPasswordError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.')
              } finally {
                setPasswordSubmitting(false)
              }
            }}
          >
            <label className="form-field">
              현재 비밀번호
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="form-field">
              새 비밀번호
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className="form-field">
              새 비밀번호 확인
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            {passwordError ? <p className="error">{passwordError}</p> : null}
            <button
              type="submit"
              className="button button-primary"
              disabled={passwordSubmitting}
            >
              {passwordSubmitting ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        ) : null}
      </section>
    </section>
  )
}
