import { describe, expect, it } from 'vitest'
import type { SkillGraphV1 } from './schema'
import { validateSkillGraphV1Rules, validateSkillGraphV1RulesBasic } from './validate'

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

describe('validateSkillGraphV1Rules', () => {
  it('detects duplicate node ids', () => {
    const graph = baseGraph()
    graph.nodes = [...graph.nodes, { id: 'A', nodeCategory: 'core', label: 'A2' }]
    const issues = validateSkillGraphV1Rules(graph)
    expect(issues.some((issue) => issue.code === 'duplicate_node_id')).toBe(true)
  })

  it('detects missing node refs and self loops', () => {
    const graph = baseGraph()
    graph.edges = [
      { edgeType: 'requires', source: 'A', target: 'A' },
      { edgeType: 'requires', source: 'A', target: 'MISSING' }
    ]
    const issues = validateSkillGraphV1Rules(graph)
    expect(issues.some((issue) => issue.code === 'self_loop')).toBe(true)
    expect(issues.some((issue) => issue.code === 'missing_node_ref')).toBe(true)
  })

  it('detects requires cycles', () => {
    const graph = baseGraph()
    graph.edges = [
      { edgeType: 'requires', source: 'A', target: 'B' },
      { edgeType: 'requires', source: 'B', target: 'C' },
      { edgeType: 'requires', source: 'C', target: 'A' }
    ]
    const issues = validateSkillGraphV1Rules(graph)
    const cycleIssue = issues.find((issue) => issue.code === 'requires_cycle')
    expect(cycleIssue).toBeTruthy()
    expect(cycleIssue?.message).toContain('A -> B -> C -> A')
  })

  it('warns when no start nodes exist', () => {
    const graph = baseGraph()
    graph.nodes = graph.nodes.map((node) => ({ ...node, start: undefined }))
    const issues = validateSkillGraphV1Rules(graph)
    expect(issues.some((issue) => issue.code === 'no_start_nodes')).toBe(true)
  })
})

describe('validateSkillGraphV1RulesBasic', () => {
  it('detects duplicate ids, missing refs, and self-loops', () => {
    const graph = baseGraph()
    graph.nodes = [...graph.nodes, { id: 'A', nodeCategory: 'core', label: 'A2' }]
    graph.edges = [
      { edgeType: 'requires', source: 'A', target: 'A' },
      { edgeType: 'requires', source: 'A', target: 'MISSING' }
    ]
    const issues = validateSkillGraphV1RulesBasic(graph)
    const codes = new Set(issues.map((issue) => issue.code))
    expect(codes.has('duplicate_node_id')).toBe(true)
    expect(codes.has('missing_node_ref')).toBe(true)
    expect(codes.has('self_loop')).toBe(true)
  })

  it('does not include requires cycle detection', () => {
    const graph = baseGraph()
    graph.edges = [
      { edgeType: 'requires', source: 'A', target: 'B' },
      { edgeType: 'requires', source: 'B', target: 'C' },
      { edgeType: 'requires', source: 'C', target: 'A' }
    ]
    const issues = validateSkillGraphV1RulesBasic(graph)
    expect(issues.some((issue) => issue.code === 'requires_cycle')).toBe(false)
  })
})
