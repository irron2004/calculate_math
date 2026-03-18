export type ProposedGraphNodeOrigin = 'manual' | 'research'

export type ProposedGraphNodeType = 'textbookUnit' | 'unit' | 'skill' | 'problem'

export const PROPOSED_GRAPH_NODE_TYPES: ProposedGraphNodeType[] = ['textbookUnit', 'unit', 'skill', 'problem']

const PROPOSED_GRAPH_NODE_TYPE_SET = new Set<ProposedGraphNodeType>(PROPOSED_GRAPH_NODE_TYPES)

export function isProposedGraphNodeType(value: unknown): value is ProposedGraphNodeType {
  return typeof value === 'string' && PROPOSED_GRAPH_NODE_TYPE_SET.has(value as ProposedGraphNodeType)
}

export function normalizeProposedGraphNodeType(value: unknown): ProposedGraphNodeType {
  return isProposedGraphNodeType(value) ? value : 'skill'
}

export type ProposedGraphNode = {
  id: string
  nodeType: ProposedGraphNodeType
  label: string
  proposed: true
  origin: ProposedGraphNodeOrigin
  note?: string
  reason?: string
}

export type ProposedTextbookUnitNode = ProposedGraphNode
