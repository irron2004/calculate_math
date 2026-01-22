import type {
  SkillGraphEdgeType,
  SkillGraphNodeCategory,
  SkillGraphV1
} from './schema'

export type SkillGraphEdgeRef = {
  edgeType: SkillGraphEdgeType
  source: string
  target: string
}

function edgeMatches(edge: SkillGraphEdgeRef, ref: SkillGraphEdgeRef): boolean {
  return (
    edge.edgeType === ref.edgeType &&
    edge.source === ref.source &&
    edge.target === ref.target
  )
}

export function addSkillGraphEdge(
  graph: SkillGraphV1,
  edge: SkillGraphEdgeRef
): SkillGraphV1 {
  const exists = graph.edges.some((existing) => edgeMatches(existing, edge))
  if (exists) return graph
  return { ...graph, edges: [...graph.edges, edge] }
}

export function removeSkillGraphEdge(
  graph: SkillGraphV1,
  edge: SkillGraphEdgeRef
): SkillGraphV1 {
  const nextEdges = graph.edges.filter((existing) => !edgeMatches(existing, edge))
  if (nextEdges.length === graph.edges.length) return graph
  return { ...graph, edges: nextEdges }
}

export function reverseSkillGraphEdge(
  graph: SkillGraphV1,
  edge: SkillGraphEdgeRef
): SkillGraphV1 {
  const removed = removeSkillGraphEdge(graph, edge)
  if (removed === graph) return graph
  return addSkillGraphEdge(removed, {
    edgeType: edge.edgeType,
    source: edge.target,
    target: edge.source
  })
}

export function updateSkillGraphEdgeType(
  graph: SkillGraphV1,
  params: { edge: SkillGraphEdgeRef; nextEdgeType: SkillGraphEdgeType }
): SkillGraphV1 {
  const existingIndex = graph.edges.findIndex((value) => edgeMatches(value, params.edge))
  if (existingIndex === -1) return graph

  const current = graph.edges[existingIndex]
  const updated: SkillGraphEdgeRef = {
    edgeType: params.nextEdgeType,
    source: current.source,
    target: current.target
  }

  const nextEdges = [...graph.edges]
  nextEdges.splice(existingIndex, 1)
  if (!nextEdges.some((value) => edgeMatches(value, updated))) {
    nextEdges.push(updated)
  }

  return { ...graph, edges: nextEdges }
}

export function updateSkillGraphNodeMeta(
  graph: SkillGraphV1,
  params: {
    nodeId: string
    nodeCategory: SkillGraphNodeCategory
    start: boolean
  }
): SkillGraphV1 {
  const index = graph.nodes.findIndex((node) => node.id === params.nodeId)
  if (index === -1) return graph

  const current = graph.nodes[index]
  const nextNode = {
    ...current,
    nodeCategory: params.nodeCategory,
    ...(params.start ? { start: true } : {})
  }
  if (!params.start) {
    delete (nextNode as { start?: boolean }).start
  }

  const nextNodes = [...graph.nodes]
  nextNodes[index] = nextNode
  return { ...graph, nodes: nextNodes }
}

