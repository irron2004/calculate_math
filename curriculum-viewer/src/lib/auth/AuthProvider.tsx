import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type AuthUser = {
  username: string
}

export type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (username: string) => void
  logout: () => void
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

    const username = typeof parsed.username === 'string' ? parsed.username.trim() : ''
    if (username.length === 0) return null

    return { username }
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

  const login = useCallback((username: string) => {
    const normalized = username.trim()
    if (normalized.length === 0) return

    const nextUser: AuthUser = { username: normalized }
    setUser(nextUser)
    writeStoredUser(nextUser)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    writeStoredUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isAuthenticated: Boolean(user),
      login,
      logout
    }
  }, [login, logout, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return value
}
