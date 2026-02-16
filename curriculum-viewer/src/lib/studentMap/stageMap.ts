import type { CurriculumNode } from '../curriculum/types'
import type { LearningGraphV1, NodeProgressV1 } from '../studentLearning/types'

export type StageStatus = 'CLEARED' | 'AVAILABLE' | 'IN_PROGRESS' | 'LOCKED'

export type StageNodeViewModel = {
  nodeId: string
  title: string
  status: StageStatus
  isRecommended: boolean
  isSideQuest: boolean
  order: number
  xPercent: number
  y: number
  missingPrereqNodeIds: string[]
}

export type DomainViewModel = {
  id: string
  label: string
  progressPct: number
  totalCount: number
  clearedCount: number
}

export type NextAction = {
  nodeId: string
  title: string
  status: Extract<StageStatus, 'AVAILABLE' | 'IN_PROGRESS'>
  ctaLabel: '시작하기' | '계속하기'
  subtitle: string
}

export type StageMapModel = {
  domains: DomainViewModel[]
  selectedDomainId: string
  stages: StageNodeViewModel[]
  sideQuests: StageNodeViewModel[]
  nextActions: NextAction[]
  hiddenFutureCount: number
}

type StageTransformInput = {
  curriculumNodes: ReadonlyArray<CurriculumNode>
  learningGraph: LearningGraphV1
  progressByNodeId: Record<string, NodeProgressV1>
  selectedDomainId?: string | null
}

type DomainSummary = {
  id: string
  label: string
  nodeIds: string[]
}

const X_PATTERN = [20, 80, 50]
const STAGE_Y_GAP = 136

