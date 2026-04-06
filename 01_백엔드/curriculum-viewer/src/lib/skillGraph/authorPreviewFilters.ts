import type { SkillGraphNodeCategory, SkillGraphNodeV1 } from './schema'

export type NodeFilterCategory = 'all' | SkillGraphNodeCategory

export function filterSkillGraphNodes(
  nodes: SkillGraphNodeV1[],
  params: { query: string; category: NodeFilterCategory }
): SkillGraphNodeV1[] {
  const normalizedQuery = params.query.trim().toLowerCase()
  return nodes.filter((node) => {
    if (params.category !== 'all' && node.nodeCategory !== params.category) return false
    if (!normalizedQuery) return true
    const label = `${node.label} ${node.id}`.toLowerCase()
    return label.includes(normalizedQuery)
  })
}
