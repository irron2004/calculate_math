import type { PrereqEditState, PrereqEdge } from '../curriculum2022/prereqEdit'
import { listCurrentPrereqEdges, prereqEdgeKey } from '../curriculum2022/prereqEdit'
import type { ProposedTextbookUnitNode } from '../curriculum2022/types'
import type { ResearchPatchEdgeV1, ResearchPatchNodeV1, ResearchPatchV1 } from './schema'

function uniqueEdges(edges: ResearchPatchEdgeV1[]): ResearchPatchEdgeV1[] {
  const seen = new Set<string>()
  const out: ResearchPatchEdgeV1[] = []
  for (const edge of edges) {
    const key = `${edge.edgeType}\u0000${edge.source}\u0000${edge.target}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(edge)
  }
  return out
}

function uniqueNodes(nodes: ResearchPatchNodeV1[]): ResearchPatchNodeV1[] {
  const seen = new Set<string>()
  const out: ResearchPatchNodeV1[] = []
  for (const node of nodes) {
    const id = node.id.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(node)
  }
  return out
}

function sortNodes(nodes: ResearchPatchNodeV1[]): ResearchPatchNodeV1[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id))
}

function sortEdges(edges: ResearchPatchEdgeV1[]): ResearchPatchEdgeV1[] {
  return [...edges].sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source)
    if (a.target !== b.target) return a.target.localeCompare(b.target)
    return a.edgeType.localeCompare(b.edgeType)
  })
}

function normalizeRemovedEdges(edges: PrereqEdge[]): ResearchPatchEdgeV1[] {
  const out: ResearchPatchEdgeV1[] = []
  const seen = new Set<string>()
  for (const edge of edges) {
    const source = edge.source.trim()
    const target = edge.target.trim()
    if (!source || !target) continue
    const key = `${source}\u0000${target}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ source, target, edgeType: 'prereq' })
  }
  return out
}

export function buildPatchExport(params: {
  baseNodeIds: Iterable<string>
  editState: PrereqEditState
  proposedNodes: ProposedTextbookUnitNode[]
}): ResearchPatchV1 {
  const baseNodeIdSet = new Set(params.baseNodeIds)
  const basePrereqKeys = new Set(params.editState.base.map(prereqEdgeKey))

  const proposedNodes: ResearchPatchNodeV1[] = params.proposedNodes
    .filter((node) => !baseNodeIdSet.has(node.id))
    .map((node) => {
      const reason = node.reason ?? node.note
      return {
        id: node.id,
        nodeType: 'textbookUnit',
        label: node.label,
        proposed: true,
        ...(reason ? { reason } : {})
      }
    })

  const currentPrereqEdges = listCurrentPrereqEdges(params.editState)
  const currentNodeIds = new Set<string>(baseNodeIdSet)
  for (const node of params.proposedNodes) {
    currentNodeIds.add(node.id)
  }

  const addEdges: ResearchPatchEdgeV1[] = []
  for (const edge of currentPrereqEdges) {
    const key = prereqEdgeKey(edge)
    if (basePrereqKeys.has(key)) continue
    if (!currentNodeIds.has(edge.source) || !currentNodeIds.has(edge.target)) continue
    addEdges.push({ source: edge.source, target: edge.target, edgeType: 'prereq' })
  }

  const removeEdges = normalizeRemovedEdges(params.editState.removed)

  return {
    schemaVersion: 'research-patch-v1',
    add_nodes: sortNodes(uniqueNodes(proposedNodes)),
    add_edges: sortEdges(uniqueEdges(addEdges)),
    remove_edges: sortEdges(uniqueEdges(removeEdges))
  }
}
