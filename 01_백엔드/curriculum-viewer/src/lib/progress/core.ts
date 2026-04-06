import type { CurriculumNode } from '../curriculum/types'
import { buildCurriculumIndex } from '../curriculum/indexing'
import { normalizeNumericInput } from '../learn/grading'
import type { Problem } from '../learn/problems'
import type { StoredResultV1 } from './storage'
import type { DomainStat, NodeStatus, ProgressStats, Recommendation, StandardProgress } from './types'

type ProgressInputs = {
  curriculumNodes: ReadonlyArray<CurriculumNode>
  problemsByNodeId: Record<string, Problem[]>
  lastResultsByNodeId: Record<string, StoredResultV1>
  threshold?: number
}

type ProgressSnapshot = {
  statusByNodeId: Map<string, NodeStatus>
  standardProgressById: Map<string, StandardProgress>
  domainKeyByDomainId: Map<string, string>
  domainIdByStandardId: Map<string, string>
  gradeByStandardId: Map<string, number | null>
}

function compareString(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function clampThreshold(threshold: number): number {
  if (!Number.isFinite(threshold)) return 1
  if (threshold <= 0) return 1
  if (threshold > 1) return 1
  return threshold
}

function getDomainKey(domain: CurriculumNode): string {
  const code = typeof domain.domain_code === 'string' ? domain.domain_code.trim() : ''
  if (code.length > 0) return code
  const title = typeof domain.title === 'string' ? domain.title.trim() : ''
  if (title.length > 0) return title
  return domain.id
}

function findAncestorByType(
  nodeId: string,
  nodeById: Map<string, CurriculumNode>,
  type: CurriculumNode['type']
): CurriculumNode | null {
  let cursor = nodeById.get(nodeId) ?? null
  const seen = new Set<string>()

  while (cursor && !seen.has(cursor.id)) {
    if (cursor.type === type) {
      return cursor
    }
    seen.add(cursor.id)

    const parentId = cursor.parent_id
    cursor = typeof parentId === 'string' ? nodeById.get(parentId) ?? null : null
  }

  return null
}

function computeStandardProgress(params: {
  standardId: string
  problems: ReadonlyArray<Problem>
  stored: StoredResultV1 | undefined
  threshold: number
}): StandardProgress {
  const total = params.problems.length
  if (total === 0) {
    return { total, submitted: 0, correct: 0, status: 'no-content' }
  }

  const stored = params.stored
  const submissions = stored?.submissions ?? {}

  let submitted = 0
  let correct = 0

  for (const problem of params.problems) {
    const record = submissions[problem.id]
    if (!record) continue
    const normalized = normalizeNumericInput(record.submitted)
    if (normalized.length === 0) continue

    submitted += 1
    if (record.isCorrect === true) {
      correct += 1
    }
  }

  if (submitted === 0) {
    return { total, submitted, correct, status: 'not-started' }
  }

  const isComplete =
    submitted === total && correct / total >= params.threshold

  return {
    total,
    submitted,
    correct,
    status: isComplete ? 'complete' : 'in-progress'
  }
}

function buildProgressSnapshot(inputs: ProgressInputs): ProgressSnapshot {
  const threshold = clampThreshold(inputs.threshold ?? 1)

  const index = buildCurriculumIndex(inputs.curriculumNodes)
  const nodeById = index.nodeById

  const standardProgressById = new Map<string, StandardProgress>()

  const domainKeyByDomainId = new Map<string, string>()
  const domainIdByStandardId = new Map<string, string>()
  const gradeByStandardId = new Map<string, number | null>()

  const standardIdsByNodeId = new Map<string, string[]>()

  const standards = inputs.curriculumNodes.filter((node) => node.type === 'standard')
  for (const standard of standards) {
    const problems = inputs.problemsByNodeId[standard.id] ?? []
    const stored = inputs.lastResultsByNodeId[standard.id]

    const progress = computeStandardProgress({
      standardId: standard.id,
      problems,
      stored,
      threshold
    })

    standardProgressById.set(standard.id, progress)

    const domain = findAncestorByType(standard.id, nodeById, 'domain')
    if (domain) {
      domainIdByStandardId.set(standard.id, domain.id)
      domainKeyByDomainId.set(domain.id, getDomainKey(domain))
    }

    const gradeNode = findAncestorByType(standard.id, nodeById, 'grade')
    gradeByStandardId.set(standard.id, typeof gradeNode?.grade === 'number' ? gradeNode.grade : null)

    let cursor: CurriculumNode | null = standard
    const seen = new Set<string>()
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id)
      const list = standardIdsByNodeId.get(cursor.id) ?? []
      list.push(standard.id)
      standardIdsByNodeId.set(cursor.id, list)

      const parentId: string | undefined = cursor.parent_id
      cursor = typeof parentId === 'string' ? nodeById.get(parentId) ?? null : null
    }
  }

  const statusByNodeId = new Map<string, NodeStatus>()

  for (const node of inputs.curriculumNodes) {
    if (node.type === 'standard') {
      statusByNodeId.set(node.id, standardProgressById.get(node.id)?.status ?? 'not-started')
      continue
    }

    const standardIds = standardIdsByNodeId.get(node.id) ?? []
    const eligibleIds = standardIds.filter((id) => {
      const progress = standardProgressById.get(id)
      return progress ? progress.total > 0 : false
    })

    if (eligibleIds.length === 0) {
      statusByNodeId.set(node.id, 'not-started')
      continue
    }

    let allComplete = true
    let allNotStarted = true

    for (const id of eligibleIds) {
      const status = standardProgressById.get(id)?.status ?? 'not-started'
      if (status !== 'complete') allComplete = false
      if (status !== 'not-started') allNotStarted = false
    }

    if (allComplete) statusByNodeId.set(node.id, 'complete')
    else if (allNotStarted) statusByNodeId.set(node.id, 'not-started')
    else statusByNodeId.set(node.id, 'in-progress')
  }

  return {
    statusByNodeId,
    standardProgressById,
    domainKeyByDomainId,
    domainIdByStandardId,
    gradeByStandardId
  }
}

