import { authFetch } from '../auth/api'
import type { StudentProfile, StudentProfileUpsertInput } from './types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

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

export async function getMyStudentProfile(signal?: AbortSignal): Promise<StudentProfile | null> {
  const response = await authFetch(`${API_BASE}/student/profile`, { signal })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(isApiError(json) ? json.error.message : '학생 프로필을 가져올 수 없습니다.')
  }

  const data = json as { profile: StudentProfile | null }
  return data.profile ?? null
}

export async function upsertMyStudentProfile(
  input: StudentProfileUpsertInput,
  signal?: AbortSignal
): Promise<StudentProfile> {
  const response = await authFetch(`${API_BASE}/student/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal
  })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(isApiError(json) ? json.error.message : '학생 프로필 저장에 실패했습니다.')
  }

  const data = json as { profile: StudentProfile | null }
  if (!data.profile) {
    throw new Error('학생 프로필 저장에 실패했습니다.')
  }
  return data.profile
}

