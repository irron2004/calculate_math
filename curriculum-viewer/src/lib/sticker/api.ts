import { authFetch } from '../auth/api'
import type { PraiseSticker, StickerSummary } from './types'

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

export class StickerApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'StickerApiError'
  }
}

export async function getStickerSummary(
  studentId: string,
  signal?: AbortSignal
): Promise<StickerSummary> {
  const encodedId = encodeURIComponent(studentId)
  const response = await authFetch(`${API_BASE}/students/${encodedId}/sticker-summary`, { signal })
  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new StickerApiError(json.error.code, json.error.message)
    }
    throw new StickerApiError('UNKNOWN', '스티커 요약을 불러올 수 없습니다.')
  }

  const data = json as { totalCount?: number; total?: number }
  const totalCount =
    typeof data.totalCount === 'number'
      ? data.totalCount
      : typeof data.total === 'number'
        ? data.total
        : null

  if (totalCount === null) {
    throw new StickerApiError('INVALID_RESPONSE', '스티커 요약을 불러올 수 없습니다.')
  }

  return { totalCount }
}

export async function listStickers(
  studentId: string,
  signal?: AbortSignal
): Promise<PraiseSticker[]> {
  const encodedId = encodeURIComponent(studentId)
  const response = await authFetch(`${API_BASE}/students/${encodedId}/stickers`, { signal })
  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new StickerApiError(json.error.code, json.error.message)
    }
    throw new StickerApiError('UNKNOWN', '스티커 내역을 불러올 수 없습니다.')
  }

  if (Array.isArray(json)) {
    return json as PraiseSticker[]
  }

  const data = json as { stickers?: PraiseSticker[] }
  if (!Array.isArray(data.stickers)) {
    throw new StickerApiError('INVALID_RESPONSE', '스티커 내역을 불러올 수 없습니다.')
  }

  return data.stickers
}
