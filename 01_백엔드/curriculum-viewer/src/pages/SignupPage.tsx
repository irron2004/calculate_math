import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { ROUTES } from '../routes'

type RedirectState = {
  from?: {
    pathname?: string
  }
}

const SURVEY_STORAGE_KEY = 'onboarding:survey:v1'

function safeSessionStorageSet(key: string, value: string): boolean {
  try {
    window.sessionStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value)
  if (normalized.length === 0) return false
  return normalized.includes('@') && normalized.includes('.')
}

export default function SignupPage() {
  const { isAuthenticated, register } = useAuth()
  const location = useLocation()

  const state = location.state as RedirectState | null
  const fromPathname = state?.from?.pathname ?? ROUTES.dashboard

  const [didSignup, setDidSignup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [email, setEmail] = useState('')

  const canSubmit = useMemo(() => {
    if (userId.trim().length === 0) return false
    if (password.trim().length === 0) return false
    if (name.trim().length === 0) return false
    if (grade.trim().length === 0) return false
    if (!isValidEmail(email)) return false
    return true
  }, [email, grade, name, password, userId])

  if (isAuthenticated) {
    return <Navigate to={didSignup ? ROUTES.placement : ROUTES.dashboard} replace />
  }

  return (
    <section className="login-page">
      <h1>회원가입</h1>
      <form
        className="login-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!canSubmit) return

          setError(null)

          const normalizedGrade = grade.trim()
          const parsedGrade = Number(normalizedGrade)
          if (!Number.isInteger(parsedGrade) || parsedGrade < 1 || parsedGrade > 6) {
            setError('학년은 1~6 사이 숫자로 입력해 주세요.')
            return
          }

          setSubmitting(true)
          const message = await register({
            username: userId,
            password,
            name,
            grade: normalizedGrade,
            email
          })
          setSubmitting(false)

          if (message) {
            setError(message)
            return
          }

          const storageSaved = safeSessionStorageSet(
            SURVEY_STORAGE_KEY,
            JSON.stringify({
              grade: normalizedGrade,
              confidence: null,
              recentHardTags: [],
              studyStyle: null,
              diagnosticMode: 'adjacent-grade-na-v1'
            })
          )

          if (!storageSaved) {
            setError('브라우저 저장소를 사용할 수 없어 홈으로 이동합니다.')
            setDidSignup(false)
            return
          }

          setDidSignup(true)
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
            autoComplete="new-password"
          />
        </label>

        <label className="form-field">
          이름
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
        </label>

        <label className="form-field">
          학년
          <input
            name="grade"
            inputMode="numeric"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            placeholder="예: 3"
          />
        </label>

        <label className="form-field">
          이메일
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" className="button button-primary" disabled={!canSubmit || submitting}>
          {submitting ? '가입 중...' : '회원가입'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 12 }}>
        이미 계정이 있나요?{' '}
        <Link to={ROUTES.login} state={{ from: state?.from ?? { pathname: fromPathname } }}>
          로그인
        </Link>
      </p>
    </section>
  )
}
