import type { SkillGraphV1 } from '../skillGraph/schema'
import type {
  GraphRepository,
  GraphExportTarget
} from './graphRepository'
import {
  createPublishedSnapshotFromDraft,
  selectLatestPublishedSnapshot,
  selectStudentGraphSnapshot,
  type SkillGraphDraftStoreV1,
  type SkillGraphPublishedSnapshotV1,
  type SkillGraphPublishedStoreV1
} from './graphModel'

type DraftKey = `${string}:${string}` // `${userId}:${graphId}`

export function createInMemoryGraphRepository(): GraphRepository {
  const draftsByKey = new Map<DraftKey, SkillGraphDraftStoreV1>()
  const publishedByGraphId = new Map<string, SkillGraphPublishedStoreV1>()
  let activeGraphId: string | null = null
  let latestSingle: SkillGraphPublishedSnapshotV1 | null = null

  const loadDraft: GraphRepository['loadDraft'] = ({ userId, graphId }) => {
    return draftsByKey.get(`${userId}:${graphId}`) ?? null
  }

  const saveDraft: GraphRepository['saveDraft'] = ({ userId, graph, now }) => {
    const key: DraftKey = `${userId}:${graph.graphId}`
    const existing = draftsByKey.get(key)
    const createdAt = existing?.createdAt ?? now

    const store: SkillGraphDraftStoreV1 = {
      version: 1,
      schemaVersion: 'skill-graph-v1',
      graphId: graph.graphId,
      draft: graph,
      createdAt,
      updatedAt: now
    }

    draftsByKey.set(key, store)
    return store
  }

  const clearDraft: GraphRepository['clearDraft'] = ({ userId, graphId }) => {
    draftsByKey.delete(`${userId}:${graphId}`)
  }

  const importGraph: GraphRepository['importGraph'] = ({ userId, graph, now }) => {
    return saveDraft({ userId, graph, now })
  }

  const loadPublishedStore: GraphRepository['loadPublishedStore'] = ({ graphId }) => {
    return publishedByGraphId.get(graphId) ?? null
  }

  const savePublishedStore: GraphRepository['savePublishedStore'] = (store) => {
    publishedByGraphId.set(store.graphId, store)
  }

  const selectLatestPublished: GraphRepository['selectLatestPublished'] = (store) => {
    return selectLatestPublishedSnapshot(store)
  }

  const publishDraft: GraphRepository['publishDraft'] = ({ userId, graphId, now, note, setActive }) => {
    const draftStore = loadDraft({ userId, graphId })
    if (!draftStore) return null

    const snapshot = createPublishedSnapshotFromDraft({
      graph: draftStore.draft,
      publishedId: `mem_${graphId}_${now}`,
      now,
      ...(note ? { note } : {})
    })
    if (!snapshot) return null

    const store: SkillGraphPublishedStoreV1 = loadPublishedStore({ graphId }) ?? { version: 1, graphId, snapshotsById: {} }
    store.snapshotsById[snapshot.publishedId] = snapshot
    savePublishedStore(store)

    if (setActive) {
      activeGraphId = graphId
    }

    return snapshot
  }

  const publishLatestSingle: GraphRepository['publishLatestSingle'] = ({ graph, now, note }) => {
    const snapshot = createPublishedSnapshotFromDraft({
      graph,
      publishedId: `mem_latest_${graph.graphId}_${now}`,
      now,
      ...(note ? { note } : {})
    })
    if (!snapshot) return null
    latestSingle = snapshot
    return snapshot
  }

  const loadLatestSingle: GraphRepository['loadLatestSingle'] = () => {
    return latestSingle
  }

  const getActiveGraphId: GraphRepository['getActiveGraphId'] = () => activeGraphId
  const setActiveGraphId: GraphRepository['setActiveGraphId'] = (graphId) => {
    activeGraphId = graphId
  }

  const exportGraph: GraphRepository['exportGraph'] = ({ userId, graphId, target }) => {
    const resolvedTarget: GraphExportTarget = target ?? 'draft'
    if (resolvedTarget === 'draft') {
      return loadDraft({ userId, graphId })?.draft ?? null
    }

    const store = loadPublishedStore({ graphId })
    return store ? selectLatestPublishedSnapshot(store)?.graph ?? null : null
  }

  const loadStudentGraph: GraphRepository['loadStudentGraph'] = () => {
    const store = activeGraphId ? loadPublishedStore({ graphId: activeGraphId }) : null
    return selectStudentGraphSnapshot({ activeGraphId, publishedStore: store })
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

