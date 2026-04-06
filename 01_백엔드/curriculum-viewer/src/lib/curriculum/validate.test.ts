import { validateCurriculum } from './validate'
import { sortCurriculumIssues } from './validateCore.js'
import type { CurriculumNode } from './types'

describe('validateCurriculum', () => {
  function node(partial: Partial<CurriculumNode> & Pick<CurriculumNode, 'id' | 'type'>): CurriculumNode {
    return {
      title: '(title)',
      children_ids: [],
      ...partial
    }
  }

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

  it('detects duplicate ids', () => {
    const issues = validateCurriculum([
      node({ id: 'dup', type: 'subject', children_ids: [] }),
      node({ id: 'dup', type: 'grade', parent_id: 'some', children_ids: [] })
    ])

    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'duplicate_id', nodeId: 'dup' })]))
  })

  it('detects missing parent_id for non-root nodes', () => {
    const issues = validateCurriculum([node({ id: 'g1', type: 'grade' })])

    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'missing_parent', nodeId: 'g1' })]))
  })

  it('detects missing parent node references', () => {
    const issues = validateCurriculum([node({ id: 'g1', type: 'grade', parent_id: 'missing-parent' })])

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_parent', nodeId: 'g1', relatedId: 'missing-parent' })
      ])
    )
  })

  it('detects missing child node references', () => {
    const issues = validateCurriculum([node({ id: 's1', type: 'subject', children_ids: ['missing-child'] })])

    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing_child', nodeId: 's1', relatedId: 'missing-child' })])
    )
  })

  it('detects type hierarchy violations for parents', () => {
    const issues = validateCurriculum([
      node({ id: 's1', type: 'subject', children_ids: [] }),
      node({ id: 'd1', type: 'domain', parent_id: 's1', children_ids: [] })
    ])

    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'type_hierarchy', nodeId: 'd1', relatedId: 's1' })]))
  })

  it('detects type hierarchy violations for children', () => {
    const issues = validateCurriculum([
      node({ id: 's1', type: 'subject', children_ids: ['g1'] }),
      node({ id: 'g1', type: 'grade', parent_id: 's1', children_ids: ['std1'] }),
      node({ id: 'std1', type: 'standard', parent_id: 'g1', children_ids: [] })
    ])

    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'type_hierarchy', nodeId: 'g1', relatedId: 'std1' })]))
  })

  it('detects when parent.children_ids is missing the child (parent_missing_child)', () => {
    const issues = validateCurriculum([
      node({ id: 's1', type: 'subject', children_ids: ['g1'] }),
      node({ id: 'g1', type: 'grade', parent_id: 's1', children_ids: [] }),
      node({ id: 'd1', type: 'domain', parent_id: 'g1', children_ids: [] })
    ])

    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'parent_missing_child', severity: 'warning', nodeId: 'd1', relatedId: 'g1' })])
    )
  })

  it('detects when child.parent_id does not match the parent (child_wrong_parent)', () => {
    const issues = validateCurriculum([
      node({ id: 's1', type: 'subject', children_ids: ['g1', 'g2'] }),
      node({ id: 'g1', type: 'grade', parent_id: 's1', children_ids: ['d1'] }),
      node({ id: 'g2', type: 'grade', parent_id: 's1', children_ids: ['d1'] }),
      node({ id: 'd1', type: 'domain', parent_id: 'g2', children_ids: [] })
    ])

    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'child_wrong_parent', severity: 'warning', nodeId: 'd1', relatedId: 'g1' })])
    )
  })

  it('detects orphans (unreachable from roots)', () => {
    const issues = validateCurriculum([
      node({ id: 's1', type: 'subject', children_ids: [] }),
      node({ id: 'g1', type: 'grade', parent_id: 's1', children_ids: [] })
    ])

    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'orphan', nodeId: 'g1' })]))
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

  it('returns deterministically sorted issues (severity, code, nodeId, relatedId)', () => {
    const nodesA = [
      node({ id: 's1', type: 'subject', children_ids: ['missing-child', 'g1'] }),
      node({ id: 'g1', type: 'grade', parent_id: 's1', children_ids: ['std1'] }),
      node({ id: 'std1', type: 'standard', parent_id: 'g1', children_ids: ['extra-child'] }),
      node({ id: 'd1', type: 'domain', children_ids: [] })
    ] as const

    const nodesB = [...nodesA].reverse()

    const issuesA = validateCurriculum(nodesA)
    const issuesB = validateCurriculum(nodesB)

    const toKey = (issue: { severity: string; code: string; nodeId?: string; relatedId?: string }) => {
      return `${issue.severity}|${issue.code}|${issue.nodeId ?? ''}|${issue.relatedId ?? ''}`
    }

    expect(issuesA.map(toKey)).toEqual(issuesB.map(toKey))
    expect(issuesA.map(toKey)).toEqual([...issuesA].slice().sort().map(toKey))
  })

  it('breaks sort ties by message for deterministic output', () => {
    const sorted = sortCurriculumIssues([
      { severity: 'error', code: 'cycle', nodeId: 'a', message: 'b' },
      { severity: 'error', code: 'cycle', nodeId: 'a', message: 'a' }
    ])

    expect(sorted.map((issue) => issue.message)).toEqual(['a', 'b'])
  })
})
