import { describe, expect, it } from 'vitest'
import type { Problem } from '../learn/problems'
import { buildAdjacentGradeDiagnostic, parseCurriculumV1StandardNodeId } from './adjacentGradeDiagnostic'

function p(id: string): Problem {
  return { id, type: 'numeric', prompt: `prompt:${id}`, answer: '1' }
}

describe('parseCurriculumV1StandardNodeId', () => {
  it('parses v1 standard node ids', () => {
    expect(parseCurriculumV1StandardNodeId('MATH-2022-G-3-NA-001')).toEqual({ grade: 3, domainCode: 'NA' })
  })

  it('returns null for non-matching ids', () => {
    expect(parseCurriculumV1StandardNodeId('NA')).toBeNull()
  })
})

describe('buildAdjacentGradeDiagnostic', () => {
  it('builds deterministic pre/post plan for grade 3 (pre=2, post=4)', () => {
    const problemsByNodeId: Record<string, readonly Problem[]> = {
      'MATH-2022-G-2-NA-001': [p('g2-1'), p('g2-2')],
      'MATH-2022-G-2-NA-002': [p('g2-3'), p('g2-4')],
      'MATH-2022-G-4-NA-001': [p('g4-1'), p('g4-2')],
      'MATH-2022-G-4-NA-002': [p('g4-3'), p('g4-4')],
      'MATH-2022-G-2-RR-001': [p('rr-1'), p('rr-2')]
    }

    const first = buildAdjacentGradeDiagnostic({ grade: 3, problemsByNodeId })
    const second = buildAdjacentGradeDiagnostic({ grade: 3, problemsByNodeId })
    expect(first).toEqual(second)

    expect(first.ok).toBe(true)
    if (!first.ok) return

    expect(first.plan.preGrade).toBe(2)
    expect(first.plan.postGrade).toBe(4)
    expect(first.plan.counts).toEqual({ pre: 4, post: 4, fill: 0 })

    expect(first.plan.preNodeIds).toEqual(['MATH-2022-G-2-NA-001', 'MATH-2022-G-2-NA-002'])
    expect(first.plan.postNodeIds).toEqual(['MATH-2022-G-4-NA-001', 'MATH-2022-G-4-NA-002'])
    expect(first.plan.fillNodeIds).toEqual([])

    expect(first.plan.pickedProblemIds).toHaveLength(8)
    expect(first.plan.items.filter((x) => x.group === 'pre')).toHaveLength(4)
    expect(first.plan.items.filter((x) => x.group === 'post')).toHaveLength(4)
    expect(first.plan.items.filter((x) => x.group === 'fill')).toHaveLength(0)
  })

  it('fills missing pre band with same-grade problems for grade 1', () => {
    const problemsByNodeId: Record<string, readonly Problem[]> = {
      'MATH-2022-G-1-NA-001': [p('g1-1'), p('g1-2')],
      'MATH-2022-G-1-NA-002': [p('g1-3'), p('g1-4')],
      'MATH-2022-G-2-NA-001': [p('g2-1'), p('g2-2')],
      'MATH-2022-G-2-NA-002': [p('g2-3'), p('g2-4')]
    }

    const result = buildAdjacentGradeDiagnostic({ grade: 1, problemsByNodeId })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.plan.preGrade).toBeNull()
    expect(result.plan.postGrade).toBe(2)
    expect(result.plan.counts).toEqual({ pre: 0, post: 4, fill: 4 })
    expect(result.plan.fillNodeIds).toEqual(['MATH-2022-G-1-NA-001', 'MATH-2022-G-1-NA-002'])
    expect(result.plan.postNodeIds).toEqual(['MATH-2022-G-2-NA-001', 'MATH-2022-G-2-NA-002'])
    expect(result.plan.items.filter((x) => x.group === 'fill')).toHaveLength(4)
    expect(result.plan.items.filter((x) => x.group === 'post')).toHaveLength(4)
  })

  it('fills missing post band with same-grade problems for grade 6', () => {
    const problemsByNodeId: Record<string, readonly Problem[]> = {
      'MATH-2022-G-5-NA-001': [p('g5-1'), p('g5-2')],
      'MATH-2022-G-5-NA-002': [p('g5-3'), p('g5-4')],
      'MATH-2022-G-6-NA-001': [p('g6-1'), p('g6-2')],
      'MATH-2022-G-6-NA-002': [p('g6-3'), p('g6-4')]
    }

    const result = buildAdjacentGradeDiagnostic({ grade: 6, problemsByNodeId })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.plan.preGrade).toBe(5)
    expect(result.plan.postGrade).toBeNull()
    expect(result.plan.counts).toEqual({ pre: 4, post: 0, fill: 4 })
    expect(result.plan.preNodeIds).toEqual(['MATH-2022-G-5-NA-001', 'MATH-2022-G-5-NA-002'])
    expect(result.plan.fillNodeIds).toEqual(['MATH-2022-G-6-NA-001', 'MATH-2022-G-6-NA-002'])
    expect(result.plan.items.filter((x) => x.group === 'pre')).toHaveLength(4)
    expect(result.plan.items.filter((x) => x.group === 'fill')).toHaveLength(4)
  })

  it('throws for invalid grade', () => {
    expect(() => buildAdjacentGradeDiagnostic({ grade: 0, problemsByNodeId: {} })).toThrow(/Invalid grade/)
    expect(() => buildAdjacentGradeDiagnostic({ grade: 7, problemsByNodeId: {} })).toThrow(/Invalid grade/)
    expect(() => buildAdjacentGradeDiagnostic({ grade: 2.5, problemsByNodeId: {} })).toThrow(/Invalid grade/)
  })
})
