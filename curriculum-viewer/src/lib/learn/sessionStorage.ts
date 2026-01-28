import {
  getBrowserSessionStorage,
  isRecord,
  safeGetItem,
  safeParseJson,
  safeRemoveItem,
  safeSetItem
} from '../repository/storage'

export type DraftSession = {
  nodeId: string
  answers: Record<string, string>
  savedAt: number
}

const DRAFT_KEY_PREFIX = 'curriculum-viewer:learn:draft:v1:'

function getDraftKey(userId: string, nodeId: string): string | null {
  const safeUserId = userId.trim()
  const safeNodeId = nodeId.trim()
  if (!safeUserId || !safeNodeId) return null
  return `${DRAFT_KEY_PREFIX}${encodeURIComponent(safeUserId)}:${encodeURIComponent(safeNodeId)}`
}

function sanitizeAnswers(input: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {}
  for (const [problemId, answer] of Object.entries(input)) {
    if (typeof answer === 'string') {
      sanitized[problemId] = answer
    }
  }
  return sanitized
}

function parseDraft(raw: string, expectedNodeId: string): DraftSession | null {
  const parsed = safeParseJson(raw)
  if (!isRecord(parsed)) return null

  const nodeId = typeof parsed.nodeId === 'string' ? parsed.nodeId : null
  const savedAt = typeof parsed.savedAt === 'number' && Number.isFinite(parsed.savedAt) ? parsed.savedAt : null
  const answersRaw = parsed.answers

  if (!nodeId || nodeId !== expectedNodeId || savedAt === null || !isRecord(answersRaw)) return null

  const answers: Record<string, string> = {}
  for (const [problemId, value] of Object.entries(answersRaw)) {
    if (typeof value === 'string') {
      answers[problemId] = value
    }
  }

  return { nodeId, answers, savedAt }
}

export function saveDraft(userId: string, nodeId: string, answers: Record<string, string>): void {
  const storage = getBrowserSessionStorage()
  const key = getDraftKey(userId, nodeId)
  if (!storage || !key) return

  const payload: DraftSession = {
    nodeId,
    answers: sanitizeAnswers(answers),
    savedAt: Date.now()
  }

  safeSetItem(storage, key, JSON.stringify(payload))
}

export function loadDraft(userId: string, nodeId: string): DraftSession | null {
  const storage = getBrowserSessionStorage()
  const key = getDraftKey(userId, nodeId)
  if (!storage || !key) return null

  const raw = safeGetItem(storage, key)
  if (!raw) return null

  return parseDraft(raw, nodeId)
}

export function clearDraft(userId: string, nodeId: string): void {
  const storage = getBrowserSessionStorage()
  const key = getDraftKey(userId, nodeId)
  if (!storage || !key) return
  safeRemoveItem(storage, key)
}
