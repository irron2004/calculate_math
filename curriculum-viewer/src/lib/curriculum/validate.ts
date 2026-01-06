import type { CurriculumNode, CurriculumNodeType } from './types'

export type CurriculumIssueCode =
  | 'duplicate_id'
  | 'missing_parent'
  | 'missing_child'
  | 'parent_missing_child'
  | 'child_wrong_parent'
  | 'type_hierarchy'
  | 'orphan'
  | 'cycle'

export type CurriculumIssueSeverity = 'error' | 'warning'

export type CurriculumIssue = {
  code: CurriculumIssueCode
  severity: CurriculumIssueSeverity
  message: string
  nodeId?: string
  relatedId?: string
}

type TypeHierarchyRule = Record<CurriculumNodeType, CurriculumNodeType | null>

const expectedParentTypeByType: TypeHierarchyRule = {
  subject: null,
  grade: 'subject',
  domain: 'grade',
  standard: 'domain'
}

const expectedChildTypeByType: TypeHierarchyRule = {
  subject: 'grade',
  grade: 'domain',
  domain: 'standard',
  standard: null
}

function formatNodeRef(node: Pick<CurriculumNode, 'id' | 'type'>): string {
  return `${node.id} (${node.type})`
}

function pushIssue(issues: CurriculumIssue[], issue: CurriculumIssue): void {
  issues.push(issue)
}

