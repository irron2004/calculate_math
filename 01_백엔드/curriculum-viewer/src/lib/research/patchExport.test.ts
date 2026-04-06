import { describe, expect, it } from 'vitest'
import { addPrereqEdge, createPrereqEditState, removePrereqEdge } from '../curriculum2022/prereqEdit'
import type { ProposedGraphNode } from '../curriculum2022/types'
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

    const proposedNodes: ProposedGraphNode[] = [
      { id: 'P_S_beta', nodeType: 'skill', label: 'Beta', proposed: true, origin: 'manual' },
      { id: 'P_U_alpha', nodeType: 'unit', label: 'Alpha', proposed: true, origin: 'manual', note: 'note' },
      { id: 'A', nodeType: 'skill', label: 'Base', proposed: true, origin: 'manual' }
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
            "id": "P_S_beta",
            "label": "Beta",
            "nodeType": "skill",
            "proposed": true,
          },
          {
            "id": "P_U_alpha",
            "label": "Alpha",
            "nodeType": "unit",
            "proposed": true,
            "reason": "note",
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
