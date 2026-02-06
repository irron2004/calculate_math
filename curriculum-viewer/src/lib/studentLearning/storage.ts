import type { AttemptResponse, AttemptSessionStoreV1, AttemptSessionV1, GradingResultV1 } from './types'
import { createEmptyAttemptSessionStoreV1 } from './attemptSession'

export const ATTEMPT_SESSIONS_STORAGE_KEY_PREFIX = 'curriculum-viewer:student:attemptSessions:v1:'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function parseAttemptResponse(raw: unknown): AttemptResponse | null {
  if (!isRecord(raw)) return null
  const problemId = asString(raw.problemId)?.trim()
  const inputRaw = asString(raw.inputRaw)
  const updatedAt = asString(raw.updatedAt)
  if (!problemId || inputRaw === null || !isIsoDateString(updatedAt)) return null

  // 레벨 2 필드 (기본값으로 fallback)
  const timeSpentMs = asNumber(raw.timeSpentMs) ?? 0
  const answerEditCount = asNumber(raw.answerEditCount) ?? 0
  const scratchpadStrokesJson = asString(raw.scratchpadStrokesJson) ?? null

  return {
    problemId,
    inputRaw,
    updatedAt,
    timeSpentMs,
    answerEditCount,
    scratchpadStrokesJson
  }
}

function parseGradingResultV1(raw: unknown): GradingResultV1 | null {
  if (!isRecord(raw)) return null
  const totalCount = asNumber(raw.totalCount)
  const correctCount = asNumber(raw.correctCount)
  const accuracy = asNumber(raw.accuracy)
  const cleared = typeof raw.cleared === 'boolean' ? raw.cleared : null
  const perProblem = raw.perProblem

  if (totalCount === null || correctCount === null || accuracy === null || cleared === null) return null
  if (!isRecord(perProblem)) return null

  const parsedPerProblem: GradingResultV1['perProblem'] = {}
  for (const [problemId, item] of Object.entries(perProblem)) {
    if (!isRecord(item)) continue
    const isCorrect = typeof item.isCorrect === 'boolean' ? item.isCorrect : null
    if (isCorrect === null) continue
    const expectedAnswer = asString(item.expectedAnswer) ?? undefined
    const explanation = asString(item.explanation) ?? undefined
    const timeSpentMs = asNumber(item.timeSpentMs) ?? 0
    const answerEditCount = asNumber(item.answerEditCount) ?? 0
    const scratchpadStrokesJson = item.scratchpadStrokesJson === null
      ? null
      : (asString(item.scratchpadStrokesJson) ?? null)

    parsedPerProblem[problemId] = {
      isCorrect,
      ...(expectedAnswer ? { expectedAnswer } : {}),
      ...(explanation ? { explanation } : {}),
      timeSpentMs,
      answerEditCount,
      scratchpadStrokesJson
    }
  }

  return { totalCount, correctCount, accuracy, cleared, perProblem: parsedPerProblem }
}

function parseAttemptSessionV1(raw: unknown): AttemptSessionV1 | null {
  if (!isRecord(raw)) return null
  const nodeId = asString(raw.nodeId)?.trim()
  const sessionId = asString(raw.sessionId)?.trim()
  const status = raw.status === 'DRAFT' || raw.status === 'SUBMITTED' ? raw.status : null
  const createdAt = asString(raw.createdAt)
  const updatedAt = asString(raw.updatedAt)
  const responses = raw.responses

  if (!nodeId || !sessionId || status === null) return null
  if (!isIsoDateString(createdAt) || !isIsoDateString(updatedAt)) return null
  if (!isRecord(responses)) return null

  const parsedResponses: AttemptSessionV1['responses'] = {}
  for (const [problemId, response] of Object.entries(responses)) {
    const parsed = parseAttemptResponse(response)
    if (!parsed) continue
    if (parsed.problemId !== problemId) continue
    parsedResponses[problemId] = parsed
  }

  let grading: GradingResultV1 | undefined
  if (raw.grading !== undefined) {
    const parsed = parseGradingResultV1(raw.grading)
    if (parsed) grading = parsed
  }

  if (status === 'DRAFT') {
    grading = undefined
  }

  if (status === 'SUBMITTED' && !grading) {
    return null
  }

  return {
    nodeId,
    sessionId,
    status,
    responses: parsedResponses,
    grading,
    createdAt,
    updatedAt
  }
}

export function getAttemptSessionsStorageKey(userId: string): string {
  return `${ATTEMPT_SESSIONS_STORAGE_KEY_PREFIX}${userId}`
}

export function parseAttemptSessionStoreV1(raw: string): AttemptSessionStoreV1 | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isRecord(parsed)) return null
  if (parsed.version !== 1) return null
  if (!isRecord(parsed.sessionsById) || !isRecord(parsed.draftSessionIdByNodeId)) return null

  const sessionsById: AttemptSessionStoreV1['sessionsById'] = {}
  for (const [sessionId, value] of Object.entries(parsed.sessionsById)) {
    const session = parseAttemptSessionV1(value)
    if (!session) continue
    if (session.sessionId !== sessionId) continue
    sessionsById[sessionId] = session
  }

  const draftSessionIdByNodeId: AttemptSessionStoreV1['draftSessionIdByNodeId'] = {}
  for (const [nodeId, sessionId] of Object.entries(parsed.draftSessionIdByNodeId)) {
    if (typeof sessionId !== 'string') continue
    const trimmedNodeId = nodeId.trim()
    const trimmedSessionId = sessionId.trim()
    if (!trimmedNodeId || !trimmedSessionId) continue
    draftSessionIdByNodeId[trimmedNodeId] = trimmedSessionId
  }

  return { version: 1, sessionsById, draftSessionIdByNodeId }
}

export function readAttemptSessionStoreV1(storage: Storage, userId: string): AttemptSessionStoreV1 {
  const key = getAttemptSessionsStorageKey(userId)

  let raw: string | null = null
  try {
    raw = storage.getItem(key)
  } catch {
    return createEmptyAttemptSessionStoreV1()
  }

  if (!raw) {
    return createEmptyAttemptSessionStoreV1()
  }

  const parsed = parseAttemptSessionStoreV1(raw)
  if (parsed) {
    return parsed
  }

  try {
    storage.removeItem(key)
  } catch {
    // ignore
  }

  return createEmptyAttemptSessionStoreV1()
}

export function writeAttemptSessionStoreV1(
  storage: Storage,
  userId: string,
  store: AttemptSessionStoreV1
): void {
  const key = getAttemptSessionsStorageKey(userId)
  const payload = JSON.stringify(store)
  try {
    storage.setItem(key, payload)
  } catch {
    // ignore storage failures (QuotaExceededError/SecurityError/etc)
  }
}
