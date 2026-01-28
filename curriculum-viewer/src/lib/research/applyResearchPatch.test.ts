import { createPrereqEditState } from '../curriculum2022/prereqEdit'
import type { ProposedTextbookUnitNode } from '../curriculum2022/types'
import { applyResearchPatch } from './applyResearchPatch'

describe('applyResearchPatch', () => {
  it('adds missing nodes and prereq edges as research, without duplicates', () => {
    const proposedNodes: ProposedTextbookUnitNode[] = [
      { id: 'P1', nodeType: 'textbookUnit', label: 'Manual', proposed: true, origin: 'manual' }
    ]

    const prereq = createPrereqEditState({
      base: [{ source: 'A', target: 'B' }],
      research: []
    })

    const patch = {
      add_nodes: [{ id: 'P2', nodeType: 'textbookUnit', label: 'Research', proposed: true, reason: 'why' }],
      add_edges: [
        { source: 'A', target: 'P2', edgeType: 'prereq', confidence: 0.9, rationale: 'because' },
        { source: 'A', target: 'B', edgeType: 'prereq', confidence: 0.9 }
      ],
      remove_edges: []
    }

    const result = applyResearchPatch({
      state: { proposedNodes, prereq },
      baseNodeIds: ['A', 'B'],
      patch
    })

    expect(result.proposedNodes.map((n) => n.id)).toEqual(expect.arrayContaining(['P1', 'P2']))
    expect(result.proposedNodes.find((n) => n.id === 'P2')?.origin).toBe('research')

    // A->B already exists in base; should not be duplicated as research.
    expect(result.prereq.research).toEqual([{ source: 'A', target: 'P2' }])
  })

  it('skips edges that reference missing nodes', () => {
    const prereq = createPrereqEditState({ base: [], research: [] })
    const patch = {
      add_nodes: [],
      add_edges: [{ source: 'A', target: 'MISSING', edgeType: 'prereq' }],
      remove_edges: []
    }

    const result = applyResearchPatch({
      state: { proposedNodes: [], prereq },
      baseNodeIds: ['A'],
      patch
    })

    expect(result.prereq.research).toEqual([])
  })
})

