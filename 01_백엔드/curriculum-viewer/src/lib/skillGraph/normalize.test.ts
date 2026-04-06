import { describe, expect, it } from 'vitest'
import validFixture from './fixtures/skill_graph_valid.v1.json'
import { normalizeSkillGraphSchemaError } from './normalize'
import { parseSkillGraphV1 } from './schema'

function normalizeFromParse(input: unknown) {
  try {
    parseSkillGraphV1(input)
  } catch (error) {
    return normalizeSkillGraphSchemaError(error)
  }
  return null
}

describe('normalizeSkillGraphSchemaError', () => {
  it('returns null for non-SkillGraphSchemaError', () => {
    expect(normalizeSkillGraphSchemaError(new Error('boom'))).toBeNull()
  })

  it('normalizes invalid schemaVersion', () => {
    const normalized = normalizeFromParse({ ...validFixture, schemaVersion: 'other' })
    expect(normalized).not.toBeNull()
    expect(normalized?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'invalid_schema_version', path: 'schemaVersion' })])
    )
  })

  it('normalizes missing/invalid nodes array', () => {
    const normalized = normalizeFromParse({
      schemaVersion: 'skill-graph-v1',
      graphId: 'G',
      title: 'T',
      nodes: {},
      edges: []
    })
    expect(normalized).not.toBeNull()
    expect(normalized?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'nodes_not_array', path: 'nodes' })])
    )
  })

  it('normalizes duplicate node id', () => {
    const normalized = normalizeFromParse({
      schemaVersion: 'skill-graph-v1',
      graphId: 'G',
      title: 'T',
      nodes: [
        { id: 'DUP', nodeCategory: 'core', label: 'A' },
        { id: 'DUP', nodeCategory: 'core', label: 'B' }
      ],
      edges: []
    })
    expect(normalized).not.toBeNull()
    expect(normalized?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'duplicate_node_id', path: 'nodes[1].id' })])
    )
  })
})

