import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchMe, loginUser, logoutUser, registerUser } from './api'
import type { AuthUser, RegisterInput } from './types'
import { getAccessToken, getRefreshToken } from './tokenStorage'

export type AppMode = 'student' | 'author'

export type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  mode: AppMode
  login: (username: string, password: string) => Promise<string | null>
  register: (input: RegisterInput) => Promise<string | null>
  logout: () => Promise<void>
  setMode: (mode: AppMode) => void
}

export const AUTH_STORAGE_KEY = 'curriculum-viewer:auth'

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStoredUser(): AuthUser | null {
  const storage = getLocalStorage()
  if (!storage) return null

  const raw = storage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return null

    const id = typeof parsed.id === 'string' ? parsed.id : ''
    const username = typeof parsed.username === 'string' ? parsed.username : ''
    const name = typeof parsed.name === 'string' ? parsed.name : ''
    const grade = typeof parsed.grade === 'string' ? parsed.grade : ''
    const email = typeof parsed.email === 'string' ? parsed.email : ''
    const role = typeof parsed.role === 'string' ? parsed.role : 'student'
    const status = typeof parsed.status === 'string' ? parsed.status : 'active'
    const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : ''
    const lastLoginAt = typeof parsed.lastLoginAt === 'string' ? parsed.lastLoginAt : null

    if (!id || !username || !name || !grade || !email || !createdAt) return null

    return {
      id,
      username,
      name,
      grade,
      email,
      role: role === 'admin' ? 'admin' : 'student',
      status,
      createdAt,
      lastLoginAt
    }
  } catch {
    return null
  }
}

function writeStoredUser(user: AuthUser | null): void {
  const storage = getLocalStorage()
  if (!storage) return

  if (!user) {
    storage.removeItem(AUTH_STORAGE_KEY)
    return
  }

  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())
  const [mode, setMode] = useState<AppMode>('student')
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const accessToken = getAccessToken()
      const refreshToken = getRefreshToken()
      if (!accessToken && !refreshToken) return

      try {
        const me = await fetchMe()
        if (cancelled) return
        setUser(me)
        writeStoredUser(me)
        setMode(me.role === 'admin' ? 'author' : 'student')
      } catch {
        if (cancelled) return
        setUser(null)
        writeStoredUser(null)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const normalizedId = username.trim()
    const normalizedPw = password.trim()
    if (normalizedId.length === 0 || normalizedPw.length === 0) {
      return '아이디와 비밀번호를 입력하세요.'
    }

    try {
      const { user: nextUser } = await loginUser({ username: normalizedId, password: normalizedPw })
      setUser(nextUser)
      writeStoredUser(nextUser)
      setMode(nextUser.role === 'admin' ? 'author' : 'student')
      return null
    } catch (err) {
      return err instanceof Error ? err.message : '로그인에 실패했습니다.'
    }
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const normalizedId = input.username.trim()
    const normalizedPw = input.password.trim()
    const normalizedName = input.name.trim()
    const normalizedGrade = input.grade.trim()
    const normalizedEmail = input.email.trim().toLowerCase()

    if (!normalizedId || !normalizedPw || !normalizedName || !normalizedGrade || !normalizedEmail) {
      return '모든 항목을 입력하세요.'
    }

    try {
      const { user: nextUser } = await registerUser({
        username: normalizedId,
        password: normalizedPw,
        name: normalizedName,
        grade: normalizedGrade,
        email: normalizedEmail
      })
      setUser(nextUser)
      writeStoredUser(nextUser)
      setMode('student')
      return null
    } catch (err) {
      return err instanceof Error ? err.message : '회원가입에 실패했습니다.'
    }
  }, [])

  const logout = useCallback(async () => {
    await logoutUser()
    setUser(null)
    setMode('student')
    writeStoredUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isAuthenticated: Boolean(user),
      isAdmin,
      mode,
      login,
      register,
      logout,
      setMode
    }
  }, [isAdmin, login, logout, mode, register, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return value
}
