export type SkillGraphSchemaVersion = 'skill-graph-v1'

export type SkillGraphNodeCategory = 'core' | 'challenge' | 'formal'

export type SkillGraphEdgeType = 'requires' | 'prepares_for' | 'related' | 'contains'

export type SkillGraphIssueCode =
  | 'schema_not_object'
  | 'invalid_schema_version'
  | 'missing_graph_id'
  | 'missing_title'
  | 'nodes_not_array'
  | 'edges_not_array'
  | 'node_not_object'
  | 'edge_not_object'
  | 'missing_edge_source'
  | 'missing_edge_target'
  | 'invalid_id'
  | 'duplicate_node_id'
  | 'invalid_node_category'
  | 'missing_label'
  | 'invalid_start'
  | 'invalid_order'
  | 'invalid_edge_type'
  | 'unknown_node_ref'
  | 'self_edge'
  | 'start_incoming_requires'

export type SkillGraphNodeV1 = {
  id: string
  nodeCategory: SkillGraphNodeCategory
  label: string
  start?: boolean
  order?: number
}

export type SkillGraphEdgeV1 = {
  edgeType: SkillGraphEdgeType
  source: string
  target: string
}

export type SkillGraphV1 = {
  schemaVersion: SkillGraphSchemaVersion
  graphId: string
  title: string
  nodes: SkillGraphNodeV1[]
  edges: SkillGraphEdgeV1[]
  meta?: Record<string, unknown>
}

export type SkillGraphIssue = {
  code: SkillGraphIssueCode
  path: string
  message: string
}

export class SkillGraphSchemaError extends Error {
  issues: SkillGraphIssue[]

  constructor(issues: SkillGraphIssue[]) {
    super(`Skill-Graph schema validation failed (${issues.length} issue(s))`)
    this.name = 'SkillGraphSchemaError'
    this.issues = issues
  }
}

const SCHEMA_VERSION: SkillGraphSchemaVersion = 'skill-graph-v1'
const NODE_CATEGORIES = new Set<SkillGraphNodeCategory>(['core', 'challenge', 'formal'])
const EDGE_TYPES = new Set<SkillGraphEdgeType>(['requires', 'prepares_for', 'related', 'contains'])

const ID_PATTERN = /^[A-Za-z0-9._-]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readOptionalRecord(input: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = input[key]
  return isRecord(value) ? value : null
}

function readOptionalString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key]
  return typeof value === 'string' ? value : null
}

