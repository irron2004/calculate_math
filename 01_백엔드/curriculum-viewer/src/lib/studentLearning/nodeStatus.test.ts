import { calculateNodeStatus } from './nodeStatus'

describe('calculateNodeStatus', () => {
  it('returns CLEARED when a node is cleared', () => {
    expect(
      calculateNodeStatus({
        isCleared: true,
        hasDraft: false,
        hasSubmitted: false,
        isStart: false,
        missingPrereqNodeIds: ['A']
      })
    ).toBe('CLEARED')
  })

  it('returns IN_PROGRESS when a node has draft or submitted progress', () => {
    expect(
      calculateNodeStatus({
        isCleared: false,
        hasDraft: true,
        hasSubmitted: false,
        isStart: false,
        missingPrereqNodeIds: ['A']
      })
    ).toBe('IN_PROGRESS')

    expect(
      calculateNodeStatus({
        isCleared: false,
        hasDraft: false,
        hasSubmitted: true,
        isStart: false,
        missingPrereqNodeIds: ['A']
      })
    ).toBe('IN_PROGRESS')
  })

  it('returns AVAILABLE when prerequisites are cleared or node is start', () => {
    expect(
      calculateNodeStatus({
        isCleared: false,
        hasDraft: false,
        hasSubmitted: false,
        isStart: true,
        missingPrereqNodeIds: ['A']
      })
    ).toBe('AVAILABLE')

    expect(
      calculateNodeStatus({
        isCleared: false,
        hasDraft: false,
        hasSubmitted: false,
        isStart: false,
        missingPrereqNodeIds: []
      })
    ).toBe('AVAILABLE')
  })

  it('returns LOCKED when prerequisites are missing and no progress exists', () => {
    expect(
      calculateNodeStatus({
        isCleared: false,
        hasDraft: false,
        hasSubmitted: false,
        isStart: false,
        missingPrereqNodeIds: ['A', 'B']
      })
    ).toBe('LOCKED')
  })
})
