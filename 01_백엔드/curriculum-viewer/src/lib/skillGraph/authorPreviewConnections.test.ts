import { describe, expect, it } from 'vitest'
import type { SkillGraphV1 } from './schema'
import { getEdgeAdditionError, listConnectableTargets } from './authorPreviewConnections'

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

describe('listConnectableTargets', () => {
  it('returns candidate statuses for a source and edgeType', () => {
    const graph = baseGraph()
    graph.edges = [
      { edgeType: 'requires', source: 'A', target: 'B' },
      { edgeType: 'requires', source: 'B', target: 'C' }
    ]

    const result = listConnectableTargets({ graph, sourceId: 'B', edgeType: 'requires' })

    expect(result.map((item) => ({ id: item.node.id, connectable: item.isConnectable }))).toEqual([
      { id: 'A', connectable: false },
      { id: 'C', connectable: false },
      { id: 'D', connectable: true }
    ])

    expect(result.find((item) => item.node.id === 'A')?.reason).toBe(
      'start 노드에는 requires 연결을 추가할 수 없습니다.'
    )
    expect(result.find((item) => item.node.id === 'C')?.reason).toBe(
      '이미 동일한 연결이 존재합니다.'
    )
  })
})

describe('getEdgeAdditionError', () => {
  it('returns null when the edge is allowed', () => {
    const graph = baseGraph()
    expect(
      getEdgeAdditionError({ graph, edgeType: 'requires', sourceId: 'B', targetId: 'D' })
    ).toBeNull()
  })

  it('returns reasons for invalid edge additions', () => {
    const graph = baseGraph()
    graph.edges = [
      { edgeType: 'requires', source: 'A', target: 'B' },
      { edgeType: 'requires', source: 'B', target: 'C' }
    ]

    expect(
      getEdgeAdditionError({ graph, edgeType: 'requires', sourceId: 'B', targetId: 'B' })
    ).toBe('자기 자신에게 연결할 수 없습니다.')

    expect(
      getEdgeAdditionError({ graph, edgeType: 'requires', sourceId: 'B', targetId: 'C' })
    ).toBe('이미 동일한 연결이 존재합니다.')

    expect(
      getEdgeAdditionError({ graph, edgeType: 'requires', sourceId: 'B', targetId: 'A' })
    ).toBe('start 노드에는 requires 연결을 추가할 수 없습니다.')

    expect(
      getEdgeAdditionError({ graph, edgeType: 'requires', sourceId: 'C', targetId: 'B' })
    ).toBe('requires 사이클이 생깁니다.')
  })
})
