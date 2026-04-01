import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSkillLevels } from './api'

vi.mock('../auth/api', () => ({
  authFetch: vi.fn()
}))

import { authFetch } from '../auth/api'
const mockAuthFetch = vi.mocked(authFetch)

describe('fetchSkillLevels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns levels map on success', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ levels: { 'AS.ADD_SUB': 2, 'AS.PLACE_VALUE': 1 } })
    } as Response)

    const levels = await fetchSkillLevels()
    expect(levels).toEqual({ 'AS.ADD_SUB': 2, 'AS.PLACE_VALUE': 1 })
  })

  it('returns empty object when no skills learned', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ levels: {} })
    } as Response)

    const levels = await fetchSkillLevels()
    expect(levels).toEqual({})
  })

  it('throws on non-ok response', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: false,
      status: 401
    } as Response)

    await expect(fetchSkillLevels()).rejects.toThrow('fetchSkillLevels failed: 401')
  })

  it('calls the correct endpoint', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ levels: {} })
    } as Response)

    await fetchSkillLevels()
    expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/skill-levels'))
  })
})
