import type { SkillGraphEdgeType, SkillGraphNodeV1, SkillGraphV1 } from './schema'
import { validateSkillGraphV1Rules } from './validate'

export type ConnectableTarget = {
  node: SkillGraphNodeV1
  isConnectable: boolean
  reason?: string
}

type EdgeAdditionContext = {
  nodeIdSet: Set<string>
  nodeById: Map<string, SkillGraphNodeV1>
  existingKeys: Set<string>
  hasRequiresCycle: boolean
}

function edgeKey(edgeType: SkillGraphEdgeType, source: string, target: string): string {
  return `${edgeType}\u0000${source}\u0000${target}`
}

function buildEdgeAdditionContext(graph: SkillGraphV1, edgeType: SkillGraphEdgeType): EdgeAdditionContext {
  const nodeIdSet = new Set(graph.nodes.map((node) => node.id))
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const existingKeys = new Set(
    graph.edges.map((edge) => edgeKey(edge.edgeType, edge.source, edge.target))
  )

  const hasRequiresCycle =
    edgeType === 'requires'
      ? validateSkillGraphV1Rules(graph).some((issue) => issue.code === 'requires_cycle')
      : false

  return { nodeIdSet, nodeById, existingKeys, hasRequiresCycle }
}

function getEdgeAdditionErrorWithContext(params: {
  graph: SkillGraphV1
  edgeType: SkillGraphEdgeType
  sourceId: string
  targetId: string
  context: EdgeAdditionContext
}): string | null {
  const { graph, edgeType, sourceId, targetId, context } = params
  if (!sourceId || !targetId) return '연결 대상이 올바르지 않습니다.'
  if (!context.nodeIdSet.has(sourceId) || !context.nodeIdSet.has(targetId)) {
    return '연결 대상이 올바르지 않습니다.'
  }
  if (sourceId === targetId) return '자기 자신에게 연결할 수 없습니다.'
  if (context.existingKeys.has(edgeKey(edgeType, sourceId, targetId))) {
    return '이미 동일한 연결이 존재합니다.'
  }

  const targetNode = context.nodeById.get(targetId)
  if (edgeType === 'requires' && targetNode?.start === true) {
    return 'start 노드에는 requires 연결을 추가할 수 없습니다.'
  }

  if (edgeType === 'requires' && !context.hasRequiresCycle) {
    const simulated: SkillGraphV1 = {
      ...graph,
      edges: [...graph.edges, { edgeType, source: sourceId, target: targetId }]
    }
    const introducesCycle = validateSkillGraphV1Rules(simulated).some(
      (issue) => issue.code === 'requires_cycle'
    )
    if (introducesCycle) return 'requires 사이클이 생깁니다.'
  }

  return null
}

export function getEdgeAdditionError(params: {
  graph: SkillGraphV1
  edgeType: SkillGraphEdgeType
  sourceId: string
  targetId: string
}): string | null {
  const context = buildEdgeAdditionContext(params.graph, params.edgeType)
  return getEdgeAdditionErrorWithContext({
    ...params,
    context
  })
}

export function listConnectableTargets(params: {
  graph: SkillGraphV1
  sourceId: string
  edgeType: SkillGraphEdgeType
}): ConnectableTarget[] {
  const context = buildEdgeAdditionContext(params.graph, params.edgeType)
  if (!context.nodeIdSet.has(params.sourceId)) return []

  return params.graph.nodes
    .filter((node) => node.id !== params.sourceId)
    .map((node) => {
      const reason = getEdgeAdditionErrorWithContext({
        graph: params.graph,
        edgeType: params.edgeType,
        sourceId: params.sourceId,
        targetId: node.id,
        context
      })
      return {
        node,
        isConnectable: reason === null,
        ...(reason ? { reason } : {})
      }
    })
}
