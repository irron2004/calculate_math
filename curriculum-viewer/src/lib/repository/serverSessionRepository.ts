import { authFetch } from '../auth/api'
import type { AttemptSessionV1 } from '../studentLearning/types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export async function syncSessionToServer(session: AttemptSessionV1): Promise<void> {
  try {
    const responses = Object.values(session.responses).map((r) => ({
      problemId: r.problemId,
      inputRaw: r.inputRaw,
      timeSpentMs: r.timeSpentMs,
      scratchpadStrokesJson: r.scratchpadStrokesJson ?? null
    }))

    const res = await authFetch(`${API_BASE}/study-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: session.nodeId,
        status: session.status,
        gradingJson: session.grading ? JSON.stringify(session.grading) : null,
        responses
      })
    })

    if (!res.ok) return
  } catch {
    // Best-effort: localStorage is source of truth, server sync can fail silently
  }
}
