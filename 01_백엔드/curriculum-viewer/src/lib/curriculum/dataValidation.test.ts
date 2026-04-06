import { validateCurriculumData } from './dataValidation.js'

describe('validateCurriculumData', () => {
  it('returns schema issues for missing required fields', () => {
    const result = validateCurriculumData({
      nodes: [
        {
          id: 's1',
          type: 'subject',
          title: 'Math'
        }
      ]
    })

    expect(result.data).toBeNull()
    expect(result.schemaIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid_field', field: 'children_ids' })
      ])
    )
  })

  it('returns schema issues for type mismatches', () => {
    const result = validateCurriculumData({
      nodes: [
        {
          id: 's1',
          type: 'subject',
          title: 'Math',
          children_ids: [],
          parent_id: 123
        }
      ]
    })

    expect(result.data).toBeNull()
    expect(result.schemaIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid_field', field: 'parent_id', nodeId: 's1' })
      ])
    )
  })

  it('returns structural issues when schema validation passes', () => {
    const result = validateCurriculumData({
      nodes: [
        {
          id: 'g1',
          type: 'grade',
          title: 'Grade 1',
          children_ids: []
        }
      ]
    })

    expect(result.data).not.toBeNull()
    expect(result.schemaIssues).toHaveLength(0)
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing_parent', nodeId: 'g1' })])
    )
  })

  it('returns no issues for valid curriculum data', () => {
    const result = validateCurriculumData({
      nodes: [
        {
          id: 's1',
          type: 'subject',
          title: 'Math',
          children_ids: ['g1']
        },
        {
          id: 'g1',
          type: 'grade',
          title: 'Grade 1',
          parent_id: 's1',
          children_ids: ['d1']
        },
        {
          id: 'd1',
          type: 'domain',
          title: 'Numbers',
          parent_id: 'g1',
          children_ids: ['st1']
        },
        {
          id: 'st1',
          type: 'standard',
          title: 'Counting',
          parent_id: 'd1',
          children_ids: []
        }
      ]
    })

    expect(result.data).not.toBeNull()
    expect(result.schemaIssues).toHaveLength(0)
    expect(result.issues).toHaveLength(0)
  })
})
