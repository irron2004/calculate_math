import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncSessionToServer } from './serverSessionRepository'
import type { AttemptSessionV1 } from '../studentLearning/types'

vi.mock('../auth/api', () => ({
  authFetch: vi.fn()
}))

import { authFetch } from '../auth/api'

const makeSession = (overrides: Partial<AttemptSessionV1> = {}): AttemptSessionV1 => ({
  nodeId: 'node1',
  sessionId: 'local-id',
  status: 'SUBMITTED',
  responses: {
    p1: {
      problemId: 'p1',
      inputRaw: '42',
      updatedAt: '2026-01-01T00:00:00Z',
      timeSpentMs: 1000,
      answerEditCount: 1,
      scratchpadStrokesJson: null
    }
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides
})

describe('syncSessionToServer', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('POSTs session data to /api/study-sessions', async () => {
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 'server-id', status: 'SUBMITTED' })
    } as Response)

    await syncSessionToServer(makeSession())

    expect(authFetch).toHaveBeenCalledWith(
      expect.stringContaining('/study-sessions'),
      expect.objectContaining({ method: 'POST' })
    )

    const callInit = vi.mocked(authFetch).mock.calls[0][1] as RequestInit
    const body = JSON.parse(callInit.body as string)
    expect(body.nodeId).toBe('node1')
    expect(body.status).toBe('SUBMITTED')
    expect(body.responses).toHaveLength(1)
    expect(body.responses[0].problemId).toBe('p1')
  })

  it('silently swallows network errors', async () => {
    vi.mocked(authFetch).mockRejectedValue(new Error('Network error'))
    await expect(syncSessionToServer(makeSession())).resolves.toBeUndefined()
  })

  it('silently swallows non-ok responses', async () => {
    vi.mocked(authFetch).mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(syncSessionToServer(makeSession())).resolves.toBeUndefined()
  })
})
