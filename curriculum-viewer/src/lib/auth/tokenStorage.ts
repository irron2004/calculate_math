const ACCESS_TOKEN_KEY = 'curriculum-viewer:auth:access'
const REFRESH_TOKEN_KEY = 'curriculum-viewer:auth:refresh'

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function getAccessToken(): string | null {
  const storage = getStorage()
  if (!storage) return null
  return storage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  const storage = getStorage()
  if (!storage) return null
  return storage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string): void {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(ACCESS_TOKEN_KEY, accessToken)
  storage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens(): void {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem(ACCESS_TOKEN_KEY)
  storage.removeItem(REFRESH_TOKEN_KEY)
}
