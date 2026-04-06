import { authFetch } from '../auth/api'
import type { RecommendationsResponse } from './types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export async function fetchRecommendations(
  signal?: AbortSignal
): Promise<RecommendationsResponse> {
  try {
    const res = await authFetch(`${API_BASE}/recommendations`, { signal })
    if (!res.ok) return { items: [] }
    return res.json() as Promise<RecommendationsResponse>
  } catch {
    return { items: [] }
  }
}
