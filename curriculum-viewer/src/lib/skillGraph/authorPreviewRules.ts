import type { SkillGraphEdgeType, SkillGraphV1 } from './schema'
import { validateSkillGraphV1Rules } from './validate'

export function getStartableNodeIds(graph: SkillGraphV1): string[] {
  const nodeIdSet = new Set(graph.nodes.map((node) => node.id))
  const incomingRequiresCount = new Map<string, number>()

  for (const edge of graph.edges) {
    if (edge.edgeType !== 'requires') continue
    if (!nodeIdSet.has(edge.target)) continue
    incomingRequiresCount.set(edge.target, (incomingRequiresCount.get(edge.target) ?? 0) + 1)
  }

  return graph.nodes
    .filter((node) => node.start === true || (incomingRequiresCount.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
}

export function getConnectableTargetIds(params: {
  graph: SkillGraphV1
  sourceId: string
  edgeType: SkillGraphEdgeType
}): string[] {
  const nodeIdSet = new Set(params.graph.nodes.map((node) => node.id))
  if (!nodeIdSet.has(params.sourceId)) return []

  const existing = new Set(
    params.graph.edges.map((edge) => `${edge.edgeType}\u0000${edge.source}\u0000${edge.target}`)
  )

  const hasRequiresCycle = validateSkillGraphV1Rules(params.graph).some((issue) => issue.code === 'requires_cycle')

  const result: string[] = []
  for (const target of params.graph.nodes) {
    const targetId = target.id
    if (targetId === params.sourceId) continue

    const edgeKey = `${params.edgeType}\u0000${params.sourceId}\u0000${targetId}`
    if (existing.has(edgeKey)) continue

    if (params.edgeType === 'requires' && target.start === true) continue

    if (params.edgeType === 'requires' && !hasRequiresCycle) {
      const simulated: SkillGraphV1 = {
        ...params.graph,
        edges: [...params.graph.edges, { edgeType: params.edgeType, source: params.sourceId, target: targetId }]
      }
      const introducesCycle = validateSkillGraphV1Rules(simulated).some((issue) => issue.code === 'requires_cycle')
      if (introducesCycle) continue
    }

    result.push(targetId)
  }

  return result
}

