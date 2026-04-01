import { authFetch } from '../auth/api'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export interface SkillLevelsResponse {
  levels: Record<string, number>
}

/**
 * Fetches the current student's AtomicSkill levels.
 * Returns a map of skillId → level (0–3). Only skills with level > 0 are included.
 */
export async function fetchSkillLevels(): Promise<Record<string, number>> {
  const res = await authFetch(`${API_BASE}/skill-levels`)
  if (!res.ok) {
    throw new Error(`fetchSkillLevels failed: ${res.status}`)
  }
  const data: SkillLevelsResponse = await res.json()
  return data.levels
}
