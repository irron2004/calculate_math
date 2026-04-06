import type { CurriculumNode } from '../curriculum/types'
import type { Problem } from '../learn/problems'
import { getDomainStats, getNodeStatusMap, getProgressStats, getRecommendation } from './core'
import { LAST_RESULT_PREFIX, readLastResultsByNodeId } from './storage'
import type { StoredResultV1 } from './storage'

type SubmissionRecord = { submitted: string; isCorrect: boolean }

const baseProblems: Problem[] = [
  { id: 'p1', type: 'numeric', prompt: 'Q1', answer: '1' },
  { id: 'p2', type: 'numeric', prompt: 'Q2', answer: '2' },
  { id: 'p3', type: 'numeric', prompt: 'Q3', answer: '3' }
]

const baseNodes: CurriculumNode[] = [
  { id: 'std-1', type: 'standard', title: 'Standard 1', children_ids: [] }
]

const baseProblemsByNodeId: Record<string, Problem[]> = {
  'std-1': baseProblems
}

function statusFor(
  submissions: Record<string, SubmissionRecord> | null,
  problemsByNodeId: Record<string, Problem[]> = baseProblemsByNodeId
) {
  const lastResultsByNodeId: Record<string, StoredResultV1> = submissions
    ? { 'std-1': { nodeId: 'std-1', submissions } }
    : {}

  return getNodeStatusMap({
    curriculumNodes: baseNodes,
    problemsByNodeId,
    lastResultsByNodeId,
    threshold: 1
  }).get('std-1')
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('getNodeStatusMap (standard status)', () => {
  it('returns not-started when no result exists', () => {
    expect(statusFor(null)).toBe('not-started')
  })

  it('returns not-started when submissions are blank', () => {
    expect(statusFor({ p1: { submitted: '   ', isCorrect: false } })).toBe('not-started')
  })

  it('returns in-progress when partially submitted and correct', () => {
    expect(statusFor({ p1: { submitted: '1', isCorrect: true } })).toBe('in-progress')
  })

  it('returns in-progress when partially submitted and incorrect', () => {
    expect(
      statusFor({
        p1: { submitted: '1', isCorrect: true },
        p2: { submitted: '2', isCorrect: false }
      })
    ).toBe('in-progress')
  })

  it('returns complete when all problems are correct', () => {
    expect(
      statusFor({
        p1: { submitted: '1', isCorrect: true },
        p2: { submitted: '2', isCorrect: true },
        p3: { submitted: '3', isCorrect: true }
      })
    ).toBe('complete')
  })

  it('returns in-progress when all submitted but one incorrect', () => {
    expect(
      statusFor({
        p1: { submitted: '1', isCorrect: true },
        p2: { submitted: '2', isCorrect: true },
        p3: { submitted: '3', isCorrect: false }
      })
    ).toBe('in-progress')
  })

  it('ignores submissions for unknown problem ids', () => {
    expect(statusFor({ px: { submitted: '1', isCorrect: true } })).toBe('not-started')
  })

  it('treats comma-separated numeric input as submitted', () => {
    expect(statusFor({ p1: { submitted: '1,000', isCorrect: true } })).toBe('in-progress')
  })

  it('returns no-content when the problem list is empty', () => {
    expect(statusFor({ p1: { submitted: '1', isCorrect: true } }, { 'std-1': [] })).toBe('no-content')
  })
})

describe('getProgressStats', () => {
  it('aggregates completion, accuracy, and latest study date', () => {
    const curriculumNodes: CurriculumNode[] = [
      { id: 'subject', type: 'subject', title: 'Math', children_ids: ['grade-3'] },
      { id: 'grade-3', type: 'grade', title: 'Grade 3', grade: 3, parent_id: 'subject', children_ids: ['domain-na', 'domain-gm'] },
      { id: 'domain-na', type: 'domain', title: 'Numbers', domain_code: 'NA', parent_id: 'grade-3', children_ids: ['std-a', 'std-b'] },
      { id: 'std-a', type: 'standard', title: 'Std A', parent_id: 'domain-na', children_ids: [] },
      { id: 'std-b', type: 'standard', title: 'Std B', parent_id: 'domain-na', children_ids: [] },
      { id: 'domain-gm', type: 'domain', title: 'Geometry', domain_code: 'GM', parent_id: 'grade-3', children_ids: ['std-c'] },
      { id: 'std-c', type: 'standard', title: 'Std C', parent_id: 'domain-gm', children_ids: [] }
    ]

    const problemsByNodeId: Record<string, Problem[]> = {
      'std-a': [
        { id: 'p1', type: 'numeric', prompt: 'Q1', answer: '1' },
        { id: 'p2', type: 'numeric', prompt: 'Q2', answer: '2' }
      ],
      'std-b': [{ id: 'p3', type: 'numeric', prompt: 'Q3', answer: '3' }],
      'std-c': [{ id: 'p4', type: 'numeric', prompt: 'Q4', answer: '4' }]
    }

    const lastResultsByNodeId = {
      'std-a': {
        nodeId: 'std-a',
        updatedAt: '2026-01-01T00:00:00.000Z',
        submissions: {
          p1: { submitted: '1', isCorrect: true },
          p2: { submitted: '2', isCorrect: true }
        }
      },
      'std-b': {
        nodeId: 'std-b',
        updatedAt: '2026-01-05T00:00:00.000Z',
        submissions: {
          p3: { submitted: '2', isCorrect: false }
        }
      }
    }

    const stats = getProgressStats({
      curriculumNodes,
      problemsByNodeId,
      lastResultsByNodeId,
      threshold: 1
    })

    expect(stats.completedStandards).toBe(1)
    expect(stats.eligibleStandardCount).toBe(3)
    expect(stats.overallCompletionRate).toBeCloseTo(1 / 3)
    expect(stats.totalSubmittedProblems).toBe(3)
    expect(stats.totalCorrectProblems).toBe(2)
    expect(stats.averageAccuracy).toBeCloseTo(2 / 3)
    expect(stats.latestUpdatedAt).toBe('2026-01-05T00:00:00.000Z')
  })

  it('returns null rates when there are no eligible standards', () => {
    const stats = getProgressStats({
      curriculumNodes: [],
      problemsByNodeId: {},
      lastResultsByNodeId: {},
      threshold: 1
    })

    expect(stats.completedStandards).toBe(0)
    expect(stats.eligibleStandardCount).toBe(0)
    expect(stats.overallCompletionRate).toBeNull()
    expect(stats.totalSubmittedProblems).toBe(0)
    expect(stats.totalCorrectProblems).toBe(0)
    expect(stats.averageAccuracy).toBeNull()
    expect(stats.latestUpdatedAt).toBeNull()
  })
})

describe('getDomainStats', () => {
  it('aggregates domain completion and mastery', () => {
    const curriculumNodes: CurriculumNode[] = [
      { id: 'grade-3', type: 'grade', title: 'Grade 3', grade: 3, children_ids: ['domain-na', 'domain-gm'] },
      { id: 'domain-na', type: 'domain', title: 'Numbers', domain_code: 'NA', parent_id: 'grade-3', children_ids: ['std-a'] },
      { id: 'std-a', type: 'standard', title: 'Std A', parent_id: 'domain-na', children_ids: [] },
      { id: 'domain-gm', type: 'domain', title: 'Geometry', domain_code: 'GM', parent_id: 'grade-3', children_ids: ['std-b'] },
      { id: 'std-b', type: 'standard', title: 'Std B', parent_id: 'domain-gm', children_ids: [] }
    ]

    const problemsByNodeId: Record<string, Problem[]> = {
      'std-a': [
        { id: 'p1', type: 'numeric', prompt: 'Q1', answer: '1' },
        { id: 'p2', type: 'numeric', prompt: 'Q2', answer: '2' }
      ],
      'std-b': [{ id: 'p3', type: 'numeric', prompt: 'Q3', answer: '3' }]
    }

    const lastResultsByNodeId = {
      'std-a': {
        nodeId: 'std-a',
        submissions: {
          p1: { submitted: '1', isCorrect: true },
          p2: { submitted: '2', isCorrect: false }
        }
      }
    }

    const stats = getDomainStats({
      curriculumNodes,
      problemsByNodeId,
      lastResultsByNodeId,
      threshold: 1
    })

    const gm = stats.find((stat) => stat.domainKey === 'GM')
    const na = stats.find((stat) => stat.domainKey === 'NA')

    expect(gm).toMatchObject({
      eligibleStandardCount: 1,
      completedStandards: 0,
      completionRate: 0,
      domainTotal: 1,
      domainSubmitted: 0,
      domainCorrect: 0,
      domainMastery: 0
    })

    expect(na).toMatchObject({
      eligibleStandardCount: 1,
      completedStandards: 0,
      completionRate: 0,
      domainTotal: 2,
      domainSubmitted: 2,
      domainCorrect: 1,
      domainMastery: 0.5
    })
  })
})

describe('getRecommendation', () => {
  it('chooses the lowest completion domain and breaks ties by grade', () => {
    const curriculumNodes: CurriculumNode[] = [
      { id: 'subject', type: 'subject', title: 'Math', children_ids: ['grade-2', 'grade-3'] },
      { id: 'grade-2', type: 'grade', title: 'Grade 2', grade: 2, parent_id: 'subject', children_ids: ['domain-na-2'] },
      { id: 'grade-3', type: 'grade', title: 'Grade 3', grade: 3, parent_id: 'subject', children_ids: ['domain-na-3'] },
      { id: 'domain-na-2', type: 'domain', title: 'Numbers', domain_code: 'NA', parent_id: 'grade-2', children_ids: ['std-na-2'] },
      { id: 'std-na-2', type: 'standard', title: 'Std NA 2', parent_id: 'domain-na-2', children_ids: [] },
      { id: 'domain-na-3', type: 'domain', title: 'Numbers', domain_code: 'NA', parent_id: 'grade-3', children_ids: ['std-na-3'] },
      { id: 'std-na-3', type: 'standard', title: 'Std NA 3', parent_id: 'domain-na-3', children_ids: [] }
    ]

    const problemsByNodeId: Record<string, Problem[]> = {
      'std-na-2': [{ id: 'p1', type: 'numeric', prompt: 'Q1', answer: '1' }],
      'std-na-3': [{ id: 'p2', type: 'numeric', prompt: 'Q2', answer: '2' }]
    }

    const recommendation = getRecommendation({
      curriculumNodes,
      problemsByNodeId,
      lastResultsByNodeId: {},
      threshold: 1
    })

    expect(recommendation).toEqual({ nodeId: 'std-na-2', domainKey: 'NA' })
  })

  it('is deterministic regardless of curriculum node order', () => {
    const curriculumNodes: CurriculumNode[] = [
      { id: 'domain', type: 'domain', title: 'Numbers', domain_code: 'NA', children_ids: ['std-a', 'std-b'] },
      { id: 'std-a', type: 'standard', title: 'Std A', parent_id: 'domain', children_ids: [] },
      { id: 'std-b', type: 'standard', title: 'Std B', parent_id: 'domain', children_ids: [] }
    ]

    const problemsByNodeId: Record<string, Problem[]> = {
      'std-a': [{ id: 'p1', type: 'numeric', prompt: 'Q1', answer: '1' }],
      'std-b': [{ id: 'p2', type: 'numeric', prompt: 'Q2', answer: '2' }]
    }

    const lastResultsByNodeId = {
      'std-b': {
        nodeId: 'std-b',
        submissions: {
          p2: { submitted: '2', isCorrect: false }
        }
      }
    }

    const first = getRecommendation({
      curriculumNodes,
      problemsByNodeId,
      lastResultsByNodeId,
      threshold: 1
    })

    const second = getRecommendation({
      curriculumNodes: [...curriculumNodes].reverse(),
      problemsByNodeId,
      lastResultsByNodeId,
      threshold: 1
    })

    expect(second).toEqual(first)
  })
})

describe('readLastResultsByNodeId', () => {
  it('ignores invalid JSON and mismatched schemas', () => {
    window.localStorage.setItem(`${LAST_RESULT_PREFIX}bad`, '{not-json')
    window.localStorage.setItem(
      `${LAST_RESULT_PREFIX}wrong`,
      JSON.stringify({ nodeId: 'other', submissions: {} })
    )
    window.localStorage.setItem(
      `${LAST_RESULT_PREFIX}ok`,
      JSON.stringify({
        nodeId: 'ok',
        updatedAt: '2026-01-01T00:00:00.000Z',
        submissions: { p1: { submitted: '1', isCorrect: 'yes' } }
      })
    )

    const result = readLastResultsByNodeId(window.localStorage)

    expect(result['bad']).toBeUndefined()
    expect(result['wrong']).toBeUndefined()
    expect(result['ok']?.submissions.p1.isCorrect).toBe(true)
  })
})
