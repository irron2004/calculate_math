import { describe, expect, it } from 'vitest'
import type { SkillGraphV1 } from './schema'
import { getConnectableTargetIds, getStartableNodeIds } from './authorPreviewRules'

function baseGraph(): SkillGraphV1 {
  return {
    schemaVersion: 'skill-graph-v1',
    graphId: 'g1',
    title: 't',
    nodes: [
      { id: 'A', nodeCategory: 'core', label: 'A', start: true },
      { id: 'B', nodeCategory: 'core', label: 'B' },
      { id: 'C', nodeCategory: 'core', label: 'C' },
      { id: 'D', nodeCategory: 'core', label: 'D' }
    ],
    edges: []
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

describe('getStartableNodeIds', () => {
  it('returns start:true nodes OR nodes with zero incoming requires', () => {
    const graph = baseGraph()
    graph.nodes = [
      { id: 'A', nodeCategory: 'core', label: 'A', start: true },
      { id: 'B', nodeCategory: 'core', label: 'B' },
      { id: 'C', nodeCategory: 'core', label: 'C' }
    ]
    graph.edges = [{ edgeType: 'requires', source: 'A', target: 'C' }]

    expect(getStartableNodeIds(graph)).toEqual(['A', 'B'])
  })

  it('does not mutate input graph', () => {
    const graph = deepFreeze(baseGraph())
    expect(() => getStartableNodeIds(graph)).not.toThrow()
  })
})

describe('getConnectableTargetIds', () => {
  it('excludes self-edge candidates', () => {
    const graph = baseGraph()
    graph.nodes = [
      { id: 'A', nodeCategory: 'core', label: 'A' },
      { id: 'B', nodeCategory: 'core', label: 'B' }
    ]

    expect(getConnectableTargetIds({ graph, sourceId: 'A', edgeType: 'requires' })).toEqual(['B'])
  })

  it('excludes duplicate edges for the same edgeType/source/target', () => {
    const graph = baseGraph()
    graph.nodes = [
      { id: 'A', nodeCategory: 'core', label: 'A' },
      { id: 'B', nodeCategory: 'core', label: 'B' },
      { id: 'C', nodeCategory: 'core', label: 'C' }
    ]
    graph.edges = [{ edgeType: 'requires', source: 'A', target: 'B' }]

    expect(getConnectableTargetIds({ graph, sourceId: 'A', edgeType: 'requires' })).toEqual(['C'])
  })

  it('excludes start:true targets for requires edges', () => {
    const graph = baseGraph()
    graph.nodes = [
      { id: 'A', nodeCategory: 'core', label: 'A', start: true },
      { id: 'B', nodeCategory: 'core', label: 'B' },
      { id: 'C', nodeCategory: 'core', label: 'C' }
    ]

    expect(getConnectableTargetIds({ graph, sourceId: 'B', edgeType: 'requires' })).toEqual(['C'])
  })

  it('excludes targets that would introduce a requires cycle', () => {
    const graph = baseGraph()
    graph.nodes = [
      { id: 'A', nodeCategory: 'core', label: 'A' },
      { id: 'B', nodeCategory: 'core', label: 'B' },
      { id: 'C', nodeCategory: 'core', label: 'C' },
      { id: 'D', nodeCategory: 'core', label: 'D' }
    ]
    graph.edges = [
      { edgeType: 'requires', source: 'A', target: 'B' },
      { edgeType: 'requires', source: 'B', target: 'C' }
    ]

    expect(getConnectableTargetIds({ graph, sourceId: 'C', edgeType: 'requires' })).toEqual(['D'])
  })

  it('does not mutate input graph', () => {
    const graph = deepFreeze(baseGraph())
    expect(() => getConnectableTargetIds({ graph, sourceId: 'A', edgeType: 'requires' })).not.toThrow()
  })
})

