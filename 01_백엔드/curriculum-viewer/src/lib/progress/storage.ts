import { normalizeNumericInput } from '../learn/grading'

export const LAST_RESULT_PREFIX = 'curriculum-viewer:learn:lastResult:'

export type StoredResultV1 = {
  nodeId: string
  updatedAt?: string
  submissions: Record<string, { submitted: string; isCorrect: boolean }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getLastResultStorageKey(nodeId: string): string {
  return `${LAST_RESULT_PREFIX}${nodeId}`
}

export function parseStoredResultV1(raw: string, expectedNodeId: string): StoredResultV1 | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isRecord(parsed)) return null
  if (typeof parsed.nodeId !== 'string' || parsed.nodeId !== expectedNodeId) return null
  if (!isRecord(parsed.submissions)) return null

  const submissions: StoredResultV1['submissions'] = {}
  for (const [problemId, submission] of Object.entries(parsed.submissions)) {
    if (!isRecord(submission)) continue
    if (typeof submission.submitted !== 'string') continue
    const submitted = submission.submitted
    const normalized = normalizeNumericInput(submitted)
    if (normalized.length === 0) {
      continue
    }

    submissions[problemId] = {
      submitted,
      isCorrect: Boolean(submission.isCorrect)
    }
  }

  const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined

  return { nodeId: expectedNodeId, updatedAt, submissions }
}

export function readLastResultsByNodeId(storage: Storage): Record<string, StoredResultV1> {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || !key.startsWith(LAST_RESULT_PREFIX)) continue
    keys.push(key)
  }

  keys.sort()

  const results: Record<string, StoredResultV1> = {}
  for (const key of keys) {
    const nodeId = key.slice(LAST_RESULT_PREFIX.length)
    if (nodeId.trim().length === 0) continue
    const raw = storage.getItem(key)
    if (!raw) continue

    const parsed = parseStoredResultV1(raw, nodeId)
    if (!parsed) continue
    results[nodeId] = parsed
  }

  return results
}

