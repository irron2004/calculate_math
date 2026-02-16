import { parseSkillGraphV1, type SkillGraphV1 } from '../skillGraph/schema'
import { getBrowserStorage, isIsoDateString, isRecord, safeGetItem, safeParseJson, safeRemoveItem, safeSetItem } from './storage'
import {
  createPublishedSnapshotFromDraft,
  getSkillGraphDraftKey,
  getSkillGraphPublishedKey,
  selectLatestPublishedSnapshot,
  selectStudentGraphSnapshot,
  SKILL_GRAPH_ACTIVE_GRAPH_ID_KEY,
  SKILL_GRAPH_DRAFT_KEY_PREFIX,
  SKILL_GRAPH_PUBLISHED_LATEST_KEY,
  SKILL_GRAPH_PUBLISHED_KEY_PREFIX,
  type SkillGraphDraftStoreV1,
  type SkillGraphPublishedSnapshotV1,
  type SkillGraphPublishedStoreV1
} from './graphModel'

export {
  SKILL_GRAPH_ACTIVE_GRAPH_ID_KEY,
  SKILL_GRAPH_DRAFT_KEY_PREFIX,
  SKILL_GRAPH_PUBLISHED_LATEST_KEY,
  SKILL_GRAPH_PUBLISHED_KEY_PREFIX,
  type SkillGraphDraftStoreV1,
  type SkillGraphPublishedSnapshotV1,
  type SkillGraphPublishedStoreV1
} from './graphModel'

export type GraphExportTarget = 'draft' | 'published_latest'
export const GRAPH_IMPORT_TARGET: 'draft' = 'draft'
export const GRAPH_EXPORT_DEFAULT_TARGET: GraphExportTarget = 'draft'

export type GraphRepository = {
  loadDraft: (params: { userId: string; graphId: string }) => SkillGraphDraftStoreV1 | null
  saveDraft: (params: { userId: string; graph: SkillGraphV1; now: string }) => SkillGraphDraftStoreV1
  clearDraft: (params: { userId: string; graphId: string }) => void
  importGraph: (params: { userId: string; graph: SkillGraphV1; now: string }) => SkillGraphDraftStoreV1

  loadPublishedStore: (params: { graphId: string }) => SkillGraphPublishedStoreV1 | null
  savePublishedStore: (store: SkillGraphPublishedStoreV1) => void

  publishDraft: (params: { userId: string; graphId: string; now: string; note?: string; setActive?: boolean }) => SkillGraphPublishedSnapshotV1 | null
  selectLatestPublished: (store: SkillGraphPublishedStoreV1) => SkillGraphPublishedSnapshotV1 | null

  publishLatestSingle: (params: { graph: SkillGraphV1; now: string; note?: string }) => SkillGraphPublishedSnapshotV1 | null
  loadLatestSingle: () => SkillGraphPublishedSnapshotV1 | null

  getActiveGraphId: () => string | null
  setActiveGraphId: (graphId: string | null) => void

  exportGraph: (params: { userId: string; graphId: string; target?: GraphExportTarget }) => SkillGraphV1 | null
  loadStudentGraph: () => SkillGraphPublishedSnapshotV1 | null
}

export const SKILL_GRAPH_DRAFT_UPDATED_EVENT = 'curriculum-viewer:skill-graph:draft-updated'

function getDraftKey(userId: string, graphId: string): string {
  return getSkillGraphDraftKey(userId, graphId)
}

function getPublishedKey(graphId: string): string {
  return getSkillGraphPublishedKey(graphId)
}

function generatePublishedId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function parsePublishedSnapshot(raw: string): SkillGraphPublishedSnapshotV1 | null {
  const parsed = safeParseJson(raw)
  if (!isRecord(parsed)) return null
  if (parsed.schemaVersion !== 'skill-graph-v1') return null

  const graphId = typeof parsed.graphId === 'string' ? parsed.graphId.trim() : ''
  const publishedAt = parsed.publishedAt
  const publishedId = typeof parsed.publishedId === 'string' ? parsed.publishedId.trim() : ''
  if (!graphId || !publishedId || !isIsoDateString(publishedAt)) return null

  try {
    const graph = parseSkillGraphV1(parsed.graph)
    const note = typeof parsed.note === 'string' ? parsed.note : undefined
    return {
      publishedId,
      schemaVersion: 'skill-graph-v1',
      graphId,
      publishedAt,
      graph,
      ...(note ? { note } : {})
    }
  } catch {
    return null
  }
}