export function validateCurriculum(nodes: ReadonlyArray<CurriculumNode>): CurriculumIssue[] {
  const issues: CurriculumIssue[] = []

  const nodeById = new Map<string, CurriculumNode>()

  for (const node of nodes) {
    if (nodeById.has(node.id)) {
      pushIssue(issues, {
        code: 'duplicate_id',
        severity: 'error',
        nodeId: node.id,
        message: `Duplicate id: ${node.id}`
      })
      continue
    }

    nodeById.set(node.id, node)
  }

  for (const node of nodeById.values()) {
    const expectedParentType = expectedParentTypeByType[node.type]

    if (expectedParentType === null) {
      if (typeof node.parent_id === 'string' && node.parent_id.trim().length > 0) {
        pushIssue(issues, {
          code: 'type_hierarchy',
          severity: 'error',
          nodeId: node.id,
          relatedId: node.parent_id,
          message: `Root node must not have parent_id: ${formatNodeRef(node)}`
        })
      }
    } else {
      if (typeof node.parent_id !== 'string' || node.parent_id.trim().length === 0) {
        pushIssue(issues, {
          code: 'missing_parent',
          severity: 'error',
          nodeId: node.id,
          message: `Missing parent_id: ${formatNodeRef(node)}`
        })
      } else {
        const parent = nodeById.get(node.parent_id)
        if (!parent) {
          pushIssue(issues, {
            code: 'missing_parent',
            severity: 'error',
            nodeId: node.id,
            relatedId: node.parent_id,
            message: `Missing parent node: ${formatNodeRef(node)} -> ${node.parent_id}`
          })
        } else {
          if (parent.type !== expectedParentType) {
            pushIssue(issues, {
              code: 'type_hierarchy',
              severity: 'error',
              nodeId: node.id,
              relatedId: parent.id,
              message: `Type hierarchy violation: parent of ${formatNodeRef(node)} must be ${expectedParentType}, got ${formatNodeRef(parent)}`
            })
          }

          if (!parent.children_ids.includes(node.id)) {
            pushIssue(issues, {
              code: 'parent_missing_child',
              severity: 'warning',
              nodeId: node.id,
              relatedId: parent.id,
              message: `Bidirectional mismatch: parent.children_ids missing child ${formatNodeRef(node)} (parent: ${formatNodeRef(parent)})`
            })
          }
        }
      }
    }

    const expectedChildType = expectedChildTypeByType[node.type]
    if (expectedChildType === null) {
      if (node.children_ids.length > 0) {
        pushIssue(issues, {
          code: 'type_hierarchy',
          severity: 'warning',
          nodeId: node.id,
          message: `Leaf node must not have children_ids entries: ${formatNodeRef(node)}`
        })
      }
      continue
    }

    for (const childId of node.children_ids) {
      const child = nodeById.get(childId)
      if (!child) {
        pushIssue(issues, {
          code: 'missing_child',
          severity: 'error',
          nodeId: node.id,
          relatedId: childId,
          message: `Missing child node: ${formatNodeRef(node)} -> ${childId}`
        })
        continue
      }

      if (child.type !== expectedChildType) {
        pushIssue(issues, {
          code: 'type_hierarchy',
          severity: 'error',
          nodeId: node.id,
          relatedId: child.id,
          message: `Type hierarchy violation: child of ${formatNodeRef(node)} must be ${expectedChildType}, got ${formatNodeRef(child)}`
        })
      }

      if (child.parent_id !== node.id) {
        pushIssue(issues, {
          code: 'child_wrong_parent',
          severity: 'warning',
          nodeId: child.id,
          relatedId: node.id,
          message: `Bidirectional mismatch: child.parent_id must be ${node.id} (child: ${formatNodeRef(child)})`
        })
      }
    }
  }

  // Orphan detection: reachable from roots
  const roots = Array.from(nodeById.values()).filter((node) => {
    return node.type === 'subject' || typeof node.parent_id !== 'string'
  })

  const reachable = new Set<string>()
  const queue = roots.map((node) => node.id)
  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId || reachable.has(currentId)) continue

    reachable.add(currentId)
    const current = nodeById.get(currentId)
    if (!current) continue

    for (const childId of current.children_ids) {
      if (nodeById.has(childId) && !reachable.has(childId)) {
        queue.push(childId)
      }
    }
  }

  for (const node of nodeById.values()) {
    if (!reachable.has(node.id)) {
      pushIssue(issues, {
        code: 'orphan',
        severity: 'warning',
        nodeId: node.id,
        message: `Orphan node (unreachable from roots): ${formatNodeRef(node)}`
      })
    }
  }

  // Cycle detection via parent pointers (each node has at most one parent).
  const cycleReported = new Set<string>()
  for (const node of nodeById.values()) {
    if (cycleReported.has(node.id)) continue

    const path: string[] = []
    const seenIndex = new Map<string, number>()

    let cursor: CurriculumNode | undefined = node
    while (cursor) {
      const parentId = cursor.parent_id
      if (typeof parentId !== 'string') {
        break
      }

      if (seenIndex.has(cursor.id)) {
        const start = seenIndex.get(cursor.id) ?? 0
        const cycleNodeIds = path.slice(start)
        for (const id of cycleNodeIds) {
          cycleReported.add(id)
          pushIssue(issues, {
            code: 'cycle',
            severity: 'error',
            nodeId: id,
            message: `Cycle detected via parent chain: ${cycleNodeIds.join(' -> ')}`
          })
        }
        break
      }

      if (cycleReported.has(cursor.id)) {
        break
      }

      seenIndex.set(cursor.id, path.length)
      path.push(cursor.id)

      const parent = nodeById.get(parentId)
      if (!parent) {
        break
      }

      cursor = parent
    }
  }

  // Keep deterministic output: stable sort by (severity, code, nodeId, relatedId).
  const severityOrder = new Map<CurriculumIssueSeverity, number>([
    ['error', 0],
    ['warning', 1]
  ])

  return issues.slice().sort((a, b) => {
    const as = severityOrder.get(a.severity) ?? 9
    const bs = severityOrder.get(b.severity) ?? 9
    if (as !== bs) return as - bs
    if (a.code !== b.code) return a.code < b.code ? -1 : 1
    const aNode = a.nodeId ?? ''
    const bNode = b.nodeId ?? ''
    if (aNode !== bNode) return aNode < bNode ? -1 : 1
    const aRel = a.relatedId ?? ''
    const bRel = b.relatedId ?? ''
    if (aRel !== bRel) return aRel < bRel ? -1 : 1
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0
  })
}
