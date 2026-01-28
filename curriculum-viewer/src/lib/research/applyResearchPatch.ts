import type { PrereqEditState } from '../curriculum2022/prereqEdit'
import { prereqEdgeKey } from '../curriculum2022/prereqEdit'
import type { ProposedTextbookUnitNode } from '../curriculum2022/types'
import type { ResearchPatchV1 } from './schema'

export type ResearchGraphState = {
  proposedNodes: ProposedTextbookUnitNode[]
  prereq: PrereqEditState
}

function uniqueById(nodes: ProposedTextbookUnitNode[]): ProposedTextbookUnitNode[] {
  const seen = new Set<string>()
  const out: ProposedTextbookUnitNode[] = []
  for (const node of nodes) {
    if (seen.has(node.id)) continue
    seen.add(node.id)
    out.push(node)
  }
  return out
}

export function researchEdgeKey(edge: { edgeType: string; source: string; target: string }): string {
  return `${edge.edgeType}:${edge.source}->${edge.target}`
}

export function applyResearchPatch(params: {
  state: ResearchGraphState
  baseNodeIds: Iterable<string>
  patch: ResearchPatchV1
}): ResearchGraphState {
  const baseNodeIdSet = new Set(params.baseNodeIds)
  const existingNodeIds = new Set<string>(baseNodeIdSet)

  for (const node of params.state.proposedNodes) {
    existingNodeIds.add(node.id)
  }

  const nextProposedNodes: ProposedTextbookUnitNode[] = [...params.state.proposedNodes]

  for (const node of params.patch.add_nodes) {
    if (node.nodeType !== 'textbookUnit') continue
    if (existingNodeIds.has(node.id)) continue

    existingNodeIds.add(node.id)
    nextProposedNodes.push({
      id: node.id,
      nodeType: 'textbookUnit',
      label: node.label,
      proposed: true,
      origin: 'research',
      reason: node.reason
    })
  }

  const prereqBaseKeys = new Set(params.state.prereq.base.map(prereqEdgeKey))
  const prereqAddedKeys = new Set(params.state.prereq.added.map(prereqEdgeKey))
  const prereqResearchKeys = new Set(params.state.prereq.research.map(prereqEdgeKey))

  const nextResearchPrereq = [...params.state.prereq.research]

  for (const edge of params.patch.add_edges) {
    if (edge.edgeType !== 'prereq') continue

    if (!existingNodeIds.has(edge.source) || !existingNodeIds.has(edge.target)) {
      continue
    }

    const key = prereqEdgeKey({ source: edge.source, target: edge.target })
    if (prereqBaseKeys.has(key) || prereqAddedKeys.has(key) || prereqResearchKeys.has(key)) {
      continue
    }

    prereqResearchKeys.add(key)
    nextResearchPrereq.push({ source: edge.source, target: edge.target })
  }

  return {
    proposedNodes: uniqueById(nextProposedNodes),
    prereq: { ...params.state.prereq, research: nextResearchPrereq }
  }
}

