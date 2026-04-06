import { describe, expect, it } from 'vitest'
import problemsData from '../../../public/data/problems_v1.json'
import { parseProblemBank } from '../learn/problems'
import { buildAdjacentGradeDiagnostic } from './adjacentGradeDiagnostic'

describe('adjacent-grade diagnostic data policy', () => {
  it('has enough NA problems to build 8-question plans for grades 1..6', () => {
    const parsed = parseProblemBank(problemsData as unknown)
    expect(parsed).not.toBeNull()
    if (!parsed) return

    for (let grade = 1; grade <= 6; grade += 1) {
      const result = buildAdjacentGradeDiagnostic({ grade, problemsByNodeId: parsed.problemsByNodeId })
      expect(result.ok, `grade=${grade} error=${result.ok ? 'none' : result.error}`).toBe(true)
      if (!result.ok) continue

      expect(result.plan.desiredCount).toBe(8)
      expect(result.plan.items).toHaveLength(8)
      expect(result.plan.items.every((item) => item.nodeId.includes('-NA-'))).toBe(true)
      expect(new Set(result.plan.items.map((item) => `${item.nodeId}:${item.problemId}`)).size).toBe(8)

      if (grade === 1) {
        expect(result.plan.counts).toEqual({ pre: 0, post: 4, fill: 4 })
      } else if (grade === 6) {
        expect(result.plan.counts).toEqual({ pre: 4, post: 0, fill: 4 })
      } else {
        expect(result.plan.counts).toEqual({ pre: 4, post: 4, fill: 0 })
      }
    }
  })
})
