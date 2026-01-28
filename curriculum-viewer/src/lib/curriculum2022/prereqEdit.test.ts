import { addPrereqEdge, createPrereqEditState, detectPrereqCycle, listCurrentPrereqEdges, removePrereqEdge } from './prereqEdit'

describe('prereqEdit', () => {
  it('adds a prereq edge once and records it as manual', () => {
    const state = createPrereqEditState({ base: [], research: [] })
    const s1 = addPrereqEdge(state, { source: 'A', target: 'B' })
    const s2 = addPrereqEdge(s1, { source: 'A', target: 'B' })

    expect(s2.added).toHaveLength(1)
    expect(listCurrentPrereqEdges(s2)).toEqual([{ source: 'A', target: 'B', origin: 'manual' }])
  })

  it('removes base edges by moving them into removed, and restores when re-added', () => {
    const state = createPrereqEditState({ base: [{ source: 'A', target: 'B' }], research: [] })
    const removed = removePrereqEdge(state, { source: 'A', target: 'B' })

    expect(removed.removed).toHaveLength(1)
    expect(listCurrentPrereqEdges(removed)).toHaveLength(0)

    const restored = addPrereqEdge(removed, { source: 'A', target: 'B' })
    expect(restored.removed).toHaveLength(0)
    expect(listCurrentPrereqEdges(restored)).toEqual([{ source: 'A', target: 'B', origin: 'base' }])
  })

  it('removes manual edges by deleting them from added', () => {
    const state = createPrereqEditState({ base: [], research: [] })
    const added = addPrereqEdge(state, { source: 'A', target: 'B' })
    const removed = removePrereqEdge(added, { source: 'A', target: 'B' })

    expect(removed.added).toHaveLength(0)
    expect(listCurrentPrereqEdges(removed)).toHaveLength(0)
  })

  it('suppresses research edges without adding them to removed, and can unsuppress on add', () => {
    const state = createPrereqEditState({ base: [], research: [{ source: 'A', target: 'B' }] })
    const suppressed = removePrereqEdge(state, { source: 'A', target: 'B' })

    expect(suppressed.suppressedResearch).toHaveLength(1)
    expect(listCurrentPrereqEdges(suppressed)).toHaveLength(0)

    const restored = addPrereqEdge(suppressed, { source: 'A', target: 'B' })
    expect(restored.suppressedResearch).toHaveLength(0)
    expect(listCurrentPrereqEdges(restored)).toEqual([{ source: 'A', target: 'B', origin: 'research' }])
  })

  it('detects cycles in prereq edges', () => {
    const cycle = detectPrereqCycle([
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
      { source: 'C', target: 'A' }
    ])
    expect(cycle.hasCycle).toBe(true)
    expect(cycle.path).toEqual(expect.arrayContaining(['A', 'B', 'C']))

    const acyclic = detectPrereqCycle([
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' }
    ])
    expect(acyclic.hasCycle).toBe(false)
    expect(acyclic.path).toBeNull()
  })
})

