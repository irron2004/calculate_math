import type { ProblemBank } from '../learn/problems'
import type { Curriculum2022Graph } from './graph'

export type CurriculumGraphSchemaVersion = 'curriculum-graph-v2'

export type CurriculumGraphNodeType = 'unit' | 'skill' | 'problem'

export type CurriculumGraphEdgeType =
  | 'contains'
  | 'requires'
  | 'prepares_for'
  | 'related'
  | 'has_problem'
  | 'measures'

export type CurriculumGraphNodeV2 = {
  id: string
  nodeType: CurriculumGraphNodeType
  label: string
  originalNodeType?: string
  gradeBand?: string
  domainCode?: string
  parentId?: string
  text?: string
  note?: string
  reason?: string
  problemSourceNodeId?: string
}

export type CurriculumGraphEdgeV2 = {
  edgeType: CurriculumGraphEdgeType
  source: string
  target: string
}

export type CurriculumGraphV2 = {
  schemaVersion: CurriculumGraphSchemaVersion
  graphId: string
  title: string
  nodes: CurriculumGraphNodeV2[]
  edges: CurriculumGraphEdgeV2[]
  meta?: Record<string, unknown>
}

type BuildCurriculumGraphV2Params = {
  curriculum: Curriculum2022Graph
  problemBank?: ProblemBank | null
  includeMeasuresEdges?: boolean
}

const UNIT_SOURCE_NODE_TYPES = new Set(['root', 'schoolLevel', 'gradeBand', 'domain', 'textbookUnit', 'unit'])
const SKILL_SOURCE_NODE_TYPES = new Set(['achievement', 'skill'])

function mapNodeType(nodeType: string): CurriculumGraphNodeType {
  if (UNIT_SOURCE_NODE_TYPES.has(nodeType)) return 'unit'
  if (SKILL_SOURCE_NODE_TYPES.has(nodeType)) return 'skill'
  return 'skill'
}

function mapEdgeType(edgeType: string): CurriculumGraphEdgeType | null {
  switch (edgeType) {
    case 'contains':
      return 'contains'
    case 'prereq':
      return 'requires'
    case 'alignsTo':
      return 'prepares_for'
    case 'related':
      return 'related'
    default:
      return null
  }
}

function buildGraphId(curriculum: Curriculum2022Graph): string {
  const meta = curriculum.meta
  if (!meta) return 'KR-MATH-2022'
  const curriculumId = typeof meta.curriculumId === 'string' ? meta.curriculumId.trim() : ''
  return curriculumId || 'KR-MATH-2022'
}

function buildGraphTitle(curriculum: Curriculum2022Graph): string {
  const rootNode = curriculum.nodes.find((node) => node.nodeType === 'root')
  if (rootNode?.label) return rootNode.label
  return 'Curriculum Graph'
}

function createProblemNodeId(problemId: string, existingIds: Set<string>): string {
  if (!existingIds.has(problemId)) return problemId
  const prefixed = `problem:${problemId}`
  if (!existingIds.has(prefixed)) return prefixed

  let suffix = 2
  while (existingIds.has(`${prefixed}:${suffix}`)) {
    suffix += 1
  }
  return `${prefixed}:${suffix}`
}

export function buildCurriculumGraphV2(params: BuildCurriculumGraphV2Params): CurriculumGraphV2 {
  const graphId = buildGraphId(params.curriculum)
  const title = buildGraphTitle(params.curriculum)

  const nodes: CurriculumGraphNodeV2[] = []
  const edges: CurriculumGraphEdgeV2[] = []
  const nodeIdSet = new Set<string>()
  const edgeKeySet = new Set<string>()

  const pushEdge = (edge: CurriculumGraphEdgeV2) => {
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) return
    if (edge.source === edge.target) return
    const key = `${edge.edgeType}\u0000${edge.source}\u0000${edge.target}`
    if (edgeKeySet.has(key)) return
    edgeKeySet.add(key)
    edges.push(edge)
  }

  for (const node of params.curriculum.nodes) {
    if (!node.id || nodeIdSet.has(node.id)) continue
    nodeIdSet.add(node.id)
    nodes.push({
      id: node.id,
      nodeType: mapNodeType(node.nodeType),
      label: node.label,
      originalNodeType: node.nodeType,
      ...(node.gradeBand ? { gradeBand: node.gradeBand } : {}),
      ...(node.domainCode ? { domainCode: node.domainCode } : {}),
      ...(node.parentId ? { parentId: node.parentId } : {}),
      ...(node.text ? { text: node.text } : {}),
      ...(node.note ? { note: node.note } : {}),
      ...(node.reason ? { reason: node.reason } : {})
    })
  }

  for (const node of params.curriculum.nodes) {
    if (!node.parentId) continue
    pushEdge({ edgeType: 'contains', source: node.parentId, target: node.id })
  }

  for (const edge of params.curriculum.edges) {
    const edgeType = mapEdgeType(edge.edgeType)
    if (!edgeType) continue
    pushEdge({ edgeType, source: edge.source, target: edge.target })
  }

  const includeMeasuresEdges = Boolean(params.includeMeasuresEdges)
  const problemsByNodeId = params.problemBank?.problemsByNodeId ?? {}
  for (const [skillNodeId, problems] of Object.entries(problemsByNodeId)) {
    if (!nodeIdSet.has(skillNodeId)) continue
    if (!Array.isArray(problems) || problems.length === 0) continue

    for (const problem of problems) {
      const problemNodeId = createProblemNodeId(problem.id, nodeIdSet)
      if (!nodeIdSet.has(problemNodeId)) {
        nodeIdSet.add(problemNodeId)
        nodes.push({
          id: problemNodeId,
          nodeType: 'problem',
          label: problem.prompt,
          originalNodeType: 'problem',
          problemSourceNodeId: skillNodeId
        })
      }

      pushEdge({ edgeType: 'has_problem', source: skillNodeId, target: problemNodeId })
      if (includeMeasuresEdges) {
        pushEdge({ edgeType: 'measures', source: problemNodeId, target: skillNodeId })
      }
    }
  }

  return {
    schemaVersion: 'curriculum-graph-v2',
    graphId,
    title,
    nodes,
    edges,
    meta: {
      ...(params.curriculum.meta ?? {}),
      sourceSchema: 'curriculum-2022'
    }
  }
}
