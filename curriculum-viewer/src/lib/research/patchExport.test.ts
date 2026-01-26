import { describe, expect, it } from 'vitest'
import { addPrereqEdge, createPrereqEditState, removePrereqEdge } from '../curriculum2022/prereqEdit'
import type { ProposedTextbookUnitNode } from '../curriculum2022/types'
import { buildPatchExport } from './patchExport'

describe('buildPatchExport', () => {
  it('builds a stable patch export diff', () => {
    const baseEdges = [{ source: 'A', target: 'B' }]
    const state = createPrereqEditState({
      base: baseEdges,
      research: [{ source: 'B', target: 'C' }]
    })

    const withAdded = addPrereqEdge(state, { source: 'C', target: 'A' })
    const withRemoved = removePrereqEdge(withAdded, { source: 'A', target: 'B' })

    const proposedNodes: ProposedTextbookUnitNode[] = [
      { id: 'P_TU_beta', nodeType: 'textbookUnit', label: 'Beta', proposed: true, origin: 'manual' },
      { id: 'P_TU_alpha', nodeType: 'textbookUnit', label: 'Alpha', proposed: true, origin: 'manual', note: 'note' },
      { id: 'A', nodeType: 'textbookUnit', label: 'Base', proposed: true, origin: 'manual' }
    ]

    const patch = buildPatchExport({
      baseNodeIds: ['A', 'B', 'C'],
      editState: withRemoved,
      proposedNodes
    })

    expect(patch).toMatchInlineSnapshot(`
      {
        "add_edges": [
          {
            "edgeType": "prereq",
            "source": "B",
            "target": "C",
          },
          {
            "edgeType": "prereq",
            "source": "C",
            "target": "A",
          },
        ],
        "add_nodes": [
          {
            "id": "P_TU_alpha",
            "label": "Alpha",
            "nodeType": "textbookUnit",
            "proposed": true,
            "reason": "note",
          },
          {
            "id": "P_TU_beta",
            "label": "Beta",
            "nodeType": "textbookUnit",
            "proposed": true,
          },
        ],
        "remove_edges": [
          {
            "edgeType": "prereq",
            "source": "A",
            "target": "B",
          },
        ],
        "schemaVersion": "research-patch-v1",
      }
    `)
  })
})
