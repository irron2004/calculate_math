import { parseResearchPatchV1Safe } from './schema'

describe('parseResearchPatchV1', () => {
  it('accepts a minimal patch with empty arrays', () => {
    const result = parseResearchPatchV1Safe({
      add_nodes: [],
      add_edges: [],
      remove_edges: []
    })

    expect(result.ok).toBe(true)
  })

  it('rejects missing required keys', () => {
    const result = parseResearchPatchV1Safe({
      add_nodes: [],
      add_edges: []
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.issues.map((issue) => issue.code)).toContain('missing_remove_edges')
    }
  })

  it('rejects type mismatches for required keys', () => {
    const result = parseResearchPatchV1Safe({
      add_nodes: [],
      add_edges: 'nope',
      remove_edges: []
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.issues.map((issue) => issue.code)).toContain('missing_add_edges')
    }
  })
})
