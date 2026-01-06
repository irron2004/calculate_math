import { validateCurriculum } from './validate'

describe('validateCurriculum', () => {
  it('detects missing parents and bidirectional mismatch', () => {
    const issues = validateCurriculum([
      {
        id: 'root',
        type: 'subject',
        title: 'Math',
        children_ids: ['missing-child']
      },
      {
        id: 'grade-1',
        type: 'grade',
        title: 'Grade 1',
        parent_id: 'missing-parent',
        children_ids: []
      }
    ])

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_child', nodeId: 'root' }),
        expect.objectContaining({ code: 'missing_parent', nodeId: 'grade-1' })
      ])
    )
  })

  it('detects cycles through parent pointers', () => {
    const issues = validateCurriculum([
      {
        id: 'a',
        type: 'grade',
        title: 'A',
        parent_id: 'b',
        children_ids: []
      },
      {
        id: 'b',
        type: 'grade',
        title: 'B',
        parent_id: 'a',
        children_ids: []
      }
    ])

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'cycle', nodeId: 'a' }),
        expect.objectContaining({ code: 'cycle', nodeId: 'b' })
      ])
    )
  })
})
