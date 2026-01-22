import type { LearningGraphEdge, LearningGraphNode, LearningGraphV1 } from './types'

type LearningGraphFileV1 = LearningGraphV1 & { version: 1 }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function parseNode(raw: unknown): LearningGraphNode | null {
  if (!isRecord(raw)) return null
  const id = asString(raw.id)?.trim()
  if (!id) return null

  const isStart = typeof raw.isStart === 'boolean' ? raw.isStart : undefined
  const order = typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : undefined

  return { id, isStart, order }
}

function parseEdge(raw: unknown): LearningGraphEdge | null {
  if (!isRecord(raw)) return null
  const sourceId = asString(raw.sourceId)?.trim()
  const targetId = asString(raw.targetId)?.trim()
  const type = raw.type === 'requires' || raw.type === 'prepares_for' ? raw.type : null

  if (!sourceId || !targetId || !type) return null
  return { sourceId, targetId, type }
}

export function parseLearningGraphV1(raw: unknown): LearningGraphFileV1 | null {
  if (!isRecord(raw)) return null
  if (raw.version !== 1) return null
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null

  const nodes = raw.nodes.map(parseNode).filter((node): node is LearningGraphNode => Boolean(node))
  const edges = raw.edges.map(parseEdge).filter((edge): edge is LearningGraphEdge => Boolean(edge))

  if (nodes.length === 0) return null

  const nodeIdSet = new Set(nodes.map((node) => node.id))
  const filteredEdges = edges.filter((edge) => nodeIdSet.has(edge.sourceId) && nodeIdSet.has(edge.targetId))

  return { version: 1, nodes, edges: filteredEdges }
}

export async function loadLearningGraphV1(signal?: AbortSignal): Promise<LearningGraphFileV1> {
  const response = await fetch('/data/learning_graph_v1.json', { signal })
  if (!response.ok) {
    throw new Error(`Failed to load learning graph (HTTP ${response.status})`)
  }

  const json = (await response.json()) as unknown
  const parsed = parseLearningGraphV1(json)
  if (!parsed) {
    throw new Error('Invalid learning_graph_v1.json schema')
  }

  return parsed
}

