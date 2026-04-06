import fixturesRaw from '../../../docs/student-learning-loop-fixtures.v1.json'
import { createEmptyAttemptSessionStoreV1 } from './attemptSession'
import { computeNodeProgressV1, recommendNextNodeIds } from './progress'
import type { AttemptSessionStoreV1, LearningGraphV1, NodeStatus } from './types'

type FixtureCase = {
  id: string
  graph: LearningGraphV1
  store: AttemptSessionStoreV1
  expected: {
    statusByNodeId: Record<string, NodeStatus>
    recommendedNodeId: string | null
    lockedReasonsByNodeId?: Record<string, { missingPrereqNodeIds: string[] }>
  }
}

function asFixtures(): { cases: FixtureCase[] } {
  return fixturesRaw as unknown as { cases: FixtureCase[] }
}

describe('student learning loop progress (fixtures)', () => {
  for (const testCase of asFixtures().cases) {
    it(testCase.id, () => {
      const progressByNodeId = computeNodeProgressV1({
        graph: testCase.graph,
        store: testCase.store
      })

      const statusByNodeId: Record<string, NodeStatus> = {}
      for (const nodeId of Object.keys(testCase.expected.statusByNodeId)) {
        statusByNodeId[nodeId] = progressByNodeId[nodeId]?.status ?? 'LOCKED'
      }

      expect(statusByNodeId).toEqual(testCase.expected.statusByNodeId)

      const recommended = recommendNextNodeIds({
        graph: testCase.graph,
        store: testCase.store,
        maxCount: 1
      })

      expect(recommended[0] ?? null).toBe(testCase.expected.recommendedNodeId)

      if (testCase.expected.lockedReasonsByNodeId) {
        for (const [nodeId, expectedReasons] of Object.entries(testCase.expected.lockedReasonsByNodeId)) {
          expect(progressByNodeId[nodeId]?.lockedReasons).toEqual(expectedReasons)
        }
      }
    })
  }
})

describe('student learning loop recommendation', () => {
  it('prioritizes prepares_for from latest cleared submission', () => {
    const graph: LearningGraphV1 = {
      nodes: [
        { id: 'A', isStart: true, order: 1 },
        { id: 'B', isStart: true, order: 2 },
        { id: 'C', isStart: true, order: 3 }
      ],
      edges: [{ sourceId: 'A', targetId: 'C', type: 'prepares_for' }]
    }

    const store: AttemptSessionStoreV1 = {
      version: 1,
      sessionsById: {
        s1: {
          nodeId: 'A',
          sessionId: 's1',
          status: 'SUBMITTED',
          responses: {},
          grading: { totalCount: 5, correctCount: 4, accuracy: 0.8, cleared: true, perProblem: {} },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:10:00.000Z'
        }
      },
      draftSessionIdByNodeId: {}
    }

    expect(recommendNextNodeIds({ graph, store })).toEqual(['C', 'B'])
  })

  it('treats nodes without requires edges as AVAILABLE', () => {
    const graph: LearningGraphV1 = {
      nodes: [
        { id: 'A', isStart: true, order: 1 },
        { id: 'B', order: 2 }
      ],
      edges: []
    }

    const store = createEmptyAttemptSessionStoreV1()
    const progress = computeNodeProgressV1({ graph, store })
    expect(progress.A.status).toBe('AVAILABLE')
    expect(progress.B.status).toBe('AVAILABLE')
  })

  it('returns empty array when all nodes are LOCKED/CLEARED', () => {
    const graph: LearningGraphV1 = {
      nodes: [
        { id: 'A', isStart: true },
        { id: 'B' }
      ],
      edges: [{ sourceId: 'A', targetId: 'B', type: 'requires' }]
    }

    const store = createEmptyAttemptSessionStoreV1()
    const progress = computeNodeProgressV1({ graph, store })
    expect(progress.A.status).toBe('AVAILABLE')
    expect(progress.B.status).toBe('LOCKED')

    const clearedStore: AttemptSessionStoreV1 = {
      ...store,
      sessionsById: {
        s1: {
          nodeId: 'A',
          sessionId: 's1',
          status: 'SUBMITTED',
          responses: {},
          grading: { totalCount: 5, correctCount: 4, accuracy: 0.8, cleared: true, perProblem: {} },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:10:00.000Z'
        },
        s2: {
          nodeId: 'B',
          sessionId: 's2',
          status: 'SUBMITTED',
          responses: {},
          grading: { totalCount: 5, correctCount: 4, accuracy: 0.8, cleared: true, perProblem: {} },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:11:00.000Z'
        }
      }
    }

    expect(recommendNextNodeIds({ graph, store: clearedStore })).toEqual([])
  })
})

