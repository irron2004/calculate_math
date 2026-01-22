import { getBrowserStorage, isRecord, safeGetItem, safeParseJson, safeRemoveItem, safeSetItem } from './storage'

export const PROBLEM_BANK_DRAFT_KEY_PREFIX = 'curriculum-viewer:author:problems:draft:v1:'
export const PROBLEM_BANK_PUBLISHED_KEY_PREFIX = 'curriculum-viewer:problems:published:v1:'

export type ProblemBankV1 = {
  version: 1
  problemsByNodeId: Record<string, unknown[]>
}

export type ProblemRepository = {
  loadDraft: (params: { userId: string; graphId: string }) => ProblemBankV1 | null
  saveDraft: (params: { userId: string; graphId: string; bank: ProblemBankV1 }) => void
  loadPublished: (params: { graphId: string }) => ProblemBankV1 | null
  savePublished: (params: { graphId: string; bank: ProblemBankV1 }) => void
}

function getDraftKey(userId: string, graphId: string): string {
  return `${PROBLEM_BANK_DRAFT_KEY_PREFIX}${userId}:${graphId}`
}

function getPublishedKey(graphId: string): string {
  return `${PROBLEM_BANK_PUBLISHED_KEY_PREFIX}${graphId}`
}

function parseProblemBank(raw: string): ProblemBankV1 | null {
  const parsed = safeParseJson(raw)
  if (!isRecord(parsed)) return null
  if (parsed.version !== 1) return null
  if (!isRecord(parsed.problemsByNodeId)) return null
  return { version: 1, problemsByNodeId: parsed.problemsByNodeId as Record<string, unknown[]> }
}

export function createProblemRepository(storage: Storage): ProblemRepository {
  return {
    loadDraft: ({ userId, graphId }) => {
      const key = getDraftKey(userId, graphId)
      const raw = safeGetItem(storage, key)
      if (!raw) return null
      const parsed = parseProblemBank(raw)
      if (parsed) return parsed
      safeRemoveItem(storage, key)
      return null
    },
    saveDraft: ({ userId, graphId, bank }) => {
      safeSetItem(storage, getDraftKey(userId, graphId), JSON.stringify(bank))
    },
    loadPublished: ({ graphId }) => {
      const key = getPublishedKey(graphId)
      const raw = safeGetItem(storage, key)
      if (!raw) return null
      const parsed = parseProblemBank(raw)
      if (parsed) return parsed
      safeRemoveItem(storage, key)
      return null
    },
    savePublished: ({ graphId, bank }) => {
      safeSetItem(storage, getPublishedKey(graphId), JSON.stringify(bank))
    }
  }
}

export function createBrowserProblemRepository(): ProblemRepository | null {
  const storage = getBrowserStorage()
  if (!storage) return null
  return createProblemRepository(storage)
}

