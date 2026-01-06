import type { CurriculumNode } from './types'

export type ContainsEdgeRef = {
  source: string
  target: string
}

export function getGraphVisibleNodes(
  nodes: ReadonlyArray<CurriculumNode>
): CurriculumNode[] {
  return nodes.filter((node) => node.type !== 'grade')
}

export function buildContainsEdgeRefsSkippingGradeNodes(
  nodes: ReadonlyArray<CurriculumNode>,
  nodeById: ReadonlyMap<string, CurriculumNode>
): ContainsEdgeRef[] {
  const edges: ContainsEdgeRef[] = []
  const seen = new Set<string>()

  const pushEdge = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    const key = `${sourceId}->${targetId}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ source: sourceId, target: targetId })
  }

  for (const node of nodes) {
    if (node.type === 'grade') {
      continue
    }

    for (const childId of node.children_ids) {
      const child = nodeById.get(childId)
      if (!child) {
        continue
      }

      if (child.type === 'grade') {
        for (const grandChildId of child.children_ids) {
          const grandChild = nodeById.get(grandChildId)
          if (!grandChild || grandChild.type === 'grade') {
            continue
          }

          pushEdge(node.id, grandChildId)
        }
        continue
      }

      pushEdge(node.id, childId)
    }
  }

  return edges
}

