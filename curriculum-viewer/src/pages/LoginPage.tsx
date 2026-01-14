import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { ROUTES } from '../routes'

type RedirectState = {
  from?: {
    pathname?: string
  }
}

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const location = useLocation()

  const state = location.state as RedirectState | null
  const fromPathname = state?.from?.pathname ?? ROUTES.tree

  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [didLogin, setDidLogin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isAuthenticated) {
    return <Navigate to={didLogin ? fromPathname : ROUTES.tree} replace />
  }

  const submitDisabled = userId.trim().length === 0 || password.trim().length === 0

  return (
    <section className="login-page">
      <h1>로그인</h1>
      <form
        className="login-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (submitDisabled) {
            return
          }

          setError(null)
          const message = login(userId, password)
          if (message) {
            setError(message)
            return
          }
          setDidLogin(true)
        }}
      >
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
          disabled={submitDisabled}
        >
          로그인
        </button>

        <div className="muted">계정이 없나요?</div>
        <Link
          to={ROUTES.signup}
          state={{ from: state?.from ?? { pathname: fromPathname } }}
          className="button button-ghost"
        >
          회원가입
        </Link>
      </form>
    </section>
  )
}
