import type { AttemptSessionStoreV1, LearningGraphV1, NodeProgressV1, NodeStatus } from './types'

function compareString(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function orderValue(order: unknown): number {
  return typeof order === 'number' && Number.isFinite(order) ? order : 999999
}

function isoMax(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

function isoMin(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a <= b ? a : b
}

type SubmissionSummary = {
  bestAccuracy: number | null
  bestCleared: boolean
  lastSubmittedUpdatedAt: string | null
  firstClearedAt: string | null
}

function compareSubmittedCandidate(
  a: { accuracy: number; updatedAt: string; sessionId: string },
  b: { accuracy: number; updatedAt: string; sessionId: string }
): number {
  if (a.accuracy !== b.accuracy) return a.accuracy > b.accuracy ? -1 : 1
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1
  return compareString(a.sessionId, b.sessionId)
}

function summarizeSubmissionsByNodeId(store: AttemptSessionStoreV1): Map<string, SubmissionSummary> {
  const map = new Map<
    string,
    {
      best: { accuracy: number; updatedAt: string; sessionId: string; cleared: boolean } | null
      lastSubmittedUpdatedAt: string | null
      firstClearedAt: string | null
    }
  >()

  for (const session of Object.values(store.sessionsById)) {
    if (session.status !== 'SUBMITTED') continue
    const nodeId = session.nodeId
    const accuracy = session.grading?.accuracy
    if (typeof accuracy !== 'number' || !Number.isFinite(accuracy)) continue

    const cleared = Boolean(session.grading?.cleared)
    const updatedAt = session.updatedAt
    const sessionId = session.sessionId

    const existing = map.get(nodeId) ?? { best: null, lastSubmittedUpdatedAt: null, firstClearedAt: null }

    existing.lastSubmittedUpdatedAt = isoMax(existing.lastSubmittedUpdatedAt, updatedAt)
    if (cleared) {
      existing.firstClearedAt = isoMin(existing.firstClearedAt, updatedAt)
    }

    const candidate = { accuracy, updatedAt, sessionId, cleared }
    if (!existing.best) {
      existing.best = candidate
    } else {
      const cmp = compareSubmittedCandidate(
        { accuracy: existing.best.accuracy, updatedAt: existing.best.updatedAt, sessionId: existing.best.sessionId },
        { accuracy: candidate.accuracy, updatedAt: candidate.updatedAt, sessionId: candidate.sessionId }
      )
      if (cmp > 0) {
        existing.best = candidate
      }
    }

    map.set(nodeId, existing)
  }

  const result = new Map<string, SubmissionSummary>()
  for (const [nodeId, value] of map.entries()) {
    result.set(nodeId, {
      bestAccuracy: value.best ? value.best.accuracy : null,
      bestCleared: Boolean(value.best?.cleared),
      lastSubmittedUpdatedAt: value.lastSubmittedUpdatedAt,
      firstClearedAt: value.firstClearedAt
    })
  }

  return result
}

function getDraftSession(params: { store: AttemptSessionStoreV1; nodeId: string }) {
  const draftId = params.store.draftSessionIdByNodeId[params.nodeId]
  if (!draftId) return null
  const session = params.store.sessionsById[draftId]
  if (!session) return null
  if (session.status !== 'DRAFT') return null
  if (session.nodeId !== params.nodeId) return null
  return session
}

function getPrereqNodeIds(graph: LearningGraphV1, nodeId: string): string[] {
  const set = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.type !== 'requires') continue
    if (edge.targetId !== nodeId) continue
    set.add(edge.sourceId)
  }
  return Array.from(set).sort(compareString)
}

export function computeNodeProgressV1(params: {
  graph: LearningGraphV1
  store: AttemptSessionStoreV1
}): Record<string, NodeProgressV1> {
  const nodeById = new Map(params.graph.nodes.map((node) => [node.id, node]))

  const submissionSummaryByNodeId = summarizeSubmissionsByNodeId(params.store)
  const draftUpdatedAtByNodeId = new Map<string, string>()

  for (const node of params.graph.nodes) {
    const draft = getDraftSession({ store: params.store, nodeId: node.id })
    if (draft) {
      draftUpdatedAtByNodeId.set(node.id, draft.updatedAt)
    }
  }

  const clearedSet = new Set<string>()
  for (const [nodeId, summary] of submissionSummaryByNodeId.entries()) {
    if (summary.bestCleared) clearedSet.add(nodeId)
  }

  const progressByNodeId: Record<string, NodeProgressV1> = {}

  for (const node of params.graph.nodes) {
    const summary = submissionSummaryByNodeId.get(node.id) ?? null
    const bestAccuracy = summary?.bestAccuracy ?? null
    const draftUpdatedAt = draftUpdatedAtByNodeId.get(node.id) ?? null

    const cleared = Boolean(summary?.bestCleared)
    const hasDraft = Boolean(draftUpdatedAt)
    const hasSubmitted = bestAccuracy !== null

    let status: NodeStatus
    let lockedReasons: NodeProgressV1['lockedReasons']

    if (cleared) {
      status = 'CLEARED'
    } else if (hasDraft || hasSubmitted) {
      status = 'IN_PROGRESS'
    } else {
      const isStart = Boolean(nodeById.get(node.id)?.isStart)
      const prereq = getPrereqNodeIds(params.graph, node.id)
      if (isStart) {
        status = 'AVAILABLE'
      } else {
        const missing = prereq.filter((id) => !clearedSet.has(id))
        if (missing.length === 0) status = 'AVAILABLE'
        else {
          status = 'LOCKED'
          lockedReasons = { missingPrereqNodeIds: missing }
        }
      }
    }

    progressByNodeId[node.id] = {
      nodeId: node.id,
      status,
      bestAccuracy,
      lastAttemptAt: isoMax(draftUpdatedAt, summary?.lastSubmittedUpdatedAt ?? null),
      clearedAt: cleared ? summary?.firstClearedAt ?? null : null,
      lockedReasons
    }
  }

  return progressByNodeId
}

