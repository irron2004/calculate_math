import { buildCurriculumGraphLayout, GRAPH_LAYOUT_DEFAULTS } from './graphLayout'

describe('buildCurriculumGraphLayout', () => {
  const sampleNodes = [
    { id: 'S', type: 'subject', title: 'Math', children_ids: ['G1', 'G2'] },
    { id: 'G1', type: 'grade', title: 'Grade 1', parent_id: 'S', children_ids: ['D1'] },
    { id: 'G2', type: 'grade', title: 'Grade 2', parent_id: 'S', children_ids: ['D2'] },
    { id: 'D1', type: 'domain', title: 'Numbers', parent_id: 'G1', children_ids: ['ST1'], domain_code: 'NA', grade: 1 },
    { id: 'D2', type: 'domain', title: 'Numbers', parent_id: 'G2', children_ids: ['ST2'], domain_code: 'NA', grade: 2 },
    { id: 'ST1', type: 'standard', title: 'Add', parent_id: 'D1', children_ids: [] },
    { id: 'ST2', type: 'standard', title: 'Subtract', parent_id: 'D2', children_ids: [] }
  ] as any[]

  it('builds visible nodes and contains/progression edges from curriculum data', () => {
    const view = buildCurriculumGraphLayout({ nodes: sampleNodes })

    expect(view.nodes.map((node) => node.id).sort()).toEqual(['D1', 'D2', 'S', 'ST1', 'ST2'])

    const edgeKeys = view.edges.map((edge) => `${edge.edgeType}:${edge.source}->${edge.target}`)
    expect(edgeKeys).toEqual(
      expect.arrayContaining([
        'contains:S->D1',
        'contains:S->D2',
        'contains:D1->ST1',
        'contains:D2->ST2',
        'progression:D1->D2'
      ])
    )
  })

  it('uses documented dagre layout defaults', () => {
    expect(GRAPH_LAYOUT_DEFAULTS).toEqual({
      rankdir: 'TB',
      nodesep: 30,
      ranksep: 60,
      marginx: 20,
      marginy: 20
    })
  })

  it('respects layout direction when positioning nodes', () => {
    const nodes = [
      { id: 'S', type: 'subject', title: 'Math', children_ids: ['D1'] },
      { id: 'D1', type: 'domain', title: 'Numbers', parent_id: 'S', children_ids: [] }
    ] as any[]

    const tb = buildCurriculumGraphLayout({ nodes, direction: 'TB' })
    const lr = buildCurriculumGraphLayout({ nodes, direction: 'LR' })

    const tbRoot = tb.nodes.find((node) => node.id === 'S')!
    const tbChild = tb.nodes.find((node) => node.id === 'D1')!
    const lrRoot = lr.nodes.find((node) => node.id === 'S')!
    const lrChild = lr.nodes.find((node) => node.id === 'D1')!

    expect(tbChild.position.y).toBeGreaterThan(tbRoot.position.y)
    expect(lrChild.position.x).toBeGreaterThan(lrRoot.position.x)
  })
})