export function getNodeStatusMap(inputs: ProgressInputs): Map<string, NodeStatus> {
  return buildProgressSnapshot(inputs).statusByNodeId
}

export function getProgressStats(inputs: ProgressInputs): ProgressStats {
  const snapshot = buildProgressSnapshot(inputs)

  let eligibleStandardCount = 0
  let completedStandards = 0
  let totalSubmittedProblems = 0
  let totalCorrectProblems = 0

  for (const progress of snapshot.standardProgressById.values()) {
    if (progress.total === 0) continue
    eligibleStandardCount += 1
    if (progress.status === 'complete') completedStandards += 1
    totalSubmittedProblems += progress.submitted
    totalCorrectProblems += progress.correct
  }

  const overallCompletionRate =
    eligibleStandardCount > 0 ? completedStandards / eligibleStandardCount : null
  const averageAccuracy =
    totalSubmittedProblems > 0 ? totalCorrectProblems / totalSubmittedProblems : null

  let latestUpdatedAt: string | null = null
  let latestTimestamp = -1
  for (const stored of Object.values(inputs.lastResultsByNodeId)) {
    const updatedAt = stored?.updatedAt
    if (typeof updatedAt !== 'string') continue
    const timestamp = Date.parse(updatedAt)
    if (!Number.isFinite(timestamp)) continue
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp
      latestUpdatedAt = new Date(timestamp).toISOString()
    }
  }

  return {
    completedStandards,
    eligibleStandardCount,
    overallCompletionRate,
    totalSubmittedProblems,
    totalCorrectProblems,
    averageAccuracy,
    latestUpdatedAt
  }
}