describe('student learning loop progress timestamps', () => {
  it('computes lastAttemptAt as max(draft.updatedAt, latest submitted.updatedAt)', () => {
    const graph: LearningGraphV1 = {
      nodes: [
        { id: 'A', isStart: true }
      ],
      edges: []
    }

    const store: AttemptSessionStoreV1 = {
      version: 1,
      sessionsById: {
        s1: {
          nodeId: 'A',
          sessionId: 's1',
          status: 'SUBMITTED',
          responses: {},
          grading: { totalCount: 5, correctCount: 3, accuracy: 0.6, cleared: false, perProblem: {} },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:10:00.000Z'
        },
        s2: {
          nodeId: 'A',
          sessionId: 's2',
          status: 'SUBMITTED',
          responses: {},
          grading: { totalCount: 5, correctCount: 4, accuracy: 0.8, cleared: true, perProblem: {} },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:20:00.000Z'
        },
        d1: {
          nodeId: 'A',
          sessionId: 'd1',
          status: 'DRAFT',
          responses: {},
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:30:00.000Z'
        }
      },
      draftSessionIdByNodeId: { A: 'd1' }
    }

    const progress = computeNodeProgressV1({ graph, store })
    expect(progress.A.lastAttemptAt).toBe('2026-01-15T00:30:00.000Z')
  })

  it('computes clearedAt as the first time a node was cleared (min cleared submitted.updatedAt)', () => {
    const graph: LearningGraphV1 = {
      nodes: [
        { id: 'A', isStart: true }
      ],
      edges: []
    }

    const store: AttemptSessionStoreV1 = {
      version: 1,
      sessionsById: {
        s1: {
          nodeId: 'A',
          sessionId: 's1',
          status: 'SUBMITTED',
          responses: {},
          grading: { totalCount: 5, correctCount: 4, accuracy: 0.8, cleared: true, perProblem: {} },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:10:00.000Z'
        },
        s2: {
          nodeId: 'A',
          sessionId: 's2',
          status: 'SUBMITTED',
          responses: {},
          grading: { totalCount: 5, correctCount: 5, accuracy: 1, cleared: true, perProblem: {} },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:20:00.000Z'
        }
      },
      draftSessionIdByNodeId: {}
    }

    const progress = computeNodeProgressV1({ graph, store })
    expect(progress.A.status).toBe('CLEARED')
    expect(progress.A.clearedAt).toBe('2026-01-15T00:10:00.000Z')
  })

  it('uses lastAttemptAt for IN_PROGRESS tie-breaker even when latest submit is not best accuracy', () => {
    const graph: LearningGraphV1 = {
      nodes: [
        { id: 'A', isStart: true, order: 1 },
        { id: 'B', isStart: true, order: 2 }
      ],
      edges: []
    }

    const store: AttemptSessionStoreV1 = {
      version: 1,
      sessionsById: {
        a1: {
          nodeId: 'A',
          sessionId: 'a1',
          status: 'SUBMITTED',
          responses: {},
          grading: { totalCount: 5, correctCount: 3, accuracy: 0.6, cleared: false, perProblem: {} },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:10:00.000Z'
        },
        a2: {
          nodeId: 'A',
          sessionId: 'a2',
          status: 'SUBMITTED',
          responses: {},
          grading: { totalCount: 5, correctCount: 2, accuracy: 0.4, cleared: false, perProblem: {} },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:20:00.000Z'
        },
        b1: {
          nodeId: 'B',
          sessionId: 'b1',
          status: 'SUBMITTED',
          responses: {},
          grading: { totalCount: 5, correctCount: 3, accuracy: 0.6, cleared: false, perProblem: {} },
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:15:00.000Z'
        }
      },
      draftSessionIdByNodeId: {}
    }

    const progress = computeNodeProgressV1({ graph, store })
    expect(progress.A.status).toBe('IN_PROGRESS')
    expect(progress.B.status).toBe('IN_PROGRESS')
    expect(progress.A.lastAttemptAt).toBe('2026-01-15T00:20:00.000Z')
    expect(progress.B.lastAttemptAt).toBe('2026-01-15T00:15:00.000Z')
    expect(recommendNextNodeIds({ graph, store, maxCount: 1 })).toEqual(['A'])
  })
})
