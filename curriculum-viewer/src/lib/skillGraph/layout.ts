import dagre from 'dagre'
import type { SkillGraphV1 } from './schema'

export type LayoutPositions = Record<string, { x: number; y: number }>

const NODE_WIDTH = 300
const NODE_HEIGHT = 90

const DAGRE_LAYOUT_DEFAULTS = {
  rankdir: 'TB' as const,
  nodesep: 50,
  ranksep: 80,
  marginx: 20,
  marginy: 20
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readGraphLayoutPositions(graph: SkillGraphV1): LayoutPositions {
  const meta = isRecord(graph.meta) ? graph.meta : {}
  const layout = isRecord(meta.layout) ? meta.layout : {}
  const positionsRaw = layout.positions
  if (!isRecord(positionsRaw)) return {}

  const positions: LayoutPositions = {}
  for (const [nodeId, value] of Object.entries(positionsRaw)) {
    if (!isRecord(value)) continue
    const x = typeof value.x === 'number' ? value.x : null
    const y = typeof value.y === 'number' ? value.y : null
    if (x === null || y === null) continue
    positions[nodeId] = { x, y }
  }
  return positions
}

export function writeGraphLayoutPositions(graph: SkillGraphV1, positions: LayoutPositions): SkillGraphV1 {
  const meta = isRecord(graph.meta) ? graph.meta : {}
  const layout = isRecord(meta.layout) ? meta.layout : {}
  return {
    ...graph,
    meta: {
      ...meta,
      layout: {
        ...layout,
        positions
      }
    }
  }
}

export function computeDagreLayoutPositions(graph: SkillGraphV1): LayoutPositions {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph(DAGRE_LAYOUT_DEFAULTS)

  for (const node of graph.nodes) {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  for (const edge of graph.edges) {
    dagreGraph.setEdge(edge.source, edge.target)
  }

  dagre.layout(dagreGraph)

  const positions: LayoutPositions = {}
  for (const node of graph.nodes) {
    const pos = dagreGraph.node(node.id) as { x: number; y: number } | undefined
    positions[node.id] = {
      x: (pos?.x ?? 0) - NODE_WIDTH / 2,
      y: (pos?.y ?? 0) - NODE_HEIGHT / 2
    }
  }

  return positions
}

export function selectGraphLayoutPositions(graph: SkillGraphV1): LayoutPositions {
  const existing = readGraphLayoutPositions(graph)
  const allHavePositions = graph.nodes.every((node) => Boolean(existing[node.id]))
  if (allHavePositions && graph.nodes.length > 0) {
    return existing
  }

  const dagrePositions = computeDagreLayoutPositions(graph)
  if (Object.keys(existing).length === 0) {
    return dagrePositions
  }

  return { ...dagrePositions, ...existing }
}

export function ensureGraphLayoutPositions(graph: SkillGraphV1): {
  graph: SkillGraphV1
  positions: LayoutPositions
  changed: boolean
} {
  const existing = readGraphLayoutPositions(graph)
  const allHavePositions = graph.nodes.every((node) => Boolean(existing[node.id]))
  if (allHavePositions) {
    return { graph, positions: existing, changed: false }
  }

  const positions = selectGraphLayoutPositions(graph)
  return { graph: writeGraphLayoutPositions(graph, positions), positions, changed: true }
}

export function updateGraphLayoutPosition(
  graph: SkillGraphV1,
  nodeId: string,
  position: { x: number; y: number }
): SkillGraphV1 {
  const positions = { ...readGraphLayoutPositions(graph), [nodeId]: position }
  return writeGraphLayoutPositions(graph, positions)
}

export function resetGraphLayout(graph: SkillGraphV1): SkillGraphV1 {
  const positions = computeDagreLayoutPositions(graph)
  return writeGraphLayoutPositions(graph, positions)
}
