import { validateCurriculum } from './validateCore.js'

const NODE_TYPES = new Set(['subject', 'grade', 'domain', 'standard'])

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * @param {Array<{code: string, message: string, nodeId?: string, field?: string}>} issues
 * @param {{code: string, message: string, nodeId?: string, field?: string}} issue
 */
function pushSchemaIssue(issues, issue) {
  issues.push(issue)
}

/**
 * @param {unknown} payload
 * @returns {{
 *  data: import('./types').CurriculumData | null,
 *  issues: import('./validateTypes').CurriculumIssue[],
 *  schemaIssues: Array<{code: string, message: string, nodeId?: string, field?: string}>
 * }}
 */
export function validateCurriculumData(payload) {
  const schemaIssues = []

  if (!isRecord(payload)) {
    pushSchemaIssue(schemaIssues, {
      code: 'invalid_root',
      message: 'Top-level JSON must be an object: { meta, nodes }'
    })
    return { data: null, issues: [], schemaIssues }
  }

  const nodes = payload.nodes
  if (!Array.isArray(nodes)) {
    pushSchemaIssue(schemaIssues, {
      code: 'invalid_nodes',
      message: 'Top-level "nodes" must be an array'
    })
    return { data: null, issues: [], schemaIssues }
  }

  /** @type {import('./types').CurriculumNode[]} */
  const normalizedNodes = []

  for (const node of nodes) {
    if (!isRecord(node)) {
      pushSchemaIssue(schemaIssues, {
        code: 'invalid_node',
        message: 'Each node must be an object'
      })
      continue
    }

    const nodeId = hasNonEmptyString(node.id) ? node.id : undefined

    if (!hasNonEmptyString(node.id)) {
      pushSchemaIssue(schemaIssues, {
        code: 'invalid_field',
        field: 'id',
        message: 'Node.id must be a non-empty string'
      })
      continue
    }

    if (typeof node.type !== 'string' || !NODE_TYPES.has(node.type)) {
      pushSchemaIssue(schemaIssues, {
        code: 'invalid_field',
        field: 'type',
        nodeId,
        message: `Invalid type for ${nodeId}: ${String(node.type)}`
      })
      continue
    }

    if (!hasNonEmptyString(node.title)) {
      pushSchemaIssue(schemaIssues, {
        code: 'invalid_field',
        field: 'title',
        nodeId,
        message: `Missing/invalid title for ${nodeId} (${node.type})`
      })
      continue
    }

    if (!Array.isArray(node.children_ids) || node.children_ids.some((id) => typeof id !== 'string')) {
      pushSchemaIssue(schemaIssues, {
        code: 'invalid_field',
        field: 'children_ids',
        nodeId,
        message: `children_ids must be string[] for ${nodeId} (${node.type})`
      })
      continue
    }

    if (typeof node.parent_id !== 'undefined' && !hasNonEmptyString(node.parent_id)) {
      pushSchemaIssue(schemaIssues, {
        code: 'invalid_field',
        field: 'parent_id',
        nodeId,
        message: `parent_id must be a non-empty string if present for ${nodeId} (${node.type})`
      })
      continue
    }

    normalizedNodes.push(node)
  }

  if (schemaIssues.length > 0) {
    return { data: null, issues: [], schemaIssues }
  }

  const meta = isRecord(payload.meta) ? payload.meta : undefined
  const data = {
    meta,
    nodes: normalizedNodes
  }

  const issues = validateCurriculum(normalizedNodes)

  return { data, issues, schemaIssues: [] }
}

/**
 * @param {{code: string, message: string, nodeId?: string, field?: string}} issue
 */
export function formatSchemaIssue(issue) {
  const nodePart = issue.nodeId ? ` nodeId=${issue.nodeId}` : ''
  const fieldPart = issue.field ? ` field=${issue.field}` : ''
  return `${issue.code}${nodePart}${fieldPart} - ${issue.message}`
}
