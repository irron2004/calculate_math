import type { AuthUser, LoginInput, RegisterInput, StudentInfo } from './types'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStorage'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

type AuthResponse = {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

type ApiError = {
  error: {
    code: string
    message: string
  }
}

function isApiError(data: unknown): data is ApiError {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.error !== 'object' || obj.error === null) return false
  const err = obj.error as Record<string, unknown>
  return typeof err.code === 'string' && typeof err.message === 'string'
}

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  const json = await response.json()
  if (!response.ok) {
    if (isApiError(json)) {
      throw new Error(json.error.message)
    }
    throw new Error('회원가입에 실패했습니다.')
  }
  const data = json as AuthResponse
  setTokens(data.accessToken, data.refreshToken)
  return data
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  const json = await response.json()
  if (!response.ok) {
    if (isApiError(json)) {
      throw new Error(json.error.message)
    }
    throw new Error('로그인에 실패했습니다.')
  }
  const data = json as AuthResponse
  setTokens(data.accessToken, data.refreshToken)
  return data
}

export async function refreshTokens(): Promise<AuthResponse | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })

  if (!response.ok) {
    clearTokens()
    return null
  }

  const data = (await response.json()) as AuthResponse
  setTokens(data.accessToken, data.refreshToken)
  return data
}

export async function fetchMe(): Promise<AuthUser> {
  const response = await authFetch(`${API_BASE}/auth/me`)
  const json = await response.json()
  if (!response.ok) {
    throw new Error(isApiError(json) ? json.error.message : '인증 정보를 가져올 수 없습니다.')
  }
  return json as AuthUser
}

export async function logoutUser(): Promise<void> {
  const refreshToken = getRefreshToken()
  if (refreshToken) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    }).catch(() => {})
  }
  clearTokens()
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const response = await authFetch(`${API_BASE}/auth/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword })
  })
  const json = await response.json()
  if (!response.ok) {
    if (isApiError(json)) {
      throw new Error(json.error.message)
    }
    throw new Error('비밀번호 변경에 실패했습니다.')
  }
}

export async function listStudents(signal?: AbortSignal): Promise<StudentInfo[]> {
  const response = await authFetch(`${API_BASE}/admin/users?role=student`, { signal })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(isApiError(json) ? json.error.message : '학생 목록을 가져올 수 없습니다.')
  }
  const users = (json as { users: AuthUser[] }).users
  return users.map((user) => ({
    id: user.username,
    name: user.name,
    grade: user.grade,
    email: user.email
  }))
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const accessToken = getAccessToken()
  const headers = new Headers(init.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  let response = await fetch(input, { ...init, headers })

  if (response.status === 401) {
    const refreshed = await refreshTokens()
    if (refreshed) {
      const retryHeaders = new Headers(init.headers)
      retryHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`)
      response = await fetch(input, { ...init, headers: retryHeaders })
    }
  }

  return response
}
