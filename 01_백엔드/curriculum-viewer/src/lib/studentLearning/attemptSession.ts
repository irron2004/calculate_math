import { gradeNumericAnswer } from '../learn/grading'
import type { Problem } from '../learn/problems'
import type {
  AttemptResponse,
  AttemptSessionStoreV1,
  AttemptSessionV1,
  GradingResultV1,
  TagAccuracy
} from './types'
import { CLEAR_THRESHOLD } from './types'

export function createEmptyAttemptSessionStoreV1(): AttemptSessionStoreV1 {
  return { version: 1, sessionsById: {}, draftSessionIdByNodeId: {} }
}

export function getDraftAttemptSession(
  store: AttemptSessionStoreV1,
  nodeId: string
): AttemptSessionV1 | null {
  const sessionId = store.draftSessionIdByNodeId[nodeId]
  if (!sessionId) return null
  const session = store.sessionsById[sessionId]
  if (!session) return null
  return session.status === 'DRAFT' && session.nodeId === nodeId ? session : null
}

export function createDraftAttemptSession(params: {
  nodeId: string
  sessionId: string
  now: string
}): AttemptSessionV1 {
  return {
    nodeId: params.nodeId,
    sessionId: params.sessionId,
    status: 'DRAFT',
    responses: {},
    createdAt: params.now,
    updatedAt: params.now
  }
}

export function upsertDraftAttemptSession(params: {
  store: AttemptSessionStoreV1
  nodeId: string
  sessionId: string
  now: string
}): { store: AttemptSessionStoreV1; session: AttemptSessionV1 } {
  const existing = getDraftAttemptSession(params.store, params.nodeId)
  if (existing) {
    return { store: params.store, session: existing }
  }

  const session = createDraftAttemptSession({
    nodeId: params.nodeId,
    sessionId: params.sessionId,
    now: params.now
  })

  return {
    store: {
      ...params.store,
      sessionsById: { ...params.store.sessionsById, [session.sessionId]: session },
      draftSessionIdByNodeId: {
        ...params.store.draftSessionIdByNodeId,
        [params.nodeId]: session.sessionId
      }
    },
    session
  }
}

export function updateDraftResponse(params: {
  store: AttemptSessionStoreV1
  sessionId: string
  problemId: string
  inputRaw: string
  now: string
  // 레벨 2 필드 (선택)
  timeSpentMs?: number
  answerEditCount?: number
  scratchpadStrokesJson?: string | null
}): AttemptSessionStoreV1 {
  const session = params.store.sessionsById[params.sessionId]
  if (!session || session.status !== 'DRAFT') return params.store

  // 기존 response가 있으면 레벨2 값 유지
  const existing = session.responses[params.problemId]

  const response: AttemptResponse = {
    problemId: params.problemId,
    inputRaw: params.inputRaw,
    updatedAt: params.now,
    timeSpentMs: params.timeSpentMs ?? existing?.timeSpentMs ?? 0,
    answerEditCount: params.answerEditCount ?? existing?.answerEditCount ?? 0,
    scratchpadStrokesJson: params.scratchpadStrokesJson !== undefined
      ? params.scratchpadStrokesJson
      : (existing?.scratchpadStrokesJson ?? null)
  }

  const nextSession: AttemptSessionV1 = {
    ...session,
    responses: { ...session.responses, [params.problemId]: response },
    updatedAt: params.now
  }

  return {
    ...params.store,
    sessionsById: { ...params.store.sessionsById, [params.sessionId]: nextSession }
  }
}

export function gradeResponses(params: {
  problems: ReadonlyArray<Problem>
  responses: Record<string, AttemptResponse>
  clearThreshold?: number
}): GradingResultV1 {
  const totalCount = params.problems.length
  const threshold = typeof params.clearThreshold === 'number' ? params.clearThreshold : CLEAR_THRESHOLD

  let correctCount = 0
  const perProblem: GradingResultV1['perProblem'] = {}
  const tagStats: Map<string, { total: number; correct: number }> = new Map()

  for (const problem of params.problems) {
    const response = params.responses[problem.id]
    const submitted = response?.inputRaw ?? ''

    const graded = gradeNumericAnswer(submitted, problem.answer)
    if (graded.isCorrect) {
      correctCount += 1
    }

    perProblem[problem.id] = {
      isCorrect: graded.isCorrect,
      expectedAnswer: problem.answer,
      explanation: problem.explanation,
      // 레벨 2: 풀이 과정 기록 (평가 화면에서 확인용)
      timeSpentMs: response?.timeSpentMs ?? 0,
      answerEditCount: response?.answerEditCount ?? 0,
      scratchpadStrokesJson: response?.scratchpadStrokesJson ?? null
    }

    // 태그별 통계 계산
    if (problem.tags && problem.tags.length > 0) {
      for (const tag of problem.tags) {
        const stat = tagStats.get(tag) ?? { total: 0, correct: 0 }
        stat.total += 1
        if (graded.isCorrect) stat.correct += 1
        tagStats.set(tag, stat)
      }
    }
  }

  const accuracy = totalCount > 0 ? correctCount / totalCount : 0
  const cleared = totalCount > 0 && accuracy >= threshold

  // 태그별 정답률 배열 생성
  let perTag: TagAccuracy[] | undefined
  if (tagStats.size > 0) {
    perTag = Array.from(tagStats.entries())
      .map(([tag, stat]) => ({
        tag,
        totalCount: stat.total,
        correctCount: stat.correct,
        accuracy: stat.total > 0 ? stat.correct / stat.total : 0
      }))
      .sort((a, b) => a.accuracy - b.accuracy) // 정답률 낮은 순 (약점 먼저)
  }

  return { totalCount, correctCount, accuracy, cleared, perProblem, perTag }
}

export function submitAttemptSession(params: {
  store: AttemptSessionStoreV1
  sessionId: string
  problems: ReadonlyArray<Problem>
  now: string
  clearThreshold?: number
}): AttemptSessionStoreV1 {
  const session = params.store.sessionsById[params.sessionId]
  if (!session || session.status !== 'DRAFT') return params.store

  const grading = gradeResponses({
    problems: params.problems,
    responses: session.responses,
    clearThreshold: params.clearThreshold
  })

  const nextSession: AttemptSessionV1 = {
    ...session,
    status: 'SUBMITTED',
    grading,
    updatedAt: params.now
  }

  const nextDraftMap = { ...params.store.draftSessionIdByNodeId }
  if (nextDraftMap[session.nodeId] === session.sessionId) {
    delete nextDraftMap[session.nodeId]
  }

  return {
    ...params.store,
    sessionsById: { ...params.store.sessionsById, [session.sessionId]: nextSession },
    draftSessionIdByNodeId: nextDraftMap
  }
}
