import { parseSkillGraphV1, type SkillGraphV1 } from '../skillGraph/schema'
import { isIsoDateString, safeParseJson } from './storage'

export const SKILL_GRAPH_DRAFT_KEY_PREFIX = 'curriculum-viewer:author:skill-graph:draft:v1:'
export const SKILL_GRAPH_PUBLISHED_KEY_PREFIX = 'curriculum-viewer:skill-graph:published:v1:'
export const SKILL_GRAPH_PUBLISHED_LATEST_KEY = 'curriculum-viewer:skill-graph:published_latest:v1'
export const SKILL_GRAPH_ACTIVE_GRAPH_ID_KEY = 'curriculum-viewer:skill-graph:activeGraphId:v1'

export type SkillGraphDraftStoreV1 = {
  version: 1
  schemaVersion: 'skill-graph-v1'
  graphId: string
  draft: SkillGraphV1
  createdAt: string
  updatedAt: string
}

export type SkillGraphPublishedSnapshotV1 = {
  publishedId: string
  schemaVersion: 'skill-graph-v1'
  graphId: string
  publishedAt: string
  graph: SkillGraphV1
  note?: string
}

export type SkillGraphPublishedSnapshotMetaV1 = {
  versionId: SkillGraphPublishedSnapshotV1['publishedId']
  createdAt: SkillGraphPublishedSnapshotV1['publishedAt']
}

export function getPublishedSnapshotMetaV1(snapshot: SkillGraphPublishedSnapshotV1): SkillGraphPublishedSnapshotMetaV1 {
  return { versionId: snapshot.publishedId, createdAt: snapshot.publishedAt }
}

export type SkillGraphPublishedStoreV1 = {
  version: 1
  graphId: string
  snapshotsById: Record<string, SkillGraphPublishedSnapshotV1>
}

export function getSkillGraphDraftKey(userId: string, graphId: string): string {
  return `${SKILL_GRAPH_DRAFT_KEY_PREFIX}${userId}:${graphId}`
}

export function getSkillGraphPublishedKey(graphId: string): string {
  return `${SKILL_GRAPH_PUBLISHED_KEY_PREFIX}${graphId}`
}

export function selectLatestPublishedSnapshot(store: SkillGraphPublishedStoreV1): SkillGraphPublishedSnapshotV1 | null {
  const snapshots = Object.values(store.snapshotsById)
  if (snapshots.length === 0) return null

  let best = snapshots[0]
  for (const snapshot of snapshots.slice(1)) {
    if (snapshot.publishedAt > best.publishedAt) {
      best = snapshot
      continue
    }
    if (snapshot.publishedAt === best.publishedAt && snapshot.publishedId > best.publishedId) {
      best = snapshot
    }
  }
  return best
}

export function selectStudentGraphSnapshot(params: {
  activeGraphId: string | null
  publishedStore: SkillGraphPublishedStoreV1 | null
}): SkillGraphPublishedSnapshotV1 | null {
  if (!params.activeGraphId) return null
  if (!params.publishedStore) return null
  if (params.publishedStore.graphId !== params.activeGraphId) return null
  return selectLatestPublishedSnapshot(params.publishedStore)
}

export function createPublishedSnapshotFromDraft(params: {
  graph: SkillGraphV1
  publishedId: string
  now: string
  note?: string
}): SkillGraphPublishedSnapshotV1 | null {
  const normalizedNow = isIsoDateString(params.now) ? params.now : new Date().toISOString()
  const copiedGraph = safeParseJson(JSON.stringify(params.graph))

  let snapshotGraph: SkillGraphV1
  try {
    snapshotGraph = parseSkillGraphV1(copiedGraph)
  } catch {
    return null
  }

  return {
    publishedId: params.publishedId,
    schemaVersion: 'skill-graph-v1',
    graphId: snapshotGraph.graphId,
    publishedAt: normalizedNow,
    graph: snapshotGraph,
    ...(params.note ? { note: params.note } : {})
  }
}
