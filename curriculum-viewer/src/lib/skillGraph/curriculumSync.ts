import type { CurriculumData, CurriculumNodeType } from '../curriculum/types'
import type { SkillGraphEdgeV1, SkillGraphNodeCategory, SkillGraphNodeV1, SkillGraphV1 } from './schema'

type CurriculumMeta = {
  schema_version?: string
  curriculum_id?: string
  locale?: string
}

function readCurriculumMeta(data: CurriculumData): CurriculumMeta {
  const meta = data.meta
  if (!meta || typeof meta !== 'object') return {}
  return meta as CurriculumMeta
}

function normalizeGraphId(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function deriveCurriculumGraphId(data: CurriculumData): string {
  const meta = readCurriculumMeta(data)
  return (
    normalizeGraphId(meta.curriculum_id) ??
    normalizeGraphId(meta.schema_version) ??
    'curriculum_math_v1'
  )
}

export function deriveCurriculumGraphTitle(data: CurriculumData): string {
  const meta = readCurriculumMeta(data)
  return (
    normalizeGraphId(meta.curriculum_id) ??
    normalizeGraphId(meta.schema_version) ??
    'Curriculum Graph'
  )
}

function mapNodeCategory(nodeType: CurriculumNodeType): SkillGraphNodeCategory {
  if (nodeType === 'standard') return 'formal'
  return 'core'
}

function buildCurriculumNodes(data: CurriculumData): SkillGraphNodeV1[] {
  return data.nodes.map((node, index) => ({
    id: node.id,
    nodeCategory: mapNodeCategory(node.type),
    label: node.title || node.id,
    order: index
  }))
}

function buildCurriculumEdges(data: CurriculumData): SkillGraphEdgeV1[] {
  const edges: SkillGraphEdgeV1[] = []
  const nodeIds = new Set(data.nodes.map((node) => node.id))

  for (const node of data.nodes) {
    for (const childId of node.children_ids ?? []) {
      if (!nodeIds.has(childId)) continue
      edges.push({ edgeType: 'contains', source: node.id, target: childId })
    }
  }

  return edges
}

export function buildSkillGraphFromCurriculum(data: CurriculumData): SkillGraphV1 {
  const graphId = deriveCurriculumGraphId(data)
  const title = deriveCurriculumGraphTitle(data)
  return {
    schemaVersion: 'skill-graph-v1',
    graphId,
    title,
    nodes: buildCurriculumNodes(data),
    edges: buildCurriculumEdges(data),
    meta: {
      curriculum: {
        graphId,
        locale: readCurriculumMeta(data).locale ?? 'unknown',
        nodeCount: data.nodes.length
      }
    }
  }
}

export function mergeCurriculumIntoGraph(params: {
  graph: SkillGraphV1 | null
  curriculum: CurriculumData
}): { graph: SkillGraphV1; changed: boolean } {
  if (!params.graph) {
    return { graph: buildSkillGraphFromCurriculum(params.curriculum), changed: true }
  }

  const graph = params.graph
  const nextNodes = [...graph.nodes]
  const nextEdges = [...graph.edges]

  const existingNodeIds = new Set(graph.nodes.map((node) => node.id))
  const existingEdgeKeys = new Set(
    graph.edges.map((edge) => `${edge.edgeType}\u0000${edge.source}\u0000${edge.target}`)
  )

  let changed = false
  for (const node of buildCurriculumNodes(params.curriculum)) {
    if (existingNodeIds.has(node.id)) continue
    existingNodeIds.add(node.id)
    nextNodes.push(node)
    changed = true
  }

  for (const edge of buildCurriculumEdges(params.curriculum)) {
    const key = `${edge.edgeType}\u0000${edge.source}\u0000${edge.target}`
    if (existingEdgeKeys.has(key)) continue
    existingEdgeKeys.add(key)
    nextEdges.push(edge)
    changed = true
  }

  if (!changed) {
    return { graph, changed: false }
  }

  const meta = typeof graph.meta === 'object' && graph.meta !== null ? graph.meta : {}
  const curriculumMeta = readCurriculumMeta(params.curriculum)

  return {
    graph: {
      ...graph,
      nodes: nextNodes,
      edges: nextEdges,
      meta: {
        ...meta,
        curriculum: {
          ...(typeof (meta as Record<string, unknown>).curriculum === 'object'
            ? ((meta as Record<string, unknown>).curriculum as Record<string, unknown>)
            : {}),
          graphId: graph.graphId,
          locale: curriculumMeta.locale ?? 'unknown',
          nodeCount: params.curriculum.nodes.length
        }
      }
    },
    changed: true
  }
}
