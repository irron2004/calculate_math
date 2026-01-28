import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type AuthUser = {
  id: string
  name: string
  grade: string
  email: string
}

export type RegisterInput = {
  id: string
  password: string
  name: string
  grade: string
  email: string
}

export type AppMode = 'student' | 'author'

export type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  mode: AppMode
  login: (id: string, password: string) => string | null
  register: (input: RegisterInput) => string | null
  logout: () => void
  setMode: (mode: AppMode) => void
}

export const AUTH_STORAGE_KEY = 'curriculum-viewer:auth'
export const AUTH_USER_DB_STORAGE_KEY = 'curriculum-viewer:auth:user_db:v1'
export const ADMIN_USER_ID = 'admin'
const ADMIN_DEFAULT_PASSWORD = 'admin'

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

type StoredUser = RegisterInput & { createdAt: string }

type StoredUserDb = {
  version: 1
  usersById: Record<string, StoredUser>
}

function ensureAdminUser(db: StoredUserDb): { db: StoredUserDb; changed: boolean } {
  if (db.usersById[ADMIN_USER_ID]) {
    return { db, changed: false }
  }

  const now = new Date().toISOString()
  return {
    db: {
      version: 1,
      usersById: {
        ...db.usersById,
        [ADMIN_USER_ID]: {
          id: ADMIN_USER_ID,
          password: ADMIN_DEFAULT_PASSWORD,
          name: 'Admin',
          grade: 'admin',
          email: 'admin@local',
          createdAt: now
        }
      }
    },
    changed: true
  }
}

function readUserDb(): StoredUserDb {
  const storage = getLocalStorage()
  if (!storage) return { version: 1, usersById: {} }

  const raw = storage.getItem(AUTH_USER_DB_STORAGE_KEY)
  if (!raw) return { version: 1, usersById: {} }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return { version: 1, usersById: {} }
    if (parsed.version !== 1) return { version: 1, usersById: {} }

    const usersByIdRaw = parsed.usersById
    if (!isRecord(usersByIdRaw)) return { version: 1, usersById: {} }

    const usersById: Record<string, StoredUser> = {}
    for (const [key, value] of Object.entries(usersByIdRaw)) {
      if (!isRecord(value)) continue

      const id = typeof value.id === 'string' ? value.id.trim() : ''
      const password = typeof value.password === 'string' ? value.password : ''
      const name = typeof value.name === 'string' ? value.name.trim() : ''
      const grade = typeof value.grade === 'string' ? value.grade.trim() : ''
      const email = typeof value.email === 'string' ? value.email.trim() : ''
      const createdAt =
        typeof value.createdAt === 'string' ? value.createdAt : ''

      if (!id || !password || !name || !grade || !email || !createdAt) continue

      usersById[key] = { id, password, name, grade, email, createdAt }
    }

    const ensured = ensureAdminUser({ version: 1, usersById })
    if (ensured.changed) {
      writeUserDb(ensured.db)
    }
    return ensured.db
  } catch {
    const ensured = ensureAdminUser({ version: 1, usersById: {} })
    if (ensured.changed) {
      writeUserDb(ensured.db)
    }
    return ensured.db
  }
}

function writeUserDb(db: StoredUserDb): void {
  const storage = getLocalStorage()
  if (!storage) return

  storage.setItem(AUTH_USER_DB_STORAGE_KEY, JSON.stringify(db))
}

function readStoredUser(): AuthUser | null {
  const storage = getLocalStorage()
  if (!storage) return null

  const raw = storage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return null

    const idRaw =
      typeof parsed.id === 'string'
        ? parsed.id.trim()
        : typeof parsed.username === 'string'
          ? parsed.username.trim()
          : ''
    if (idRaw.length === 0) return null

    const nameRaw = typeof parsed.name === 'string' ? parsed.name.trim() : ''
    const gradeRaw = typeof parsed.grade === 'string' ? parsed.grade.trim() : ''
    const emailRaw = typeof parsed.email === 'string' ? parsed.email.trim() : ''

    return {
      id: idRaw,
      name: nameRaw.length > 0 ? nameRaw : idRaw,
      grade: gradeRaw,
      email: emailRaw
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
  const isAdmin = user?.id === ADMIN_USER_ID

  useEffect(() => {
    readUserDb()
  }, [])

  const login = useCallback((id: string, password: string) => {
    const normalizedId = id.trim()
    const normalizedPw = password.trim()
    if (normalizedId.length === 0 || normalizedPw.length === 0) {
      return '아이디와 비밀번호를 입력하세요.'
    }

    const db = readUserDb()
    const stored = db.usersById[normalizedId]
    if (!stored) {
      return '계정을 찾을 수 없습니다. 회원가입을 해주세요.'
    }

    if (stored.password !== normalizedPw) {
      return '비밀번호가 올바르지 않습니다.'
    }

    const nextUser: AuthUser = {
      id: stored.id,
      name: stored.name,
      grade: stored.grade,
      email: stored.email
    }
    setUser(nextUser)
    writeStoredUser(nextUser)
    return null
  }, [])

  const register = useCallback((input: RegisterInput) => {
    const normalizedId = input.id.trim()
    const normalizedPw = input.password.trim()
    const normalizedName = input.name.trim()
    const normalizedGrade = input.grade.trim()
    const normalizedEmail = input.email.trim().toLowerCase()

    if (
      normalizedId.length === 0 ||
      normalizedPw.length === 0 ||
      normalizedName.length === 0 ||
      normalizedGrade.length === 0 ||
      normalizedEmail.length === 0
    ) {
      return '모든 항목을 입력하세요.'
    }

    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      return '이메일 형식이 올바르지 않습니다.'
    }

    const db = readUserDb()
    if (db.usersById[normalizedId]) {
      return '이미 존재하는 아이디입니다.'
    }

    const stored: StoredUser = {
      id: normalizedId,
      password: normalizedPw,
      name: normalizedName,
      grade: normalizedGrade,
      email: normalizedEmail,
      createdAt: new Date().toISOString()
    }

    db.usersById[normalizedId] = stored
    writeUserDb(db)

    const nextUser: AuthUser = {
      id: stored.id,
      name: stored.name,
      grade: stored.grade,
      email: stored.email
    }

    setUser(nextUser)
    writeStoredUser(nextUser)
    return null
  }, [])

  const logout = useCallback(() => {
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

export type StudentInfo = {
  id: string
  name: string
  grade: string
  email: string
}

export function getAllStudents(): StudentInfo[] {
  const db = readUserDb()
  const students: StudentInfo[] = []

  for (const [id, user] of Object.entries(db.usersById)) {
    if (id === ADMIN_USER_ID) continue
    students.push({
      id: user.id,
      name: user.name,
      grade: user.grade,
      email: user.email
    })
  }

  return students.sort((a, b) => a.name.localeCompare(b.name))
}