function readOptionalNumber(input: Record<string, unknown>, key: string): number | null {
  const value = input[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readOptionalBoolean(input: Record<string, unknown>, key: string): boolean | null {
  const value = input[key]
  return typeof value === 'boolean' ? value : null
}

function readOptionalArray(input: Record<string, unknown>, key: string): unknown[] | null {
  const value = input[key]
  return Array.isArray(value) ? value : null
}

function pushIssue(issues: SkillGraphIssue[], code: SkillGraphIssueCode, path: string, message: string) {
  issues.push({ code, path, message })
}

function validateId(issues: SkillGraphIssue[], path: string, id: unknown): id is string {
  if (typeof id !== 'string') {
    pushIssue(issues, 'invalid_id', path, 'Must be a string')
    return false
  }

  const trimmed = id.trim()
  if (trimmed.length === 0) {
    pushIssue(issues, 'invalid_id', path, 'Must be a non-empty string')
    return false
  }

  if (trimmed !== id) {
    pushIssue(issues, 'invalid_id', path, 'Must not have leading/trailing whitespace')
    return false
  }

  if (!ID_PATTERN.test(id)) {
    pushIssue(issues, 'invalid_id', path, 'Must match /^[A-Za-z0-9._-]+$/ (no whitespace)')
    return false
  }

  return true
}

export function validateSkillGraphV1(input: unknown): SkillGraphIssue[] {
  const issues: SkillGraphIssue[] = []

  if (!isRecord(input)) {
    pushIssue(issues, 'schema_not_object', '$', 'Top-level JSON must be an object')
    return issues
  }

  const meta = readOptionalRecord(input, 'meta') ?? null

  const schemaVersion = readOptionalString(input, 'schemaVersion')
  if (schemaVersion !== SCHEMA_VERSION) {
    pushIssue(issues, 'invalid_schema_version', 'schemaVersion', `Must be "${SCHEMA_VERSION}"`)
  }

  const graphId = readOptionalString(input, 'graphId') ?? (meta ? readOptionalString(meta, 'graphId') : null)
  if (typeof graphId !== 'string' || graphId.trim().length === 0) {
    pushIssue(issues, 'missing_graph_id', 'graphId', 'Must be a non-empty string (or meta.graphId)')
  }

  const title = readOptionalString(input, 'title') ?? (meta ? readOptionalString(meta, 'title') : null)
  if (typeof title !== 'string' || title.trim().length === 0) {
    pushIssue(issues, 'missing_title', 'title', 'Must be a non-empty string (or meta.title)')
  }

  const nodesRaw = readOptionalArray(input, 'nodes')
  if (!nodesRaw) {
    pushIssue(issues, 'nodes_not_array', 'nodes', 'Must be an array')
  }

  const edgesRaw = readOptionalArray(input, 'edges')
  if (!edgesRaw) {
    pushIssue(issues, 'edges_not_array', 'edges', 'Must be an array')
  }

  const nodeIds = new Set<string>()

  for (let index = 0; index < (nodesRaw?.length ?? 0); index += 1) {
    const raw = nodesRaw?.[index]
    const nodePath = `nodes[${index}]`

    if (!isRecord(raw)) {
      pushIssue(issues, 'node_not_object', nodePath, 'Must be an object')
      continue
    }

    const id = raw.id
    if (!validateId(issues, `${nodePath}.id`, id)) {
      continue
    }

    if (nodeIds.has(id)) {
      pushIssue(issues, 'duplicate_node_id', `${nodePath}.id`, `Duplicate node id: ${id}`)
    } else {
      nodeIds.add(id)
    }

    const nodeCategoryValue = raw.nodeCategory
    if (
      typeof nodeCategoryValue !== 'string' ||
      !NODE_CATEGORIES.has(nodeCategoryValue as SkillGraphNodeCategory)
    ) {
      pushIssue(
        issues,
        'invalid_node_category',
        `${nodePath}.nodeCategory`,
        `Must be one of: ${Array.from(NODE_CATEGORIES).join(', ')}`
      )
    }

    const label = readOptionalString(raw, 'label')
    if (!label || label.trim().length === 0) {
      pushIssue(issues, 'missing_label', `${nodePath}.label`, 'Must be a non-empty string')
    }

    if ('start' in raw && raw.start !== undefined && typeof raw.start !== 'boolean') {
      pushIssue(issues, 'invalid_start', `${nodePath}.start`, 'Must be boolean if present')
    }

    if ('order' in raw && raw.order !== undefined) {
      const value = raw.order
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        pushIssue(issues, 'invalid_order', `${nodePath}.order`, 'Must be a finite number if present')
      }
    }
  }

  const incomingRequiresByNodeId = new Map<string, number>()

  for (let index = 0; index < (edgesRaw?.length ?? 0); index += 1) {
    const raw = edgesRaw?.[index]
    const edgePath = `edges[${index}]`

    if (!isRecord(raw)) {
      pushIssue(issues, 'edge_not_object', edgePath, 'Must be an object')
      continue
    }

    const edgeType = readOptionalString(raw, 'edgeType')
    if (!edgeType || !EDGE_TYPES.has(edgeType as SkillGraphEdgeType)) {
      pushIssue(
        issues,
        'invalid_edge_type',
        `${edgePath}.edgeType`,
        `Must be one of: ${Array.from(EDGE_TYPES).join(', ')}`
      )
    }

    let sourceId: string | null = null
    let targetId: string | null = null

    if (!('source' in raw)) {
      pushIssue(issues, 'missing_edge_source', `${edgePath}.source`, 'Required')
    } else {
      const sourceValue = raw.source
      if (validateId(issues, `${edgePath}.source`, sourceValue)) {
        sourceId = sourceValue
        if (!nodeIds.has(sourceId)) {
          pushIssue(issues, 'unknown_node_ref', `${edgePath}.source`, `Unknown node id: ${sourceId}`)
        }
      }
    }

    if (!('target' in raw)) {
      pushIssue(issues, 'missing_edge_target', `${edgePath}.target`, 'Required')
    } else {
      const targetValue = raw.target
      if (validateId(issues, `${edgePath}.target`, targetValue)) {
        targetId = targetValue
        if (!nodeIds.has(targetId)) {
          pushIssue(issues, 'unknown_node_ref', `${edgePath}.target`, `Unknown node id: ${targetId}`)
        }
      }
    }

    if (sourceId && targetId && sourceId === targetId) {
      pushIssue(issues, 'self_edge', edgePath, 'Self-edge is not allowed (source === target)')
    }

    if (edgeType === 'requires' && targetId) {
      incomingRequiresByNodeId.set(targetId, (incomingRequiresByNodeId.get(targetId) ?? 0) + 1)
    }
  }

  for (let index = 0; index < (nodesRaw?.length ?? 0); index += 1) {
    const raw = nodesRaw?.[index]
    if (!isRecord(raw)) continue

    const id = raw.id
    if (typeof id !== 'string' || !nodeIds.has(id)) continue

    const start = readOptionalBoolean(raw, 'start') ?? false
    if (start && (incomingRequiresByNodeId.get(id) ?? 0) > 0) {
      pushIssue(
        issues,
        'start_incoming_requires',
        `nodes[${index}].start`,
        'start:true cannot have incoming requires edges'
      )
    }
  }

  return issues
}

export function parseSkillGraphV1(input: unknown): SkillGraphV1 {
  const issues = validateSkillGraphV1(input)
  if (issues.length > 0) {
    throw new SkillGraphSchemaError(issues)
  }

  const raw = input as Record<string, unknown>
  const meta = readOptionalRecord(raw, 'meta') ?? undefined

  const graphId = readOptionalString(raw, 'graphId') ?? (meta ? readOptionalString(meta, 'graphId') : null)
  const title = readOptionalString(raw, 'title') ?? (meta ? readOptionalString(meta, 'title') : null)

  const nodesRaw = readOptionalArray(raw, 'nodes') ?? []
  const edgesRaw = readOptionalArray(raw, 'edges') ?? []

  return {
    schemaVersion: SCHEMA_VERSION,
    graphId: graphId as string,
    title: title as string,
    nodes: nodesRaw as SkillGraphNodeV1[],
    edges: edgesRaw as SkillGraphEdgeV1[],
    meta
  }
}

export type SkillGraphParseResult =
  | { ok: true; value: SkillGraphV1 }
  | { ok: false; error: { message: string; issues: SkillGraphIssue[] } }

export function parseSkillGraphV1Safe(input: unknown): SkillGraphParseResult {
  try {
    return { ok: true, value: parseSkillGraphV1(input) }
  } catch (error) {
    if (error instanceof SkillGraphSchemaError) {
      return { ok: false, error: { message: error.message, issues: error.issues } }
    }
    return { ok: false, error: { message: error instanceof Error ? error.message : String(error), issues: [] } }
  }
}

export type SkillGraphValidationError = {
  code: SkillGraphIssueCode
  message: string
  nodeId?: string
}

export type SkillGraphValidationResult =
  | { ok: true; value: SkillGraphV1 }
  | { ok: false; errors: SkillGraphValidationError[] }

function tryReadNodeIdAtIndex(input: unknown, index: number): string | null {
  if (!isRecord(input)) return null
  const nodesRaw = readOptionalArray(input, 'nodes')
  if (!nodesRaw) return null
  const nodeRaw = nodesRaw[index]
  if (!isRecord(nodeRaw)) return null
  const id = nodeRaw.id
  return typeof id === 'string' ? id : null
}

function extractNodeIdForIssue(input: unknown, issue: SkillGraphIssue): string | undefined {
  if (issue.code === 'duplicate_node_id' || issue.code === 'unknown_node_ref') {
    const match = issue.message.match(/: (.+)$/)
    if (match?.[1]) return match[1]
  }

  const nodeIndexMatch = issue.path.match(/^nodes\[(\d+)\]/)
  if (nodeIndexMatch) {
    const index = Number(nodeIndexMatch[1])
    if (Number.isFinite(index)) {
      const id = tryReadNodeIdAtIndex(input, index)
      if (id) return id
    }
  }

  return undefined
}

export function validateSkillGraphV1Basic(input: unknown): SkillGraphValidationResult {
  const issues = validateSkillGraphV1(input)
  if (issues.length === 0) {
    return { ok: true, value: parseSkillGraphV1(input) }
  }

  return {
    ok: false,
    errors: issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      nodeId: extractNodeIdForIssue(input, issue)
    }))
  }
}
