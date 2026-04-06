import {
  buildContainsEdgeRefsSkippingGradeNodes,
  getGraphVisibleNodes
} from './graphView'

describe('Graph view helpers', () => {
  it('hides grade nodes from visible node list', () => {
    const nodes = [
      { id: 's', type: 'subject', title: 'Math', children_ids: ['g'] },
      { id: 'g', type: 'grade', title: 'Grade 1', parent_id: 's', children_ids: [] },
      { id: 'd', type: 'domain', title: 'Numbers', parent_id: 'g', children_ids: [] }
    ] as any[]

    expect(getGraphVisibleNodes(nodes).map((node) => node.id)).toEqual(['s', 'd'])
  })

  it('creates skip edges when grade nodes are present', () => {
    const nodes = [
      { id: 's', type: 'subject', title: 'Math', children_ids: ['g1'] },
      { id: 'g1', type: 'grade', title: 'Grade 1', parent_id: 's', children_ids: ['d1'] },
      { id: 'd1', type: 'domain', title: 'Numbers', parent_id: 'g1', children_ids: [] }
    ] as any[]

    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    expect(buildContainsEdgeRefsSkippingGradeNodes(nodes, nodeById)).toEqual([
      { source: 's', target: 'd1' }
    ])
  })
})
