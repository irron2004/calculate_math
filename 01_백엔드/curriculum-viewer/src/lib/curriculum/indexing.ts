import type { CurriculumNode } from './types'

export type CurriculumIndex = {
  nodeById: Map<string, CurriculumNode>
  parentById: Map<string, CurriculumNode | null>
  childrenById: Map<string, CurriculumNode[]>
  rootNodes: CurriculumNode[]
}

function compareString(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function sortKey(node: CurriculumNode): readonly (string | number)[] {
  switch (node.type) {
    case 'subject':
      return [node.title, node.id]
    case 'grade':
      return [typeof node.grade === 'number' ? node.grade : 999, node.id]
    case 'domain':
      return [node.domain_code ?? '', node.title, node.id]
    case 'standard':
      return [node.official_code ?? '', node.id]
    default:
      return [node.id]
  }
}

function compareNode(a: CurriculumNode, b: CurriculumNode): number {
  const aKey = sortKey(a)
  const bKey = sortKey(b)
  for (let i = 0; i < Math.min(aKey.length, bKey.length); i += 1) {
    const av = aKey[i]
    const bv = bKey[i]
    if (typeof av === 'number' && typeof bv === 'number') {
      if (av !== bv) return av - bv
      continue
    }
    const as = String(av)
    const bs = String(bv)
    const cmp = compareString(as, bs)
    if (cmp !== 0) return cmp
  }
  return aKey.length - bKey.length
}

export function buildCurriculumIndex(nodes: ReadonlyArray<CurriculumNode>): CurriculumIndex {
  const nodeById = new Map<string, CurriculumNode>()

  for (const node of nodes) {
    nodeById.set(node.id, node)
  }

  const parentById = new Map<string, CurriculumNode | null>()
  for (const node of nodes) {
    if (typeof node.parent_id !== 'string') {
      parentById.set(node.id, null)
      continue
    }

    parentById.set(node.id, nodeById.get(node.parent_id) ?? null)
  }

  const childrenById = new Map<string, CurriculumNode[]>()
  for (const node of nodes) {
    const children: CurriculumNode[] = []
    for (const childId of node.children_ids) {
      const child = nodeById.get(childId)
      if (child) {
        children.push(child)
      }
    }
    children.sort(compareNode)
    childrenById.set(node.id, children)
  }

  const rootNodes = nodes
    .filter((node) => node.type === 'subject' || typeof node.parent_id !== 'string')
    .slice()
    .sort(compareNode)

  return {
    nodeById,
    parentById,
    childrenById,
    rootNodes
  }
}
