import type { SkillGraphV1 } from './schema'
import {
  computeDagreLayoutPositions,
  ensureGraphLayoutPositions,
  readGraphLayoutPositions,
  resetGraphLayout,
  selectGraphLayoutPositions,
  updateGraphLayoutPosition
} from './layout'

function baseGraph(): SkillGraphV1 {
  return {
    schemaVersion: 'skill-graph-v1',
    graphId: 'g1',
    title: 'Graph',
    nodes: [
      { id: 'A', nodeCategory: 'core', label: 'A' },
      { id: 'B', nodeCategory: 'core', label: 'B' }
    ],
    edges: [{ edgeType: 'requires', source: 'A', target: 'B' }]
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  Object.freeze(value)
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}

describe('skill graph layout helpers', () => {
  it('uses stored positions when they exist for all nodes', () => {
    const graph = baseGraph()
    const positions = {
      A: { x: 10, y: 20 },
      B: { x: 30, y: 40 }
    }
    const withLayout: SkillGraphV1 = {
      ...graph,
      meta: { layout: { positions } }
    }

    expect(selectGraphLayoutPositions(withLayout)).toEqual(positions)

    const ensured = ensureGraphLayoutPositions(withLayout)
    expect(ensured.changed).toBe(false)
    expect(ensured.positions).toEqual(positions)
  })

  it('falls back to dagre when no positions exist', () => {
    const graph = baseGraph()
    const positions = selectGraphLayoutPositions(graph)

    expect(Object.keys(positions).sort()).toEqual(['A', 'B'])
    for (const pos of Object.values(positions)) {
      expect(typeof pos.x).toBe('number')
      expect(typeof pos.y).toBe('number')
    }
  })

  it('computes dagre positions for all nodes', () => {
    const graph = baseGraph()
    const positions = computeDagreLayoutPositions(graph)
    expect(Object.keys(positions).sort()).toEqual(['A', 'B'])
  })

  it('updates a single node position without mutating input graph', () => {
    const graph = deepFreeze(baseGraph())
    const next = updateGraphLayoutPosition(graph, 'A', { x: 100, y: 200 })

    const positions = readGraphLayoutPositions(next)
    expect(positions.A).toEqual({ x: 100, y: 200 })
  })

  it('resets layout using dagre positions', () => {
    const graph = baseGraph()
    const reset = resetGraphLayout(graph)
    const positions = readGraphLayoutPositions(reset)

    expect(Object.keys(positions).sort()).toEqual(['A', 'B'])
  })
})
