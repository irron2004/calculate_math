import type { SkillGraphEdgeType, SkillGraphNodeCategory, SkillGraphV1 } from './schema'
import { validateSkillGraphV1Rules, validateSkillGraphV1RulesBasic } from './validate'

export type GraphIssueSeverity = 'error' | 'warn'

export type GraphIssue = {
  code: string
  severity: GraphIssueSeverity
  message: string
  nodeId?: string
}

type PublishedEntry = {
  graph: SkillGraphV1
  publishedAt: number
}

let activePublishedGraphId: string | null = null
const publishedByGraphId = new Map<string, PublishedEntry>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key]
  return typeof value === 'string' ? value : null
}

function readBoolean(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key]
  return typeof value === 'boolean' ? value : undefined
}

function readNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readArray(input: Record<string, unknown>, key: string): unknown[] | null {
  const value = input[key]
  return Array.isArray(value) ? value : null
}

function pushError(issues: GraphIssue[], code: string, message: string, nodeId?: string) {
  issues.push({ code, severity: 'error', message, nodeId })
}

function pushWarn(issues: GraphIssue[], code: string, message: string, nodeId?: string) {
  issues.push({ code, severity: 'warn', message, nodeId })
}

const SCHEMA_VERSION = 'skill-graph-v1'
const NODE_CATEGORIES = new Set<SkillGraphNodeCategory>(['core', 'challenge', 'formal'])
const EDGE_TYPES = new Set<SkillGraphEdgeType>(['requires', 'prepares_for', 'related', 'contains'])

function toSkillGraphV1(input: unknown): { ok: true; graph: SkillGraphV1; schemaIssues: GraphIssue[] } | { ok: false; schemaIssues: GraphIssue[] } {
  const schemaIssues: GraphIssue[] = []

  if (!isRecord(input)) {
    pushError(schemaIssues, 'schema_not_object', 'Top-level graph must be an object')
    return { ok: false, schemaIssues }
  }

  const schemaVersion = readString(input, 'schemaVersion')
  if (schemaVersion !== SCHEMA_VERSION) {
    pushError(schemaIssues, 'invalid_schema_version', `schemaVersion must be "${SCHEMA_VERSION}"`)
  }

  const graphId = readString(input, 'graphId')
  if (!graphId || graphId.trim().length === 0) {
    pushError(schemaIssues, 'missing_graph_id', 'graphId must be a non-empty string')
  }

  const title = readString(input, 'title')
  if (!title || title.trim().length === 0) {
    pushError(schemaIssues, 'missing_title', 'title must be a non-empty string')
  }

  const nodesRaw = readArray(input, 'nodes')
  if (!nodesRaw) {
    pushError(schemaIssues, 'nodes_not_array', 'nodes must be an array')
  }

  const edgesRaw = readArray(input, 'edges')
  if (!edgesRaw) {
    pushError(schemaIssues, 'edges_not_array', 'edges must be an array')
  }

  if (!nodesRaw || !edgesRaw) {
    return { ok: false, schemaIssues }
  }

  const nodes = nodesRaw.flatMap((raw, index) => {
    if (!isRecord(raw)) {
      pushError(schemaIssues, 'node_not_object', `nodes[${index}] must be an object`)
      return []
    }

    const id = readString(raw, 'id')
    if (!id || id.trim().length === 0) {
      pushError(schemaIssues, 'invalid_id', `nodes[${index}].id must be a non-empty string`)
      return []
    }

    const nodeCategoryRaw = readString(raw, 'nodeCategory')
    if (!nodeCategoryRaw || !NODE_CATEGORIES.has(nodeCategoryRaw as SkillGraphNodeCategory)) {
      pushError(schemaIssues, 'invalid_node_category', `nodes[${index}].nodeCategory must be a valid category`, id)
      return []
    }

    const label = readString(raw, 'label')
    if (!label || label.trim().length === 0) {
      pushError(schemaIssues, 'missing_label', `nodes[${index}].label must be a non-empty string`, id)
      return []
    }

    const start = readBoolean(raw, 'start')
    const order = readNumber(raw, 'order')

    return [
      {
        id,
        nodeCategory: nodeCategoryRaw as SkillGraphNodeCategory,
        label,
        start,
        order
      }
    ]
  })

  const edges = edgesRaw.flatMap((raw, index) => {
    if (!isRecord(raw)) {
      pushError(schemaIssues, 'edge_not_object', `edges[${index}] must be an object`)
      return []
    }

    const edgeTypeRaw = readString(raw, 'edgeType')
    if (!edgeTypeRaw || !EDGE_TYPES.has(edgeTypeRaw as SkillGraphEdgeType)) {
      pushError(schemaIssues, 'invalid_edge_type', `edges[${index}].edgeType must be a valid edge type`)
      return []
    }

    const source = readString(raw, 'source')
    if (!source || source.trim().length === 0) {
      pushError(schemaIssues, 'missing_edge_source', `edges[${index}].source must be a non-empty string`)
      return []
    }

    const target = readString(raw, 'target')
    if (!target || target.trim().length === 0) {
      pushError(schemaIssues, 'missing_edge_target', `edges[${index}].target must be a non-empty string`)
      return []
    }

    return [{ edgeType: edgeTypeRaw as SkillGraphEdgeType, source, target }]
  })

  const graph: SkillGraphV1 = {
    schemaVersion: SCHEMA_VERSION,
    graphId: graphId ?? '',
    title: title ?? '',
    nodes,
    edges
  }

  return { ok: true, graph, schemaIssues }
}

export function validateGraph(input: unknown): GraphIssue[] {
  const parsed = toSkillGraphV1(input)

  if (!parsed.ok) {
    return parsed.schemaIssues
  }

  const issues: GraphIssue[] = [...parsed.schemaIssues]

  const ruleIssues = validateSkillGraphV1Rules(parsed.graph).map((issue) => ({
    code: issue.code,
    severity: issue.level,
    message: issue.message,
    nodeId: issue.nodeId
  }))

  const seen = new Set<string>()
  const output: GraphIssue[] = []

  for (const issue of [...issues, ...ruleIssues]) {
    const key = `${issue.code}:${issue.severity}:${issue.nodeId ?? ''}:${issue.message}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(issue)
  }

  return output
}

export function validateGraphBasic(graph: SkillGraphV1): GraphIssue[] {
  return validateSkillGraphV1RulesBasic(graph).map((issue) => ({
    code: issue.code,
    severity: issue.level,
    message: issue.message,
    nodeId: issue.nodeId
  }))
}

export function publish(graph: SkillGraphV1, publishedAt: number = Date.now()): void {
  publishedByGraphId.set(graph.graphId, { graph, publishedAt })
  activePublishedGraphId = graph.graphId
}

export function getPublished(): SkillGraphV1 | null {
  if (!activePublishedGraphId) return null
  return publishedByGraphId.get(activePublishedGraphId)?.graph ?? null
}

export function getStudentGraph(): SkillGraphV1 | null {
  return getPublished()
}

export function __resetSkillGraphCoreForTests(): void {
  activePublishedGraphId = null
  publishedByGraphId.clear()
}
