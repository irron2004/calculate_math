import { buildCurriculumGraphV2 } from './uspGraph'

describe('buildCurriculumGraphV2', () => {
  it('converts curriculum node and edge types to Unit-Skill graph model', () => {
    const graph = buildCurriculumGraphV2({
      curriculum: {
        meta: { curriculumId: 'KR-MATH-2022' },
        nodes: [
          { id: 'ROOT', nodeType: 'root', label: 'Math' },
          { id: 'U-1', nodeType: 'textbookUnit', label: 'Unit 1', parentId: 'ROOT', gradeBand: '1-2' },
          { id: 'S-1', nodeType: 'achievement', label: 'Skill 1', parentId: 'U-1', domainCode: 'NA' }
        ],
        edges: [
          { edgeType: 'contains', source: 'ROOT', target: 'U-1' },
          { edgeType: 'alignsTo', source: 'U-1', target: 'S-1' },
          { edgeType: 'prereq', source: 'S-1', target: 'S-1B' }
        ]
      }
    })

    expect(graph.schemaVersion).toBe('curriculum-graph-v2')
    expect(graph.graphId).toBe('KR-MATH-2022')
    expect(graph.nodes.find((node) => node.id === 'ROOT')?.nodeType).toBe('unit')
    expect(graph.nodes.find((node) => node.id === 'U-1')?.nodeType).toBe('unit')
    expect(graph.nodes.find((node) => node.id === 'S-1')?.nodeType).toBe('skill')
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { edgeType: 'contains', source: 'ROOT', target: 'U-1' },
        { edgeType: 'prepares_for', source: 'U-1', target: 'S-1' }
      ])
    )
    expect(graph.edges).not.toEqual(expect.arrayContaining([{ edgeType: 'requires', source: 'S-1', target: 'S-1B' }]))
  })

  it('adds problem nodes and has_problem edges for every mapped skill', () => {
    const graph = buildCurriculumGraphV2({
      curriculum: {
        meta: { curriculumId: 'KR-MATH-2022' },
        nodes: [{ id: 'S-1', nodeType: 'achievement', label: 'Skill 1' }],
        edges: []
      },
      problemBank: {
        version: 1,
        problemsByNodeId: {
          'S-1': [{ id: 'P-1', type: 'numeric', prompt: '1 + 1 = ?', answer: '2' }]
        }
      }
    })

    expect(graph.nodes.find((node) => node.id === 'P-1')?.nodeType).toBe('problem')
    expect(graph.edges).toEqual(expect.arrayContaining([{ edgeType: 'has_problem', source: 'S-1', target: 'P-1' }]))
  })

  it('avoids node id collisions when problem id duplicates existing curriculum id', () => {
    const graph = buildCurriculumGraphV2({
      curriculum: {
        meta: { curriculumId: 'KR-MATH-2022' },
        nodes: [
          { id: 'S-1', nodeType: 'achievement', label: 'Skill 1' },
          { id: 'P-1', nodeType: 'achievement', label: 'Skill with colliding id' }
        ],
        edges: []
      },
      problemBank: {
        version: 1,
        problemsByNodeId: {
          'S-1': [{ id: 'P-1', type: 'numeric', prompt: '1 + 1 = ?', answer: '2' }]
        }
      }
    })

    expect(graph.nodes.some((node) => node.id === 'problem:P-1' && node.nodeType === 'problem')).toBe(true)
    expect(graph.edges).toEqual(
      expect.arrayContaining([{ edgeType: 'has_problem', source: 'S-1', target: 'problem:P-1' }])
    )
  })

  it('optionally adds reverse measures edges', () => {
    const graph = buildCurriculumGraphV2({
      curriculum: {
        meta: { curriculumId: 'KR-MATH-2022' },
        nodes: [{ id: 'S-1', nodeType: 'achievement', label: 'Skill 1' }],
        edges: []
      },
      problemBank: {
        version: 1,
        problemsByNodeId: {
          'S-1': [{ id: 'P-1', type: 'numeric', prompt: '1 + 1 = ?', answer: '2' }]
        }
      },
      includeMeasuresEdges: true
    })

    expect(graph.edges).toEqual(expect.arrayContaining([{ edgeType: 'measures', source: 'P-1', target: 'S-1' }]))
  })
})
