import { getEdgeStyle } from './view'

describe('getEdgeStyle', () => {
  it('highlights prereq edges more strongly than others', () => {
    const prereq = getEdgeStyle('prereq')
    const contains = getEdgeStyle('contains')

    expect(prereq.stroke).toBe('#ef4444')
    expect(prereq.strokeWidth).toBeGreaterThan(contains.strokeWidth as number)
  })

  it('uses a dashed line for alignsTo edges', () => {
    const style = getEdgeStyle('alignsTo')
    expect(style.strokeDasharray).toBeTruthy()
  })
})

