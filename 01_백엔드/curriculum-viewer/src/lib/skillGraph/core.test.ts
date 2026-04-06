import { beforeEach, describe, expect, it } from 'vitest'
import type { SkillGraphV1 } from './schema'
import {
  __resetSkillGraphCoreForTests,
  getPublished,
  getStudentGraph,
  publish,
  validateGraph,
  validateGraphBasic
} from './core'

function baseGraph(): SkillGraphV1 {
  return {
    schemaVersion: 'skill-graph-v1',
    graphId: 'g1',
    title: 't',
    nodes: [
      { id: 'A', nodeCategory: 'core', label: 'A', start: true },
      { id: 'B', nodeCategory: 'core', label: 'B' },
      { id: 'C', nodeCategory: 'core', label: 'C' }
    ],
    edges: []
  }
}

beforeEach(() => {
  __resetSkillGraphCoreForTests()
})

describe('validateGraph', () => {
  it('returns schema issues for invalid input', () => {
    const issues = validateGraph({})
    expect(issues.some((issue) => issue.code === 'invalid_schema_version')).toBe(true)
    expect(issues.some((issue) => issue.code === 'missing_graph_id')).toBe(true)
    expect(issues.some((issue) => issue.code === 'nodes_not_array')).toBe(true)
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true)
  })

  it('detects core validation rules (cycle/missing ref/self-loop/duplicate id)', () => {
    const graph = baseGraph()
    graph.nodes = [...graph.nodes, { id: 'A', nodeCategory: 'core', label: 'A2' }]
    graph.edges = [
      { edgeType: 'requires', source: 'A', target: 'A' },
      { edgeType: 'requires', source: 'A', target: 'MISSING' },
      { edgeType: 'requires', source: 'A', target: 'B' },
      { edgeType: 'requires', source: 'B', target: 'C' },
      { edgeType: 'requires', source: 'C', target: 'A' }
    ]

    const issues = validateGraph(graph)
    const codes = new Set(issues.map((issue) => issue.code))
    expect(codes.has('duplicate_node_id')).toBe(true)
    expect(codes.has('missing_node_ref')).toBe(true)
    expect(codes.has('self_loop')).toBe(true)
    expect(codes.has('requires_cycle')).toBe(true)
  })
})

describe('validateGraphBasic', () => {
  it('returns only duplicate/missing/self-loop issues (no cycle)', () => {
    const graph = baseGraph()
    graph.nodes = [...graph.nodes, { id: 'A', nodeCategory: 'core', label: 'A2' }]
    graph.edges = [
      { edgeType: 'requires', source: 'A', target: 'A' },
      { edgeType: 'requires', source: 'A', target: 'MISSING' },
      { edgeType: 'requires', source: 'A', target: 'B' },
      { edgeType: 'requires', source: 'B', target: 'C' },
      { edgeType: 'requires', source: 'C', target: 'A' }
    ]

    const issues = validateGraphBasic(graph)
    const codes = new Set(issues.map((issue) => issue.code))
    expect(codes.has('duplicate_node_id')).toBe(true)
    expect(codes.has('missing_node_ref')).toBe(true)
    expect(codes.has('self_loop')).toBe(true)
    expect(codes.has('requires_cycle')).toBe(false)
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true)
  })
})

describe('publish/getStudentGraph', () => {
  it('returns null when nothing has been published', () => {
    expect(getPublished()).toBe(null)
    expect(getStudentGraph()).toBe(null)
  })

  it('returns latest published graph in the same runtime session', () => {
    const g1 = baseGraph()
    const g2 = { ...baseGraph(), graphId: 'g2', title: 't2' }

    publish(g1, 1)
    publish(g2, 2)

    expect(getStudentGraph()?.graphId).toBe('g2')
    expect(getPublished()?.graphId).toBe('g2')
  })

  it('stores and returns the same object reference', () => {
    const g1 = baseGraph()
    publish(g1, 1)
    expect(getPublished()).toBe(g1)
  })
})
