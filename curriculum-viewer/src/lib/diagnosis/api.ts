import { authFetch } from '../auth/api'
import type { DiagnosisChoice } from './types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export async function saveDiagnosis(
  sessionId: string,
  choice: DiagnosisChoice
): Promise<void> {
  try {
    const res = await authFetch(
      `${API_BASE}/study-sessions/${encodeURIComponent(sessionId)}/diagnosis`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: choice.skillId, label: choice.label })
      }
    )
    if (!res.ok) return
  } catch {
    // Best-effort — diagnosis failures don't block the user
  }
}
