import sampleData from '../../../public/data/curriculum_math_v1.json'
import { buildProgressionEdges } from './progression'

describe('buildProgressionEdges', () => {
  it('creates NA domain progression edge from grade 2 to 3 in sample data', () => {
    const nodes = (sampleData as { nodes: any[] }).nodes
    const edges = buildProgressionEdges(nodes)

    expect(edges).toContainEqual(
      expect.objectContaining({
        edgeType: 'progression',
        domainCode: 'NA',
        source: 'MATH-2022-G-2-D-NA',
        target: 'MATH-2022-G-3-D-NA',
        fromGrade: 2,
        toGrade: 3
      })
    )
  })

  it('is deterministic regardless of input node order', () => {
    const nodes = (sampleData as { nodes: any[] }).nodes
    const shuffled = [...nodes].reverse()

    expect(buildProgressionEdges(nodes)).toEqual(buildProgressionEdges(shuffled))
  })

  it('skips nodes with missing domain_code/grade safely', () => {
    const edges = buildProgressionEdges([
      { id: 'bad-1', type: 'domain', grade: 2 },
      { id: 'bad-2', type: 'domain', domain_code: 'NA' },
      { id: 'bad-3', type: 'domain', domain_code: 'NA', grade: 2.5 },
      { id: 'ok-2', type: 'domain', domain_code: 'NA', grade: 2 },
      { id: 'ok-4', type: 'domain', domain_code: 'NA', grade: 4 }
    ] as any[])

    expect(edges).toEqual([])
  })

  it('does not create duplicate edges when nodes are duplicated', () => {
    const edges = buildProgressionEdges([
      { id: 'd2', type: 'domain', domain_code: 'NA', grade: 2 },
      { id: 'd3', type: 'domain', domain_code: 'NA', grade: 3 },
      { id: 'd2', type: 'domain', domain_code: 'NA', grade: 2 },
      { id: 'd3', type: 'domain', domain_code: 'NA', grade: 3 }
    ] as any[])

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      edgeType: 'progression',
      domainCode: 'NA',
      source: 'd2',
      target: 'd3',
      fromGrade: 2,
      toGrade: 3
    })
  })

  it('returns empty when only one valid domain node exists', () => {
    const edges = buildProgressionEdges([
      { id: 'd2', type: 'domain', domain_code: 'NA', grade: 2 }
    ] as any[])

    expect(edges).toEqual([])
  })

  it('selects a deterministic node when domain_code+grade are duplicated', () => {
    const edges = buildProgressionEdges([
      { id: 'na-2-b', type: 'domain', domain_code: 'NA', grade: 2 },
      { id: 'na-3', type: 'domain', domain_code: 'NA', grade: 3 },
      { id: 'na-2-a', type: 'domain', domain_code: 'NA', grade: 2 }
    ] as any[])

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      edgeType: 'progression',
      domainCode: 'NA',
      source: 'na-2-a',
      target: 'na-3',
      fromGrade: 2,
      toGrade: 3
    })
  })
})
