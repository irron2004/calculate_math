import dagre from 'dagre'
import { buildProgressionEdges } from './progression'
import { buildContainsEdgeRefsSkippingGradeNodes, getGraphVisibleNodes } from './graphView'
import type { CurriculumNode } from './types'

export type GraphLayoutDirection = 'TB' | 'LR'

export const GRAPH_LAYOUT_DEFAULTS = {
  rankdir: 'TB',
  nodesep: 30,
  ranksep: 60,
  marginx: 20,
  marginy: 20
} as const

const NODE_WIDTH = 260
const NODE_HEIGHT = 112

export type CurriculumGraphNode = {
  id: string
  title: string
  type: CurriculumNode['type']
  position: { x: number; y: number }
}

export type CurriculumGraphEdge = {
  id: string
  source: string
  target: string
  edgeType: 'contains' | 'progression'
  domainCode?: string
  fromGrade?: number
  toGrade?: number
}

export type CurriculumGraphLayout = {
  nodes: CurriculumGraphNode[]
  edges: CurriculumGraphEdge[]
}

function layoutWithDagre(params: {
  nodes: ReadonlyArray<CurriculumNode>
  edges: ReadonlyArray<{ source: string; target: string }>
  direction: GraphLayoutDirection
}): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    ...GRAPH_LAYOUT_DEFAULTS,
    rankdir: params.direction
  })

  for (const node of params.nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of params.edges) {
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  const positions = new Map<string, { x: number; y: number }>()
  for (const node of params.nodes) {
    const pos = graph.node(node.id) as { x: number; y: number } | undefined
    positions.set(node.id, {
      x: (pos?.x ?? 0) - NODE_WIDTH / 2,
      y: (pos?.y ?? 0) - NODE_HEIGHT / 2
    })
  }
  return positions
}

export function buildCurriculumGraphLayout(params: {
  nodes: ReadonlyArray<CurriculumNode>
  direction?: GraphLayoutDirection
}): CurriculumGraphLayout {
  const direction = params.direction ?? GRAPH_LAYOUT_DEFAULTS.rankdir
  const nodeById = new Map(params.nodes.map((node) => [node.id, node]))
  const visibleNodes = getGraphVisibleNodes(params.nodes)
  const containsEdges = buildContainsEdgeRefsSkippingGradeNodes(params.nodes, nodeById)
  const progressionEdges = buildProgressionEdges(params.nodes)

  const positions = layoutWithDagre({
    nodes: visibleNodes,
    edges: containsEdges,
    direction
  })

  const nodes: CurriculumGraphNode[] = visibleNodes.map((node) => ({
    id: node.id,
    title: node.title,
    type: node.type,
    position: positions.get(node.id) ?? { x: 0, y: 0 }
  }))

  const edges: CurriculumGraphEdge[] = [
    ...containsEdges.map((edge) => ({
      id: `contains:${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      edgeType: 'contains' as const
    })),
    ...progressionEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      edgeType: 'progression' as const,
      domainCode: edge.domainCode,
      fromGrade: edge.fromGrade,
      toGrade: edge.toGrade
    }))
  ]

  return { nodes, edges }
}
