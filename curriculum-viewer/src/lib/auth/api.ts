import type { AuthUser, LoginInput, RegisterInput, StudentInfo } from './types'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStorage'

const apiBaseFromEnv = import.meta.env.VITE_API_URL
const API_BASE = import.meta.env.DEV ? '/api' : (apiBaseFromEnv || '/api')

// Retry configuration for Railway cold start
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retries = MAX_RETRIES
): Promise<Response> {
  try {
    const response = await fetch(input, init)
    return response
  } catch (err) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      return fetchWithRetry(input, init, retries - 1)
    }
    throw err
  }
}

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
  const response = await fetchWithRetry(`${API_BASE}/auth/register`, {
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
  const response = await fetchWithRetry(`${API_BASE}/auth/login`, {
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

  try {
    const response = await fetchWithRetry(`${API_BASE}/auth/refresh`, {
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
  } catch {
    clearTokens()
    return null
  }
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
  clearTokens()
  if (refreshToken) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    }).catch(() => {})
  }
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
  const response = await authFetch(`${API_BASE}/admin/students`, { signal })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(isApiError(json) ? json.error.message : '학생 목록을 가져올 수 없습니다.')
  }
  const students = (json as { students: StudentInfo[] }).students
  return students.map((student) => ({
    id: student.id,
    name: student.name,
    grade: student.grade,
    email: student.email,
    profile: student.profile ?? null,
    praiseStickerEnabled: Boolean(student.praiseStickerEnabled)
  }))
}

type AdminStudentFeaturesUpdateResponse = {
  success: boolean
  praiseStickerEnabled: boolean
}

export type AdminGrantStickerInput = {
  count: number
  reason: string
}

export type AdminGrantStickerResponse = {
  id: string
  studentId: string
  count: number
  reason: string
  reasonType: 'homework_excellent' | 'bonus'
  homeworkId?: string | null
  grantedBy?: string | null
  grantedAt: string
}

export async function updateStudentFeatures(
  studentId: string,
  features: { praiseStickerEnabled: boolean }
): Promise<AdminStudentFeaturesUpdateResponse> {
  const encodedId = encodeURIComponent(studentId)
  const response = await authFetch(`${API_BASE}/admin/students/${encodedId}/features`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(features)
  })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(isApiError(json) ? json.error.message : '학생 설정을 변경할 수 없습니다.')
  }
  return json as AdminStudentFeaturesUpdateResponse
}

export async function grantStudentSticker(
  studentId: string,
  input: AdminGrantStickerInput
): Promise<AdminGrantStickerResponse> {
  const encodedId = encodeURIComponent(studentId)
  const response = await authFetch(`${API_BASE}/students/${encodedId}/stickers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(isApiError(json) ? json.error.message : '칭찬 스티커 지급에 실패했습니다.')
  }
  return json as AdminGrantStickerResponse
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const accessToken = getAccessToken()
  const headers = new Headers(init.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  let response = await fetchWithRetry(input, { ...init, headers })

  if (response.status === 401) {
    const refreshed = await refreshTokens()
    if (refreshed) {
      const retryHeaders = new Headers(init.headers)
      retryHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`)
      response = await fetchWithRetry(input, { ...init, headers: retryHeaders })
    }
  }

  return response
}