function parseDraftStore(raw: string): SkillGraphDraftStoreV1 | null {
  const parsed = safeParseJson(raw)
  if (!isRecord(parsed)) return null
  if (parsed.version !== 1) return null
  if (parsed.schemaVersion !== 'skill-graph-v1') return null

  const graphId = typeof parsed.graphId === 'string' ? parsed.graphId.trim() : ''
  const createdAt = parsed.createdAt
  const updatedAt = parsed.updatedAt
  if (!graphId || !isIsoDateString(createdAt) || !isIsoDateString(updatedAt)) return null

  try {
    const draft = parseSkillGraphV1(parsed.draft)
    return { version: 1, schemaVersion: 'skill-graph-v1', graphId, draft, createdAt, updatedAt }
  } catch {
    return null
  }
}

function parsePublishedStore(raw: string): SkillGraphPublishedStoreV1 | null {
  const parsed = safeParseJson(raw)
  if (!isRecord(parsed)) return null
  if (parsed.version !== 1) return null

  const graphId = typeof parsed.graphId === 'string' ? parsed.graphId.trim() : ''
  if (!graphId) return null

  const snapshotsByIdRaw = parsed.snapshotsById
  if (!isRecord(snapshotsByIdRaw)) return null

  const snapshotsById: Record<string, SkillGraphPublishedSnapshotV1> = {}
  for (const [publishedId, value] of Object.entries(snapshotsByIdRaw)) {
    if (!isRecord(value)) continue
    if (value.schemaVersion !== 'skill-graph-v1') continue
    const valueGraphId = typeof value.graphId === 'string' ? value.graphId.trim() : ''
    const publishedAt = value.publishedAt
    if (!valueGraphId || valueGraphId !== graphId) continue
    if (!isIsoDateString(publishedAt)) continue

    try {
      const graph = parseSkillGraphV1(value.graph)
      const note = typeof value.note === 'string' ? value.note : undefined
      snapshotsById[publishedId] = {
        publishedId,
        schemaVersion: 'skill-graph-v1',
        graphId,
        publishedAt,
        graph,
        ...(note ? { note } : {})
      }
    } catch {
      continue
    }
  }

  return { version: 1, graphId, snapshotsById }
}

