import { type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { ROUTES } from '../routes'

export default function RequireAuthor({ children }: { children: ReactElement }) {
  const { mode, setMode, isAdmin, user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return (
      <section>
        <h1>관리자 전용 기능</h1>
        <p className="muted">관리자 계정으로 로그인해야 접근할 수 있습니다.</p>
        <div className="node-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate(ROUTES.login)}
          >
            로그인하기
          </button>
        </div>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <section>
        <h1>관리자 전용 기능</h1>
        <p className="muted">이 페이지는 관리자 계정(admin/admin)에서만 사용할 수 있습니다.</p>
        <dl className="detail-dl">
          <dt>현재 계정</dt>
          <dd className="mono">{user.id}</dd>
        </dl>
        <div className="node-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              logout()
              navigate(ROUTES.login)
            }}
          >
            관리자 계정으로 로그인
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              setMode('student')
              navigate(ROUTES.dashboard, { replace: true })
            }}
          >
            학생 화면으로
          </button>
        </div>
      </section>
    )
  }

  if (mode !== 'author') {
    return (
      <section>
        <h1>관리자 전용 기능</h1>
        <p className="muted">이 페이지는 관리자 모드에서만 사용할 수 있습니다.</p>
        <div className="node-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => setMode('author')}
          >
            관리자 모드로 전환
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              setMode('student')
              navigate(ROUTES.dashboard, { replace: true })
            }}
          >
            학생 화면으로
          </button>
        </div>
      </section>
    )
  }

  return children
}
