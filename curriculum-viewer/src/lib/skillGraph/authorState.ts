const AUTHOR_ACTIVE_GRAPH_ID_KEY = 'curriculum-viewer:skill-graph:author:active_graph_id:v1'

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function getAuthorActiveGraphId(): string | null {
  const storage = getSessionStorage()
  if (!storage) return null
  try {
    const value = storage.getItem(AUTHOR_ACTIVE_GRAPH_ID_KEY)
    const trimmed = value ? value.trim() : ''
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

export function setAuthorActiveGraphId(graphId: string | null): void {
  const storage = getSessionStorage()
  if (!storage) return
  try {
    if (!graphId) {
      storage.removeItem(AUTHOR_ACTIVE_GRAPH_ID_KEY)
      return
    }
    storage.setItem(AUTHOR_ACTIVE_GRAPH_ID_KEY, graphId)
  } catch {
    // ignore
  }
}