export function createGraphRepository(storage: Storage): GraphRepository {
  const dispatchDraftUpdated = (params: { userId: string; graphId: string; updatedAt: string }) => {
    if (typeof window === 'undefined') return
    if (typeof window.dispatchEvent !== 'function') return
    try {
      window.dispatchEvent(
        new CustomEvent(SKILL_GRAPH_DRAFT_UPDATED_EVENT, {
          detail: { userId: params.userId, graphId: params.graphId, updatedAt: params.updatedAt }
        })
      )
    } catch {
    }
  }

  const loadDraft: GraphRepository['loadDraft'] = ({ userId, graphId }) => {
    const key = getDraftKey(userId, graphId)
    const raw = safeGetItem(storage, key)
    if (!raw) return null

    const parsed = parseDraftStore(raw)
    if (parsed) return parsed

    safeRemoveItem(storage, key)
    return null
  }

  const saveDraft: GraphRepository['saveDraft'] = ({ userId, graph, now }) => {
    const normalizedNow = isIsoDateString(now) ? now : new Date().toISOString()
    const key = getDraftKey(userId, graph.graphId)
    const existing = loadDraft({ userId, graphId: graph.graphId })

    const store: SkillGraphDraftStoreV1 = {
      version: 1,
      schemaVersion: 'skill-graph-v1',
      graphId: graph.graphId,
      draft: graph,
      createdAt: existing?.createdAt ?? normalizedNow,
      updatedAt: normalizedNow
    }

    safeSetItem(storage, key, JSON.stringify(store))
    dispatchDraftUpdated({ userId, graphId: graph.graphId, updatedAt: normalizedNow })
    return store
  }

  const clearDraft: GraphRepository['clearDraft'] = ({ userId, graphId }) => {
    safeRemoveItem(storage, getDraftKey(userId, graphId))
  }

  const importGraph: GraphRepository['importGraph'] = ({ userId, graph, now }) => {
    return saveDraft({ userId, graph, now })
  }

  const loadPublishedStore: GraphRepository['loadPublishedStore'] = ({ graphId }) => {
    const key = getPublishedKey(graphId)
    const raw = safeGetItem(storage, key)
    if (!raw) return null

    const parsed = parsePublishedStore(raw)
    if (parsed) return parsed

    safeRemoveItem(storage, key)
    return null
  }

  const savePublishedStore: GraphRepository['savePublishedStore'] = (store) => {
    safeSetItem(storage, getPublishedKey(store.graphId), JSON.stringify(store))
  }

  const selectLatestPublished: GraphRepository['selectLatestPublished'] = (store) => {
    return selectLatestPublishedSnapshot(store)
  }

  const getActiveGraphId: GraphRepository['getActiveGraphId'] = () => {
    const raw = safeGetItem(storage, SKILL_GRAPH_ACTIVE_GRAPH_ID_KEY)
    const trimmed = raw ? raw.trim() : ''
    return trimmed.length > 0 ? trimmed : null
  }

  const setActiveGraphId: GraphRepository['setActiveGraphId'] = (graphId) => {
    if (!graphId) {
      safeRemoveItem(storage, SKILL_GRAPH_ACTIVE_GRAPH_ID_KEY)
      return
    }
    safeSetItem(storage, SKILL_GRAPH_ACTIVE_GRAPH_ID_KEY, graphId)
  }

  const publishDraft: GraphRepository['publishDraft'] = ({ userId, graphId, now, note, setActive }) => {
    const draft = loadDraft({ userId, graphId })
    if (!draft) return null

    const publishedId = generatePublishedId()
    const snapshot = createPublishedSnapshotFromDraft({
      graph: draft.draft,
      publishedId,
      now,
      ...(note ? { note } : {})
    })
    if (!snapshot || snapshot.graphId !== graphId) return null

    const store = loadPublishedStore({ graphId }) ?? { version: 1, graphId, snapshotsById: {} }
    store.snapshotsById[publishedId] = snapshot
    savePublishedStore(store)

    if (setActive) {
      setActiveGraphId(graphId)
    }

    return snapshot
  }

  const publishLatestSingle: GraphRepository['publishLatestSingle'] = ({ graph, now, note }) => {
    const publishedId = generatePublishedId()
    const snapshot = createPublishedSnapshotFromDraft({
      graph,
      publishedId,
      now,
      ...(note ? { note } : {})
    })
    if (!snapshot) return null

    safeSetItem(storage, SKILL_GRAPH_PUBLISHED_LATEST_KEY, JSON.stringify(snapshot))
    return snapshot
  }

  const loadLatestSingle: GraphRepository['loadLatestSingle'] = () => {
    const raw = safeGetItem(storage, SKILL_GRAPH_PUBLISHED_LATEST_KEY)
    if (!raw) return null

    const parsed = parsePublishedSnapshot(raw)
    if (parsed) return parsed

    safeRemoveItem(storage, SKILL_GRAPH_PUBLISHED_LATEST_KEY)
    return null
  }

  const exportGraph: GraphRepository['exportGraph'] = ({ userId, graphId, target }) => {
    const resolvedTarget = target ?? GRAPH_EXPORT_DEFAULT_TARGET
    if (resolvedTarget === 'draft') {
      return loadDraft({ userId, graphId })?.draft ?? null
    }

    const publishedStore = loadPublishedStore({ graphId })
    const latest = publishedStore ? selectLatestPublished(publishedStore) : null
    return latest?.graph ?? null
  }

  const loadStudentGraph: GraphRepository['loadStudentGraph'] = () => {
    const graphId = getActiveGraphId()
    if (!graphId) return null
    const store = loadPublishedStore({ graphId })
    return selectStudentGraphSnapshot({ activeGraphId: graphId, publishedStore: store })
  }

  return {
    loadDraft,
    saveDraft,
    clearDraft,
    importGraph,
    loadPublishedStore,
    savePublishedStore,
    publishDraft,
    selectLatestPublished,
    publishLatestSingle,
    loadLatestSingle,
    getActiveGraphId,
    setActiveGraphId,
    exportGraph,
    loadStudentGraph
  }
}

export function createBrowserGraphRepository(): GraphRepository | null {
  const storage = getBrowserStorage()
  if (!storage) return null
  return createGraphRepository(storage)
}
