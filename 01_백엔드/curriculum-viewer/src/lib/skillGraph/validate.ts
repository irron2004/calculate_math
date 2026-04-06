import type { SkillGraphEdgeV1, SkillGraphNodeV1, SkillGraphV1 } from './schema'

export type SkillGraphValidationLevel = 'error' | 'warn'

export type SkillGraphValidationIssue = {
  level: SkillGraphValidationLevel
  code:
    | 'requires_cycle'
    | 'missing_node_ref'
    | 'self_loop'
    | 'duplicate_node_id'
    | 'no_start_nodes'
    | 'multiple_start_nodes'
    | 'start_incoming_requires'
  message: string
  nodeId?: string
}

function pushIssue(
  issues: SkillGraphValidationIssue[],
  issue: SkillGraphValidationIssue
) {
  issues.push(issue)
}

function getNodeIdCounts(nodes: SkillGraphNodeV1[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const node of nodes) {
    counts.set(node.id, (counts.get(node.id) ?? 0) + 1)
  }
  return counts
}

export function validateSkillGraphV1RulesBasic(graph: SkillGraphV1): SkillGraphValidationIssue[] {
  const issues: SkillGraphValidationIssue[] = []

  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  const idCounts = getNodeIdCounts(graph.nodes)

  for (const [nodeId, count] of idCounts.entries()) {
    if (count > 1) {
      pushIssue(issues, {
        level: 'error',
        code: 'duplicate_node_id',
        nodeId,
        message: `Duplicate node id: ${nodeId} (${count} occurrences)`
      })
    }
  }

  for (const edge of graph.edges) {
    if (edge.source === edge.target) {
      pushIssue(issues, {
        level: 'error',
        code: 'self_loop',
        nodeId: edge.source,
        message: `Self-loop edge is not allowed: ${edge.source} -> ${edge.target}`
      })
    }

    if (!nodeIds.has(edge.source)) {
      pushIssue(issues, {
        level: 'error',
        code: 'missing_node_ref',
        nodeId: edge.source,
        message: `Edge source references missing node: ${edge.source}`
      })
    }
    if (!nodeIds.has(edge.target)) {
      pushIssue(issues, {
        level: 'error',
        code: 'missing_node_ref',
        nodeId: edge.target,
        message: `Edge target references missing node: ${edge.target}`
      })
    }
  }

  return issues
}

function detectRequiresCycle(params: {
  nodeIds: Set<string>
  edges: SkillGraphEdgeV1[]
}): { cycleNodeId?: string; cyclePath?: string[] } {
  const adjacency = new Map<string, string[]>()
  for (const nodeId of params.nodeIds) adjacency.set(nodeId, [])

  for (const edge of params.edges) {
    if (edge.edgeType !== 'requires') continue
    if (!params.nodeIds.has(edge.source) || !params.nodeIds.has(edge.target)) continue
    adjacency.get(edge.source)?.push(edge.target)
  }

  const color = new Map<string, 0 | 1 | 2>() // 0=unvisited,1=visiting,2=done
  for (const nodeId of params.nodeIds) color.set(nodeId, 0)

  const stack: string[] = []
  const stackIndex = new Map<string, number>()

  const visit = (nodeId: string): { cycleNodeId?: string; cyclePath?: string[] } => {
    color.set(nodeId, 1)
    stackIndex.set(nodeId, stack.length)
    stack.push(nodeId)
    for (const nextId of adjacency.get(nodeId) ?? []) {
      const state = color.get(nextId) ?? 0
      if (state === 1) {
        const startIndex = stackIndex.get(nextId)
        const cyclePath =
          startIndex === undefined ? undefined : [...stack.slice(startIndex), nextId]
        return { cycleNodeId: nextId, cyclePath }
      }
      if (state === 0) {
        const found = visit(nextId)
        if (found.cycleNodeId) return found
      }
    }
    stack.pop()
    stackIndex.delete(nodeId)
    color.set(nodeId, 2)
    return {}
  }

  for (const nodeId of params.nodeIds) {
    if ((color.get(nodeId) ?? 0) !== 0) continue
    const found = visit(nodeId)
    if (found.cycleNodeId) return found
  }

  return {}
}

export function validateSkillGraphV1Rules(graph: SkillGraphV1): SkillGraphValidationIssue[] {
  const issues: SkillGraphValidationIssue[] = []

  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  const idCounts = getNodeIdCounts(graph.nodes)

  for (const [nodeId, count] of idCounts.entries()) {
    if (count > 1) {
      pushIssue(issues, {
        level: 'error',
        code: 'duplicate_node_id',
        nodeId,
        message: `Duplicate node id: ${nodeId} (${count} occurrences)`
      })
    }
  }

  const startNodes = graph.nodes.filter((node) => node.start)
  if (startNodes.length === 0) {
    pushIssue(issues, {
      level: 'warn',
      code: 'no_start_nodes',
      message: 'No start nodes found (consider marking at least one node as start)'
    })
  } else if (startNodes.length > 1) {
    pushIssue(issues, {
      level: 'warn',
      code: 'multiple_start_nodes',
      message: `Multiple start nodes found (${startNodes.length})`
    })
  }

  const incomingRequiresCount = new Map<string, number>()
  for (const edge of graph.edges) {
    if (edge.edgeType === 'requires') {
      incomingRequiresCount.set(edge.target, (incomingRequiresCount.get(edge.target) ?? 0) + 1)
    }

    if (edge.source === edge.target) {
      pushIssue(issues, {
        level: 'error',
        code: 'self_loop',
        nodeId: edge.source,
        message: `Self-loop edge is not allowed: ${edge.source} -> ${edge.target}`
      })
    }

    if (!nodeIds.has(edge.source)) {
      pushIssue(issues, {
        level: 'error',
        code: 'missing_node_ref',
        nodeId: edge.source,
        message: `Edge source references missing node: ${edge.source}`
      })
    }
    if (!nodeIds.has(edge.target)) {
      pushIssue(issues, {
        level: 'error',
        code: 'missing_node_ref',
        nodeId: edge.target,
        message: `Edge target references missing node: ${edge.target}`
      })
    }
  }

  for (const startNode of startNodes) {
    if ((incomingRequiresCount.get(startNode.id) ?? 0) > 0) {
      pushIssue(issues, {
        level: 'warn',
        code: 'start_incoming_requires',
        nodeId: startNode.id,
        message: `Start node has incoming requires edges: ${startNode.id}`
      })
    }
  }

  const cycle = detectRequiresCycle({ nodeIds, edges: graph.edges })
  if (cycle.cycleNodeId) {
    const pathSuffix =
      cycle.cyclePath && cycle.cyclePath.length > 1 ? `: ${cycle.cyclePath.join(' -> ')}` : ''
    pushIssue(issues, {
      level: 'error',
      code: 'requires_cycle',
      nodeId: cycle.cycleNodeId,
      message: `Requires edges contain a cycle${pathSuffix}`
    })
  }

  return issues
}