function compareString(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function normalizedOrder(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER
}

function getNodeTitle(nodeById: Map<string, CurriculumNode>, nodeId: string): string {
  return nodeById.get(nodeId)?.title ?? nodeId
}

function findDomainId(node: CurriculumNode | undefined): string {
  if (!node) return 'default'
  if (typeof node.domain_code === 'string' && node.domain_code.trim().length > 0) {
    return node.domain_code.trim()
  }
  if (typeof node.domain === 'string' && node.domain.trim().length > 0) {
    return node.domain.trim()
  }
  return 'default'
}

function findDomainLabel(node: CurriculumNode | undefined): string {
  if (!node) return '전체'
  if (typeof node.domain === 'string' && node.domain.trim().length > 0) {
    return node.domain.trim()
  }
  if (typeof node.domain_code === 'string' && node.domain_code.trim().length > 0) {
    return node.domain_code.trim()
  }
  return '전체'
}

function buildDomainSummaries(params: {
  curriculumNodeById: Map<string, CurriculumNode>
  learningGraph: LearningGraphV1
}): DomainSummary[] {
  const map = new Map<string, DomainSummary>()

  for (const node of params.learningGraph.nodes) {
    const curriculumNode = params.curriculumNodeById.get(node.id)
    const domainId = findDomainId(curriculumNode)
    const domainLabel = findDomainLabel(curriculumNode)
    const current = map.get(domainId)
    if (current) {
      current.nodeIds.push(node.id)
      continue
    }
    map.set(domainId, {
      id: domainId,
      label: domainLabel,
      nodeIds: [node.id]
    })
  }

  return Array.from(map.values()).sort((a, b) => compareString(a.label, b.label))
}

function sortNodeIdsByOrder(nodeIds: string[], graphNodeById: Map<string, { order?: number }>): string[] {
  return [...nodeIds].sort((a, b) => {
    const aOrder = normalizedOrder(graphNodeById.get(a)?.order)
    const bOrder = normalizedOrder(graphNodeById.get(b)?.order)
    if (aOrder !== bOrder) return aOrder - bOrder
    return compareString(a, b)
  })
}

function getStageSubtitle(status: StageStatus): string {
  if (status === 'IN_PROGRESS') return '이어서 하면 금방 끝나요'
  return '3분이면 시작할 수 있어요'
}

export function buildStudentStageMapModel(input: StageTransformInput): StageMapModel {
  const curriculumNodeById = new Map(input.curriculumNodes.map((node) => [node.id, node]))
  const graphNodeById = new Map(input.learningGraph.nodes.map((node) => [node.id, node]))

  const domainSummaries = buildDomainSummaries({
    curriculumNodeById,
    learningGraph: input.learningGraph
  })

  const selectedDomainId =
    domainSummaries.find((domain) => domain.id === input.selectedDomainId)?.id ??
    domainSummaries[0]?.id ??
    'default'

  const selectedDomain =
    domainSummaries.find((domain) => domain.id === selectedDomainId) ??
    ({ id: selectedDomainId, label: '전체', nodeIds: [] } as DomainSummary)

  const preparesForTargets = new Set(
    input.learningGraph.edges.filter((edge) => edge.type === 'prepares_for').map((edge) => edge.targetId)
  )

  const domainNodeIds = selectedDomain.nodeIds
  const mainPathNodeIds = sortNodeIdsByOrder(
    domainNodeIds.filter((nodeId) => !preparesForTargets.has(nodeId)),
    graphNodeById
  )
  const fallbackMainNodeIds = sortNodeIdsByOrder(domainNodeIds, graphNodeById)
  const finalMainPathNodeIds = mainPathNodeIds.length > 0 ? mainPathNodeIds : fallbackMainNodeIds

  const firstFutureIndex = finalMainPathNodeIds.findIndex((nodeId) => {
    const status = input.progressByNodeId[nodeId]?.status
    return status !== 'CLEARED'
  })
  const pivotIndex = firstFutureIndex >= 0 ? firstFutureIndex : Math.max(0, finalMainPathNodeIds.length - 1)
  const maxVisibleMain = Math.min(finalMainPathNodeIds.length, pivotIndex + 3)
  const visibleMainNodeIds = finalMainPathNodeIds.slice(0, maxVisibleMain)
  const hiddenFutureCount = Math.max(0, finalMainPathNodeIds.length - visibleMainNodeIds.length)

  const sideQuestCandidates = sortNodeIdsByOrder(
    domainNodeIds.filter((nodeId) => preparesForTargets.has(nodeId)),
    graphNodeById
  )

  const visibleSideQuestIds = sideQuestCandidates.filter((nodeId) => {
    const status = input.progressByNodeId[nodeId]?.status ?? 'LOCKED'
    return status === 'AVAILABLE' || status === 'IN_PROGRESS'
  }).slice(0, 2)

  const recommendedPool = new Set<string>()
  const inProgressMain = visibleMainNodeIds.find((nodeId) => input.progressByNodeId[nodeId]?.status === 'IN_PROGRESS')
  if (inProgressMain) recommendedPool.add(inProgressMain)
  const firstAvailableMain = visibleMainNodeIds.find((nodeId) => input.progressByNodeId[nodeId]?.status === 'AVAILABLE')
  if (firstAvailableMain && recommendedPool.size < 2) recommendedPool.add(firstAvailableMain)
  const firstAvailableSide = visibleSideQuestIds.find((nodeId) => input.progressByNodeId[nodeId]?.status === 'AVAILABLE')
  if (firstAvailableSide && recommendedPool.size < 2) recommendedPool.add(firstAvailableSide)

  const nextActions: NextAction[] = []
  for (const nodeId of recommendedPool) {
    const status = input.progressByNodeId[nodeId]?.status
    if (status !== 'AVAILABLE' && status !== 'IN_PROGRESS') continue
    nextActions.push({
      nodeId,
      title: getNodeTitle(curriculumNodeById, nodeId),
      status,
      ctaLabel: status === 'IN_PROGRESS' ? '계속하기' : '시작하기',
      subtitle: getStageSubtitle(status)
    })
  }

  const stages: StageNodeViewModel[] = visibleMainNodeIds.map((nodeId, index) => {
    const progress = input.progressByNodeId[nodeId]
    const status: StageStatus = progress?.status ?? 'LOCKED'
    return {
      nodeId,
      title: getNodeTitle(curriculumNodeById, nodeId),
      status,
      isRecommended: recommendedPool.has(nodeId),
      isSideQuest: false,
      order: normalizedOrder(graphNodeById.get(nodeId)?.order),
      xPercent: X_PATTERN[index % X_PATTERN.length],
      y: index * STAGE_Y_GAP,
      missingPrereqNodeIds: progress?.lockedReasons?.missingPrereqNodeIds ?? []
    }
  })

  const sideQuests: StageNodeViewModel[] = visibleSideQuestIds.map((nodeId, index) => {
    const progress = input.progressByNodeId[nodeId]
    const status: StageStatus = progress?.status ?? 'LOCKED'
    const anchorIndex = Math.min(stages.length - 1, Math.max(0, index + pivotIndex - 1))
    const anchor = stages[anchorIndex]
    const xOffset = index % 2 === 0 ? -13 : 13
    return {
      nodeId,
      title: getNodeTitle(curriculumNodeById, nodeId),
      status,
      isRecommended: recommendedPool.has(nodeId),
      isSideQuest: true,
      order: normalizedOrder(graphNodeById.get(nodeId)?.order),
      xPercent: Math.max(8, Math.min(92, (anchor?.xPercent ?? 50) + xOffset)),
      y: (anchor?.y ?? 0) + 64,
      missingPrereqNodeIds: progress?.lockedReasons?.missingPrereqNodeIds ?? []
    }
  })

  const domains: DomainViewModel[] = domainSummaries.map((domain) => {
    const totalCount = domain.nodeIds.length
    const clearedCount = domain.nodeIds.filter(
      (nodeId) => input.progressByNodeId[nodeId]?.status === 'CLEARED'
    ).length
    const progressPct = totalCount > 0 ? Math.round((clearedCount / totalCount) * 100) : 0
    return {
      id: domain.id,
      label: domain.label,
      progressPct,
      totalCount,
      clearedCount
    }
  })

  return {
    domains,
    selectedDomainId,
    stages,
    sideQuests,
    nextActions: nextActions.slice(0, 2),
    hiddenFutureCount
  }
}
