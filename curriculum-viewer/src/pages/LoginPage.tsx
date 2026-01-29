import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { ROUTES } from '../routes'

type RedirectState = {
  from?: {
    pathname?: string
  }
  notice?: string
}

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const location = useLocation()

  const state = location.state as RedirectState | null
  const fromPathname = state?.from?.pathname ?? ROUTES.dashboard
  const notice = state?.notice ?? null

  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [didLogin, setDidLogin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isAuthenticated) {
    return <Navigate to={didLogin ? fromPathname : ROUTES.dashboard} replace />
  }

  const submitDisabled = userId.trim().length === 0 || password.trim().length === 0

  return (
    <section className="login-page">
      <h1>로그인</h1>
      <form
        className="login-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (submitDisabled) {
            return
          }

          setError(null)
          setSubmitting(true)
          const message = await login(userId, password)
          setSubmitting(false)
          if (message) {
            setError(message)
            return
          }
          setDidLogin(true)
        }}
      >
        {notice ? <p className="muted">{notice}</p> : null}

        <label className="form-field">
          아이디
          <input
            name="userId"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoComplete="username"
          />
        </label>

        <label className="form-field">
          비밀번호
          <input
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button
          type="submit"
          className="button button-primary"
          disabled={submitDisabled || submitting}
        >
          {submitting ? '로그인 중...' : '로그인'}
        </button>

        <div className="muted">계정이 없나요?</div>
        <Link
          to={ROUTES.signup}
          state={{ from: state?.from ?? { pathname: fromPathname } }}
          className="button button-ghost"
        >
          회원가입
        </Link>

        <div className="muted">또는</div>
        <Link to={ROUTES.author} className="button button-ghost">
          관리자 모드로
        </Link>
        <p className="muted" style={{ marginTop: 8 }}>
          관리자 계정: <span className="mono">admin / ithing88</span>
        </p>
      </form>
    </section>
  )
}
