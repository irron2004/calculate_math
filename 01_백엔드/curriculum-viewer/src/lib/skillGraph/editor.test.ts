import { describe, expect, it } from 'vitest'
import validFixture from './fixtures/skill_graph_valid.v1.json'
import { parseSkillGraphV1 } from './schema'
import {
  addSkillGraphEdge,
  removeSkillGraphEdge,
  reverseSkillGraphEdge,
  updateSkillGraphEdgeType,
  updateSkillGraphNodeMeta
} from './editor'

describe('skillGraph/editor', () => {
  it('adds and removes edges without duplication', () => {
    const graph = parseSkillGraphV1(validFixture)
    const edge = { edgeType: 'requires' as const, source: graph.nodes[0].id, target: graph.nodes[1].id }

    const added = addSkillGraphEdge(graph, edge)
    expect(added.edges).toContainEqual(edge)

    const addedAgain = addSkillGraphEdge(added, edge)
    expect(addedAgain.edges.filter((value) => value.source === edge.source && value.target === edge.target && value.edgeType === edge.edgeType)).toHaveLength(1)

    const removed = removeSkillGraphEdge(addedAgain, edge)
    expect(removed.edges).not.toContainEqual(edge)
  })

  it('updates edge type and keeps edges unique by (type,source,target)', () => {
    const graph = parseSkillGraphV1(validFixture)
    const edge = { edgeType: 'requires' as const, source: graph.nodes[0].id, target: graph.nodes[1].id }
    const withEdge = addSkillGraphEdge(graph, edge)

    const updated = updateSkillGraphEdgeType(withEdge, { edge, nextEdgeType: 'related' })
    expect(updated.edges).not.toContainEqual(edge)
    expect(updated.edges).toContainEqual({ edgeType: 'related', source: edge.source, target: edge.target })
  })

  it('reverses edges', () => {
    const graph = parseSkillGraphV1(validFixture)
    const edge = { edgeType: 'prepares_for' as const, source: graph.nodes[0].id, target: graph.nodes[1].id }
    const withEdge = addSkillGraphEdge(graph, edge)

    const reversed = reverseSkillGraphEdge(withEdge, edge)
    expect(reversed.edges).not.toContainEqual(edge)
    expect(reversed.edges).toContainEqual({ edgeType: 'prepares_for', source: edge.target, target: edge.source })
  })

  it('updates nodeCategory and start flag', () => {
    const graph = parseSkillGraphV1(validFixture)
    const nodeId = graph.nodes[0].id

    const updated = updateSkillGraphNodeMeta(graph, { nodeId, nodeCategory: 'challenge', start: true })
    const node = updated.nodes.find((value) => value.id === nodeId)
    expect(node?.nodeCategory).toBe('challenge')
    expect(node?.start).toBe(true)

    const unset = updateSkillGraphNodeMeta(updated, { nodeId, nodeCategory: 'core', start: false })
    const node2 = unset.nodes.find((value) => value.id === nodeId)
    expect(node2?.nodeCategory).toBe('core')
    expect(node2 && 'start' in node2).toBe(false)
  })
})

