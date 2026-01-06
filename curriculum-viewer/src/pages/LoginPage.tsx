import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
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

  const [username, setUsername] = useState('')
  const [didLogin, setDidLogin] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={didLogin ? fromPathname : ROUTES.tree} replace />
  }
  const submitDisabled = username.trim().length === 0

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

          login(username)
          setDidLogin(true)
        }}
      >
        <label className="form-field">
          사용자명
          <input
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
        </label>
        <button
          type="submit"
          className="button button-primary"
          disabled={submitDisabled}
        >
          로그인
        </button>
      </form>
    </section>
  )
}