export function getDomainStats(inputs: ProgressInputs): DomainStat[] {
  const snapshot = buildProgressSnapshot(inputs)
  const nodeById = buildCurriculumIndex(inputs.curriculumNodes).nodeById

  const aggregates = new Map<
    string,
    {
      domainId: string
      eligibleStandardCount: number
      completedStandards: number
      domainTotal: number
      domainSubmitted: number
      domainCorrect: number
    }
  >()

  for (const domain of inputs.curriculumNodes) {
    if (domain.type !== 'domain') continue
    const domainKey = getDomainKey(domain)
    const existing = aggregates.get(domainKey)

    if (!existing) {
      aggregates.set(domainKey, {
        domainId: domain.id,
        eligibleStandardCount: 0,
        completedStandards: 0,
        domainTotal: 0,
        domainSubmitted: 0,
        domainCorrect: 0
      })
      continue
    }

    if (compareString(domain.id, existing.domainId) < 0) {
      existing.domainId = domain.id
    }
  }

  for (const [standardId, progress] of snapshot.standardProgressById.entries()) {
    if (progress.total === 0) continue
    const domainId = snapshot.domainIdByStandardId.get(standardId)
    if (!domainId) continue
    const domain = nodeById.get(domainId)
    if (!domain) continue

    const domainKey = snapshot.domainKeyByDomainId.get(domainId) ?? getDomainKey(domain)
    const aggregate = aggregates.get(domainKey)
    if (!aggregate) continue

    aggregate.eligibleStandardCount += 1
    if (progress.status === 'complete') {
      aggregate.completedStandards += 1
    }
    aggregate.domainTotal += progress.total
    aggregate.domainSubmitted += progress.submitted
    aggregate.domainCorrect += progress.correct
  }

  const result: DomainStat[] = []
  for (const [domainKey, aggregate] of aggregates.entries()) {
    const completionRate =
      aggregate.eligibleStandardCount > 0
        ? aggregate.completedStandards / aggregate.eligibleStandardCount
        : null
    const domainMastery =
      aggregate.domainTotal > 0 ? aggregate.domainCorrect / aggregate.domainTotal : null

    result.push({
      domainId: aggregate.domainId,
      domainKey,
      eligibleStandardCount: aggregate.eligibleStandardCount,
      completedStandards: aggregate.completedStandards,
      completionRate,
      domainTotal: aggregate.domainTotal,
      domainSubmitted: aggregate.domainSubmitted,
      domainCorrect: aggregate.domainCorrect,
      domainMastery
    })
  }

  result.sort((a, b) => compareString(a.domainKey, b.domainKey))
  return result
}

export function getRecommendation(inputs: ProgressInputs): Recommendation {
  const snapshot = buildProgressSnapshot(inputs)
  const nodeById = buildCurriculumIndex(inputs.curriculumNodes).nodeById

  type Candidate = {
    nodeId: string
    domainId: string
    domainKey: string
    correctRate: number
    grade: number
  }

  const candidates: Candidate[] = []
  for (const [standardId, progress] of snapshot.standardProgressById.entries()) {
    if (progress.total === 0) continue
    if (progress.status === 'complete') continue

    const domainId = snapshot.domainIdByStandardId.get(standardId)
    if (!domainId) continue
    const domainNode = nodeById.get(domainId)
    if (!domainNode) continue

    const domainKey = snapshot.domainKeyByDomainId.get(domainId) ?? getDomainKey(domainNode)
    const grade = snapshot.gradeByStandardId.get(standardId) ?? null

    candidates.push({
      nodeId: standardId,
      domainId,
      domainKey,
      correctRate: progress.correct / progress.total,
      grade: typeof grade === 'number' ? grade : 999
    })
  }

  if (candidates.length === 0) {
    return null
  }

  const domainStats = getDomainStats(inputs)
  const domainStatByKey = new Map(domainStats.map((stat) => [stat.domainKey, stat]))

  const domainKeys = new Set<string>()
  for (const candidate of candidates) {
    domainKeys.add(candidate.domainKey)
  }

  const eligibleDomainKeys = Array.from(domainKeys)
    .filter((key) => {
      const stat = domainStatByKey.get(key)
      return Boolean(stat) && (stat?.eligibleStandardCount ?? 0) > 0
    })
    .sort(compareString)

  if (eligibleDomainKeys.length === 0) {
    return null
  }

  let chosenDomainKey = eligibleDomainKeys[0]
  let chosenRate = domainStatByKey.get(chosenDomainKey)?.completionRate ?? null

  for (const key of eligibleDomainKeys.slice(1)) {
    const rate = domainStatByKey.get(key)?.completionRate ?? null
    if (rate === null) continue
    if (chosenRate === null || rate < chosenRate) {
      chosenDomainKey = key
      chosenRate = rate
    }
  }

  const domainCandidates = candidates.filter((candidate) => candidate.domainKey === chosenDomainKey)
  domainCandidates.sort((a, b) => {
    if (a.correctRate !== b.correctRate) return a.correctRate - b.correctRate
    if (a.grade !== b.grade) return a.grade - b.grade
    return compareString(a.nodeId, b.nodeId)
  })

  const chosen = domainCandidates[0]
  return chosen ? { nodeId: chosen.nodeId, domainKey: chosen.domainKey } : null
}
