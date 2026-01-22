import invalidFixture from './fixtures/skill_graph_invalid.v1.json'
import validFixture from './fixtures/skill_graph_valid.v1.json'
import {
  parseSkillGraphV1,
  parseSkillGraphV1Safe,
  SkillGraphSchemaError,
  validateSkillGraphV1,
  validateSkillGraphV1Basic
} from './schema'

describe('Skill-Graph schema v1', () => {
  it('accepts the valid fixture', () => {
    const parsed = parseSkillGraphV1(validFixture)
    expect(parsed.schemaVersion).toBe('skill-graph-v1')
    expect(parsed.nodes.length).toBeGreaterThan(0)
  })

  it('rejects the invalid fixture with an identifiable reason', () => {
    try {
      parseSkillGraphV1(invalidFixture)
      throw new Error('Expected SkillGraphSchemaError')
    } catch (error) {
      expect(error).toBeInstanceOf(SkillGraphSchemaError)
      const schemaError = error as SkillGraphSchemaError
      expect(schemaError.issues.some((issue) => issue.code === 'duplicate_node_id')).toBe(true)
    }
  })

  it('rejects invalid schemaVersion', () => {
    const issues = validateSkillGraphV1({ ...validFixture, schemaVersion: 'other' })
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'invalid_schema_version' })]))
  })

  it('rejects nodes with invalid id characters', () => {
    const broken = {
      ...validFixture,
      nodes: [{ ...validFixture.nodes[0], id: 'BAD ID WITH SPACE' }]
    }
    const issues = validateSkillGraphV1(broken)
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'invalid_id', path: 'nodes[0].id' })]))
  })

  it('rejects edges referencing missing nodes', () => {
    const broken = {
      ...validFixture,
      edges: [{ edgeType: 'requires', source: 'MISSING', target: validFixture.nodes[0].id }]
    }
    const issues = validateSkillGraphV1(broken)
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unknown_node_ref', path: 'edges[0].source' })]))
  })

  it('detects missing edge source/target fields', () => {
    const broken = {
      schemaVersion: 'skill-graph-v1',
      graphId: 'COURSE_EDGE_MISSING_FIELDS',
      title: 'Edge missing fields',
      nodes: [{ id: 'A', nodeCategory: 'core', label: 'A' }],
      edges: [{ edgeType: 'requires' }]
    }

    const issues = validateSkillGraphV1(broken)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_edge_source', path: 'edges[0].source' }),
        expect.objectContaining({ code: 'missing_edge_target', path: 'edges[0].target' })
      ])
    )
  })

  it('can return a non-throwing parse result', () => {
    const result = parseSkillGraphV1Safe({ ...validFixture, schemaVersion: 'other' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'invalid_schema_version', path: 'schemaVersion' })])
      )
    }
  })

  it('can return a basic validation result with nodeId when possible', () => {
    const result = validateSkillGraphV1Basic({
      ...validFixture,
      edges: [{ edgeType: 'requires', source: 'MISSING', target: validFixture.nodes[0].id }]
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'unknown_node_ref', nodeId: 'MISSING' })])
      )
    }
  })

  it('rejects start:true nodes that have incoming requires edges', () => {
    const broken = {
      schemaVersion: 'skill-graph-v1',
      graphId: 'COURSE_START_CONFLICT',
      title: 'Start conflict',
      nodes: [
        { id: 'A', nodeCategory: 'core', label: 'A', start: true },
        { id: 'B', nodeCategory: 'core', label: 'B' }
      ],
      edges: [{ edgeType: 'requires', source: 'B', target: 'A' }]
    }

    const issues = validateSkillGraphV1(broken)
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('incoming requires') })]))
  })
})