function getLatestSubmittedNodeId(store: AttemptSessionStoreV1): string | null {
  let best: { nodeId: string; updatedAt: string; sessionId: string; cleared: boolean } | null = null

  for (const session of Object.values(store.sessionsById)) {
    if (session.status !== 'SUBMITTED') continue
    const updatedAt = session.updatedAt
    if (typeof updatedAt !== 'string') continue

    const candidate = {
      nodeId: session.nodeId,
      updatedAt,
      sessionId: session.sessionId,
      cleared: Boolean(session.grading?.cleared)
    }

    if (!best) {
      best = candidate
      continue
    }

    if (candidate.updatedAt > best.updatedAt) {
      best = candidate
      continue
    }

    if (candidate.updatedAt === best.updatedAt && compareString(candidate.sessionId, best.sessionId) < 0) {
      best = candidate
    }
  }

  return best && best.cleared ? best.nodeId : null
}

export function recommendNextNodeIds(params: {
  graph: LearningGraphV1
  store: AttemptSessionStoreV1
  maxCount?: number
}): string[] {
  const maxCount = typeof params.maxCount === 'number' && params.maxCount > 0 ? Math.min(3, Math.floor(params.maxCount)) : 3
  const progressByNodeId = computeNodeProgressV1({ graph: params.graph, store: params.store })
  const nodeById = new Map(params.graph.nodes.map((node) => [node.id, node]))

  const inProgress: NodeProgressV1[] = []
  const available: NodeProgressV1[] = []

  for (const progress of Object.values(progressByNodeId)) {
    if (progress.status === 'IN_PROGRESS') inProgress.push(progress)
    else if (progress.status === 'AVAILABLE') available.push(progress)
  }

  inProgress.sort((a, b) => {
    const aLast = a.lastAttemptAt ?? ''
    const bLast = b.lastAttemptAt ?? ''
    if (aLast !== bLast) return aLast < bLast ? 1 : -1
    const aOrder = orderValue(nodeById.get(a.nodeId)?.order)
    const bOrder = orderValue(nodeById.get(b.nodeId)?.order)
    if (aOrder !== bOrder) return aOrder - bOrder
    return compareString(a.nodeId, b.nodeId)
  })

  available.sort((a, b) => {
    const aOrder = orderValue(nodeById.get(a.nodeId)?.order)
    const bOrder = orderValue(nodeById.get(b.nodeId)?.order)
    if (aOrder !== bOrder) return aOrder - bOrder
    return compareString(a.nodeId, b.nodeId)
  })

  const selected: string[] = []
  const seen = new Set<string>()

  const latestClearedNodeId = getLatestSubmittedNodeId(params.store)
  if (latestClearedNodeId) {
    const targets: string[] = []
    for (const edge of params.graph.edges) {
      if (edge.type !== 'prepares_for') continue
      if (edge.sourceId !== latestClearedNodeId) continue
      if (progressByNodeId[edge.targetId]?.status === 'AVAILABLE') {
        targets.push(edge.targetId)
      }
    }

    targets.sort((aId, bId) => {
      const aOrder = orderValue(nodeById.get(aId)?.order)
      const bOrder = orderValue(nodeById.get(bId)?.order)
      if (aOrder !== bOrder) return aOrder - bOrder
      return compareString(aId, bId)
    })

    const first = targets[0]
    if (first) {
      selected.push(first)
      seen.add(first)
    }
  }

  const pool = inProgress.length > 0 ? inProgress : available
  for (const item of pool) {
    if (selected.length >= maxCount) break
    if (seen.has(item.nodeId)) continue
    selected.push(item.nodeId)
    seen.add(item.nodeId)
  }

  if (selected.length >= maxCount) return selected

  const remainingPool = inProgress.length > 0 ? available : []
  for (const item of remainingPool) {
    if (selected.length >= maxCount) break
    if (seen.has(item.nodeId)) continue
    selected.push(item.nodeId)
    seen.add(item.nodeId)
  }

  return selected
}
