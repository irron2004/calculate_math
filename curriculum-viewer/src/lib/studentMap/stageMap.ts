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
  categoryId: LargeCategoryId
}

export type LargeCategoryId = 'algebra' | 'probability' | 'calculus' | 'geometry'

export type LargeCategoryViewModel = {
  id: LargeCategoryId
  label: string
  progressPct: number
  totalCount: number
  clearedCount: number
  unlocked: boolean
}

export type NextAction = {
  nodeId: string
  title: string
  status: Extract<StageStatus, 'AVAILABLE' | 'IN_PROGRESS'>
  ctaLabel: '시작하기' | '계속하기'
  subtitle: string
}

export type StageMapModel = {
  categories: LargeCategoryViewModel[]
  selectedCategoryId: LargeCategoryId
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
  selectedCategoryId?: LargeCategoryId | null
  selectedDomainId?: string | null
}

type DomainSummary = {
  id: string
  label: string
  categoryId: LargeCategoryId
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

function resolveCategoryId(node: CurriculumNode | undefined): LargeCategoryId {
  const id = (node?.id ?? '').toUpperCase()
  const title = (node?.title ?? '').toLowerCase()
  const domainCode = (node?.domain_code ?? '').toUpperCase()

  if (
    domainCode === 'GM' ||
    /기하|벡터|도형/.test(title) ||
    /(VECTOR|GEOM|CONIC|COORD)/.test(id)
  ) {
    return 'geometry'
  }

  if (
    domainCode === 'DP' ||
    /확률|통계/.test(title) ||
    /(PROB|STAT|COMBINATORICS|BINOMIAL|COND_PROB)/.test(id)
  ) {
    return 'probability'
  }

  if (
    /미분|적분|극한/.test(title) ||
    /(DERIV|INTEGRAL|LIMIT|SEQ_LIMIT_SERIES)/.test(id)
  ) {
    return 'calculus'
  }

  return 'algebra'
}

function categoryLabel(categoryId: LargeCategoryId): string {
  if (categoryId === 'algebra') return '대수'
  if (categoryId === 'probability') return '확률'
  if (categoryId === 'calculus') return '미분'
  return '기하'
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
      categoryId: resolveCategoryId(curriculumNode),
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
    domainSummaries.find(
      (domain) =>
        domain.id === input.selectedDomainId &&
        domain.categoryId ===
          (input.selectedCategoryId ?? domainSummaries[0]?.categoryId ?? 'algebra')
    )?.id ??
    domainSummaries.find(
      (domain) =>
        domain.categoryId === (input.selectedCategoryId ?? domainSummaries[0]?.categoryId ?? 'algebra')
    )?.id ??
    'default'

  const selectedDomain =
    domainSummaries.find((domain) => domain.id === selectedDomainId) ??
    ({ id: selectedDomainId, label: '전체', categoryId: 'algebra', nodeIds: [] } as DomainSummary)

  const preparesForTargets = new Set(
    input.learningGraph.edges.filter((edge) => edge.type === 'prepares_for').map((edge) => edge.targetId)
  )

  const domains: DomainViewModel[] = domainSummaries.map((domain) => {
    const totalCount = domain.nodeIds.length
    const clearedCount = domain.nodeIds.filter(
      (nodeId) => input.progressByNodeId[nodeId]?.status === 'CLEARED'
    ).length
    const progressPct = totalCount > 0 ? Math.round((clearedCount / totalCount) * 100) : 0
    return {
      id: domain.id,
      label: domain.label,
      categoryId: domain.categoryId,
      progressPct,
      totalCount,
      clearedCount
    }
  })

  const categories: LargeCategoryViewModel[] = (['algebra', 'probability', 'calculus', 'geometry'] as const).map(
    (categoryId) => {
      const categoryDomains = domains.filter((domain) => domain.categoryId === categoryId)
      const categoryDomainSummaries = domainSummaries.filter((domain) => domain.categoryId === categoryId)
      const totalCount = categoryDomains.reduce((sum, domain) => sum + domain.totalCount, 0)
      const clearedCount = categoryDomains.reduce((sum, domain) => sum + domain.clearedCount, 0)
      const progressPct = totalCount > 0 ? Math.round((clearedCount / totalCount) * 100) : 0
      const unlocked = categoryDomainSummaries.some((domain) =>
        domain.nodeIds.some((nodeId) => (input.progressByNodeId[nodeId]?.status ?? 'LOCKED') !== 'LOCKED')
      )
      return {
        id: categoryId,
        label: categoryLabel(categoryId),
        progressPct,
        totalCount,
        clearedCount,
        unlocked
      }
    }
  )

  const selectedCategoryId =
    categories.find((category) => category.id === input.selectedCategoryId)?.id ??
    categories.find((category) => category.unlocked)?.id ??
    'algebra'

  const filteredDomains = domains.filter((domain) => domain.categoryId === selectedCategoryId)
  const selectedDomainResolvedId =
    filteredDomains.find((domain) => domain.id === selectedDomainId)?.id ?? filteredDomains[0]?.id ?? selectedDomainId

  const selectedDomainResolved =
    domainSummaries.find((domain) => domain.id === selectedDomainResolvedId) ?? selectedDomain

  const selectedDomainNodeIds = selectedDomainResolved.nodeIds

  const selectedMainPathNodeIds = sortNodeIdsByOrder(
    selectedDomainNodeIds.filter((nodeId) => !preparesForTargets.has(nodeId)),
    graphNodeById
  )
  const selectedFallbackNodeIds = sortNodeIdsByOrder(selectedDomainNodeIds, graphNodeById)
  const selectedFinalMainPathNodeIds =
    selectedMainPathNodeIds.length > 0 ? selectedMainPathNodeIds : selectedFallbackNodeIds

  const selectedFirstFutureIndex = selectedFinalMainPathNodeIds.findIndex((nodeId) => {
    const status = input.progressByNodeId[nodeId]?.status
    return status !== 'CLEARED'
  })
  const selectedPivotIndex =
    selectedFirstFutureIndex >= 0 ? selectedFirstFutureIndex : Math.max(0, selectedFinalMainPathNodeIds.length - 1)
  const selectedMaxVisibleMain = Math.min(selectedFinalMainPathNodeIds.length, selectedPivotIndex + 3)
  const selectedVisibleMainNodeIds = selectedFinalMainPathNodeIds.slice(0, selectedMaxVisibleMain)
  const selectedHiddenFutureCount = Math.max(
    0,
    selectedFinalMainPathNodeIds.length - selectedVisibleMainNodeIds.length
  )

  const selectedSideQuestCandidates = sortNodeIdsByOrder(
    selectedDomainNodeIds.filter((nodeId) => preparesForTargets.has(nodeId)),
    graphNodeById
  )

  const selectedVisibleSideQuestIds = selectedSideQuestCandidates
    .filter((nodeId) => {
      const status = input.progressByNodeId[nodeId]?.status ?? 'LOCKED'
      return status === 'AVAILABLE' || status === 'IN_PROGRESS'
    })
    .slice(0, 2)

  const selectedRecommendedPool = new Set<string>()
  const selectedInProgressMain = selectedVisibleMainNodeIds.find(
    (nodeId) => input.progressByNodeId[nodeId]?.status === 'IN_PROGRESS'
  )
  if (selectedInProgressMain) selectedRecommendedPool.add(selectedInProgressMain)
  const selectedFirstAvailableMain = selectedVisibleMainNodeIds.find(
    (nodeId) => input.progressByNodeId[nodeId]?.status === 'AVAILABLE'
  )
  if (selectedFirstAvailableMain && selectedRecommendedPool.size < 2) {
    selectedRecommendedPool.add(selectedFirstAvailableMain)
  }
  const selectedFirstAvailableSide = selectedVisibleSideQuestIds.find(
    (nodeId) => input.progressByNodeId[nodeId]?.status === 'AVAILABLE'
  )
  if (selectedFirstAvailableSide && selectedRecommendedPool.size < 2) {
    selectedRecommendedPool.add(selectedFirstAvailableSide)
  }

  const selectedNextActions: NextAction[] = []
  for (const nodeId of selectedRecommendedPool) {
    const status = input.progressByNodeId[nodeId]?.status
    if (status !== 'AVAILABLE' && status !== 'IN_PROGRESS') continue
    selectedNextActions.push({
      nodeId,
      title: getNodeTitle(curriculumNodeById, nodeId),
      status,
      ctaLabel: status === 'IN_PROGRESS' ? '계속하기' : '시작하기',
      subtitle: getStageSubtitle(status)
    })
  }

  const selectedStages: StageNodeViewModel[] = selectedVisibleMainNodeIds.map((nodeId, index) => {
    const progress = input.progressByNodeId[nodeId]
    const status: StageStatus = progress?.status ?? 'LOCKED'
    return {
      nodeId,
      title: getNodeTitle(curriculumNodeById, nodeId),
      status,
      isRecommended: selectedRecommendedPool.has(nodeId),
      isSideQuest: false,
      order: normalizedOrder(graphNodeById.get(nodeId)?.order),
      xPercent: X_PATTERN[index % X_PATTERN.length],
      y: index * STAGE_Y_GAP,
      missingPrereqNodeIds: progress?.lockedReasons?.missingPrereqNodeIds ?? []
    }
  })

  const selectedSideQuests: StageNodeViewModel[] = selectedVisibleSideQuestIds.map((nodeId, index) => {
    const progress = input.progressByNodeId[nodeId]
    const status: StageStatus = progress?.status ?? 'LOCKED'
    const anchorIndex = Math.min(selectedStages.length - 1, Math.max(0, index + selectedPivotIndex - 1))
    const anchor = selectedStages[anchorIndex]
    const xOffset = index % 2 === 0 ? -13 : 13
    return {
      nodeId,
      title: getNodeTitle(curriculumNodeById, nodeId),
      status,
      isRecommended: selectedRecommendedPool.has(nodeId),
      isSideQuest: true,
      order: normalizedOrder(graphNodeById.get(nodeId)?.order),
      xPercent: Math.max(8, Math.min(92, (anchor?.xPercent ?? 50) + xOffset)),
      y: (anchor?.y ?? 0) + 64,
      missingPrereqNodeIds: progress?.lockedReasons?.missingPrereqNodeIds ?? []
    }
  })

  return {
    categories,
    selectedCategoryId,
    domains: filteredDomains,
    selectedDomainId: selectedDomainResolvedId,
    stages: selectedStages,
    sideQuests: selectedSideQuests,
    nextActions: selectedNextActions.slice(0, 2),
    hiddenFutureCount: selectedHiddenFutureCount
  }
}
