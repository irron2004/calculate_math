import type { Problem } from '../learn/problems'
import {
  createEmptyAttemptSessionStoreV1,
  submitAttemptSession,
  upsertDraftAttemptSession,
  updateDraftResponse
} from './attemptSession'

describe('AttemptSession core', () => {
  const now1 = '2026-01-15T00:00:00.000Z'
  const now2 = '2026-01-15T00:00:01.000Z'

  const problems: Problem[] = [
    { id: 'p1', type: 'numeric', prompt: '1+1', answer: '2' },
    { id: 'p2', type: 'numeric', prompt: '2+2', answer: '4' }
  ]

  it('creates an empty store', () => {
    expect(createEmptyAttemptSessionStoreV1()).toEqual({
      version: 1,
      sessionsById: {},
      draftSessionIdByNodeId: {}
    })
  })

  it('upserts a draft session and records node mapping', () => {
    const store0 = createEmptyAttemptSessionStoreV1()
    const { store, session } = upsertDraftAttemptSession({
      store: store0,
      nodeId: 'A',
      sessionId: 's1',
      now: now1
    })

    expect(store.draftSessionIdByNodeId.A).toBe('s1')
    expect(store.sessionsById.s1).toMatchObject({
      nodeId: 'A',
      sessionId: 's1',
      status: 'DRAFT',
      createdAt: now1,
      updatedAt: now1
    })
    expect(session.sessionId).toBe('s1')
  })

  it('updates draft responses deterministically', () => {
    const store0 = createEmptyAttemptSessionStoreV1()
    const { store: store1 } = upsertDraftAttemptSession({
      store: store0,
      nodeId: 'A',
      sessionId: 's1',
      now: now1
    })

    const store2 = updateDraftResponse({
      store: store1,
      sessionId: 's1',
      problemId: 'p1',
      inputRaw: '2',
      now: now2
    })

    expect(store2.sessionsById.s1.responses.p1).toMatchObject({
      problemId: 'p1',
      inputRaw: '2',
      updatedAt: now2
    })
    expect(store2.sessionsById.s1.updatedAt).toBe(now2)
  })

  it('submits a draft session with grading and clears draft mapping', () => {
    const store0 = createEmptyAttemptSessionStoreV1()
    const { store: store1 } = upsertDraftAttemptSession({
      store: store0,
      nodeId: 'A',
      sessionId: 's1',
      now: now1
    })

    const store2 = updateDraftResponse({
      store: store1,
      sessionId: 's1',
      problemId: 'p1',
      inputRaw: '2',
      now: now2
    })

    const store3 = submitAttemptSession({
      store: store2,
      sessionId: 's1',
      problems,
      now: now2
    })

    expect(store3.draftSessionIdByNodeId.A).toBeUndefined()
    expect(store3.sessionsById.s1.status).toBe('SUBMITTED')
    expect(store3.sessionsById.s1.grading).toMatchObject({
      totalCount: 2,
      correctCount: 1,
      accuracy: 0.5,
      cleared: false
    })
  })

  it('handles problem bank changes by grading only the current problems list', () => {
    const store0 = createEmptyAttemptSessionStoreV1()
    const { store: store1 } = upsertDraftAttemptSession({
      store: store0,
      nodeId: 'A',
      sessionId: 's1',
      now: now1
    })

    const store2 = updateDraftResponse({
      store: store1,
      sessionId: 's1',
      problemId: 'p1',
      inputRaw: '2',
      now: now2
    })

    const store3 = submitAttemptSession({
      store: store2,
      sessionId: 's1',
      problems: [problems[0]],
      now: now2
    })

    expect(store3.sessionsById.s1.grading).toMatchObject({
      totalCount: 1,
      correctCount: 1,
      accuracy: 1,
      cleared: true
    })
  })
})
