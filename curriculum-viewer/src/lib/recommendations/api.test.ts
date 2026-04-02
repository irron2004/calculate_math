import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchRecommendations } from './api'

vi.mock('../auth/api', () => ({
  authFetch: vi.fn()
}))

import { authFetch } from '../auth/api'

describe('fetchRecommendations', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns items on success', async () => {
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ nodeId: 'n1', reason: '최근 3번 틀렸어요', score: 3.0 }]
      })
    } as Response)

    const result = await fetchRecommendations()
    expect(result.items).toHaveLength(1)
    expect(result.items[0].nodeId).toBe('n1')
    expect(result.items[0].reason).toBe('최근 3번 틀렸어요')
  })

  it('returns empty items on non-ok response', async () => {
    vi.mocked(authFetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Unauthorized' })
    } as Response)

    const result = await fetchRecommendations()
    expect(result.items).toEqual([])
  })

  it('returns empty items on network error', async () => {
    vi.mocked(authFetch).mockRejectedValue(new Error('Network error'))
    const result = await fetchRecommendations()
    expect(result.items).toEqual([])
  })
})
