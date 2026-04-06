const expectedParentTypeByType = {
  subject: null,
  grade: 'subject',
  domain: 'grade',
  standard: 'domain'
}

const expectedChildTypeByType = {
  subject: 'grade',
  grade: 'domain',
  domain: 'standard',
  standard: null
}

function formatNodeRef(node) {
  return `${node.id} (${node.type})`
}

function pushIssue(issues, issue) {
  issues.push(issue)
}

function getChildrenIds(node) {
  if (!node) return []
  return Array.isArray(node.children_ids) ? node.children_ids : []
}

function getParentId(node) {
  if (!node || typeof node.parent_id !== 'string') return undefined
  const trimmed = node.parent_id.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * @param {ReadonlyArray<{code: string, severity: string, message: string, nodeId?: string, relatedId?: string}>} issues
 */
export function sortCurriculumIssues(issues) {
  const severityOrder = { error: 0, warning: 1 }

  return Array.from(issues).sort((a, b) => {
    const as = severityOrder[a.severity] ?? 9
    const bs = severityOrder[b.severity] ?? 9
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

/**
 * @param {ReadonlyArray<{id: string, type: string, title?: string, parent_id?: string, children_ids: string[]}>} nodes
 * @returns {Array<{code: string, severity: string, message: string, nodeId?: string, relatedId?: string}>}
 */
export function validateCurriculum(nodes) {
  const issues = []

  const nodeById = new Map()

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
      const parentId = getParentId(node)
      if (parentId) {
        pushIssue(issues, {
          code: 'type_hierarchy',
          severity: 'error',
          nodeId: node.id,
          relatedId: parentId,
          message: `Root node must not have parent_id: ${formatNodeRef(node)}`
        })
      }
    } else {
      const parentId = getParentId(node)
      if (!parentId) {
        pushIssue(issues, {
          code: 'missing_parent',
          severity: 'error',
          nodeId: node.id,
          message: `Missing parent_id: ${formatNodeRef(node)}`
        })
      } else {
        const parent = nodeById.get(parentId)
        if (!parent) {
          pushIssue(issues, {
            code: 'missing_parent',
            severity: 'error',
            nodeId: node.id,
            relatedId: parentId,
            message: `Missing parent node: ${formatNodeRef(node)} -> ${parentId}`
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

          const parentChildren = getChildrenIds(parent)
          if (!parentChildren.includes(node.id)) {
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
      const childrenIds = getChildrenIds(node)
      if (childrenIds.length > 0) {
        pushIssue(issues, {
          code: 'type_hierarchy',
          severity: 'warning',
          nodeId: node.id,
          message: `Leaf node must not have children_ids entries: ${formatNodeRef(node)}`
        })
      }
      continue
    }

    const childrenIds = getChildrenIds(node)
    for (const childId of childrenIds) {
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

  // Orphan detection: reachable from roots.
  const roots = Array.from(nodeById.values()).filter((node) => node.type === 'subject')

  const reachable = new Set()
  const queue = roots.map((node) => node.id)
  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId || reachable.has(currentId)) continue

    reachable.add(currentId)
    const current = nodeById.get(currentId)
    if (!current) continue

    for (const childId of getChildrenIds(current)) {
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
  const cycleReported = new Set()
  for (const node of nodeById.values()) {
    if (cycleReported.has(node.id)) continue

    const path = []
    const seenIndex = new Map()

    let cursor = node
    while (cursor) {
      const parentId = getParentId(cursor)
      if (!parentId) {
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

  return sortCurriculumIssues(issues)
}
