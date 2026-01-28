import { getBrowserStorage, isRecord, safeGetItem, safeParseJson, safeSetItem } from '../repository/storage'

export const RESEARCH_SUGGESTIONS_STORE_KEY = 'curriculum-viewer:author:research-suggestions:v1'

export type ResearchSuggestionsStoreV1 = {
  version: 1
  accepted: {
    nodeIds: string[]
    edgeKeys: string[]
  }
  excluded: {
    nodeIds: string[]
    edgeKeys: string[]
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

export function createDefaultResearchSuggestionsStore(): ResearchSuggestionsStoreV1 {
  return {
    version: 1,
    accepted: { nodeIds: [], edgeKeys: [] },
    excluded: { nodeIds: [], edgeKeys: [] }
  }
}

export function normalizeResearchSuggestionsStore(raw: unknown): ResearchSuggestionsStoreV1 | null {
  if (!isRecord(raw)) return null
  if (raw.version !== 1) return null
  const accepted = raw.accepted
  const excluded = raw.excluded
  if (!isRecord(accepted) || !isRecord(excluded)) return null

  const acceptedNodeIds = Array.isArray(accepted.nodeIds) ? accepted.nodeIds : null
  const acceptedEdgeKeys = Array.isArray(accepted.edgeKeys) ? accepted.edgeKeys : null
  const excludedNodeIds = Array.isArray(excluded.nodeIds) ? excluded.nodeIds : null
  const excludedEdgeKeys = Array.isArray(excluded.edgeKeys) ? excluded.edgeKeys : null

  if (!acceptedNodeIds || !acceptedEdgeKeys || !excludedNodeIds || !excludedEdgeKeys) return null

  return {
    version: 1,
    accepted: {
      nodeIds: uniqueStrings(acceptedNodeIds.filter((v): v is string => typeof v === 'string')),
      edgeKeys: uniqueStrings(acceptedEdgeKeys.filter((v): v is string => typeof v === 'string'))
    },
    excluded: {
      nodeIds: uniqueStrings(excludedNodeIds.filter((v): v is string => typeof v === 'string')),
      edgeKeys: uniqueStrings(excludedEdgeKeys.filter((v): v is string => typeof v === 'string'))
    }
  }
}

export function loadResearchSuggestionsStore(): ResearchSuggestionsStoreV1 {
  const storage = getBrowserStorage()
  if (!storage) return createDefaultResearchSuggestionsStore()

  const rawValue = safeGetItem(storage, RESEARCH_SUGGESTIONS_STORE_KEY)
  if (!rawValue) return createDefaultResearchSuggestionsStore()

  const raw = safeParseJson(rawValue)
  const parsed = normalizeResearchSuggestionsStore(raw)
  return parsed ?? createDefaultResearchSuggestionsStore()
}

export function saveResearchSuggestionsStore(store: ResearchSuggestionsStoreV1): void {
  const storage = getBrowserStorage()
  if (!storage) return

  safeSetItem(storage, RESEARCH_SUGGESTIONS_STORE_KEY, JSON.stringify(store))
}

export type ResearchSuggestionStatus = 'pending' | 'accepted' | 'excluded'

export function getResearchSuggestionStatus(params: {
  store: ResearchSuggestionsStoreV1
  type: 'node' | 'edge'
  key: string
}): ResearchSuggestionStatus {
  const accepted = new Set(params.type === 'node' ? params.store.accepted.nodeIds : params.store.accepted.edgeKeys)
  const excluded = new Set(params.type === 'node' ? params.store.excluded.nodeIds : params.store.excluded.edgeKeys)

  if (excluded.has(params.key)) return 'excluded'
  if (accepted.has(params.key)) return 'accepted'
  return 'pending'
}

export function setResearchSuggestionStatus(params: {
  store: ResearchSuggestionsStoreV1
  type: 'node' | 'edge'
  key: string
  status: Exclude<ResearchSuggestionStatus, 'pending'>
}): ResearchSuggestionsStoreV1 {
  const keyTrimmed = params.key.trim()
  if (!keyTrimmed) return params.store

  const acceptedNodes = new Set(params.store.accepted.nodeIds)
  const acceptedEdges = new Set(params.store.accepted.edgeKeys)
  const excludedNodes = new Set(params.store.excluded.nodeIds)
  const excludedEdges = new Set(params.store.excluded.edgeKeys)

  const acceptedSet = params.type === 'node' ? acceptedNodes : acceptedEdges
  const excludedSet = params.type === 'node' ? excludedNodes : excludedEdges

  if (params.status === 'accepted') {
    acceptedSet.add(keyTrimmed)
    excludedSet.delete(keyTrimmed)
  } else {
    excludedSet.add(keyTrimmed)
    acceptedSet.delete(keyTrimmed)
  }

  return {
    version: 1,
    accepted: { nodeIds: Array.from(acceptedNodes), edgeKeys: Array.from(acceptedEdges) },
    excluded: { nodeIds: Array.from(excludedNodes), edgeKeys: Array.from(excludedEdges) }
  }
}

