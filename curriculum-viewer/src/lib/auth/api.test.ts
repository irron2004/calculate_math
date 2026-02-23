import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logoutUser } from './api'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStorage'

describe('logoutUser', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    window.sessionStorage.clear()
    clearTokens()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('clears tokens before logout request resolves', async () => {
    setTokens('access-token', 'refresh-token')

    let resolveFetch!: (value: Response) => void
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    const fetchMock = vi.fn(() => fetchPromise)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const logoutPromise = logoutUser()

    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()

    resolveFetch({ ok: true } as Response)
    await logoutPromise

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('does not call logout endpoint when refresh token is missing', async () => {
    clearTokens()
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await logoutUser()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })
})
