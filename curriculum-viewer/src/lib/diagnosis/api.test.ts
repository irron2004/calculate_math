import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveDiagnosis } from './api'

vi.mock('../auth/api', () => ({
  authFetch: vi.fn()
}))

import { authFetch } from '../auth/api'

describe('saveDiagnosis', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PATCHes /api/study-sessions/:id/diagnosis', async () => {
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    } as Response)

    await saveDiagnosis('session-abc', { skillId: 'AS.ADD_SUB', label: '덧셈과 뺄셈' })

    expect(authFetch).toHaveBeenCalledWith(
      expect.stringContaining('/study-sessions/session-abc/diagnosis'),
      expect.objectContaining({ method: 'PATCH' })
    )

    const callInit = vi.mocked(authFetch).mock.calls[0][1] as RequestInit
    const body = JSON.parse(callInit.body as string)
    expect(body.skillId).toBe('AS.ADD_SUB')
    expect(body.label).toBe('덧셈과 뺄셈')
  })

  it('silently swallows network errors', async () => {
    vi.mocked(authFetch).mockRejectedValue(new Error('Network error'))
    await expect(
      saveDiagnosis('session-abc', { skillId: 'CALC_MISTAKE', label: '계산 실수예요' })
    ).resolves.toBeUndefined()
  })

  it('silently swallows non-ok responses', async () => {
    vi.mocked(authFetch).mockResolvedValue({ ok: false, status: 404 } as Response)
    await expect(
      saveDiagnosis('session-abc', { skillId: 'AS.FRAC_BASIC', label: '분수 개념과 크기 비교' })
    ).resolves.toBeUndefined()
  })
})
