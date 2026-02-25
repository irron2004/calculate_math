import { getEdgeLabelForMode, isEdgeTypeVisibleInMode } from './edgeLod'

describe('researchGraph/edgeLod', () => {
  it('shows only prereq in overview mode', () => {
    const editorSet = new Set(['contains', 'alignsTo', 'prereq'])
    expect(isEdgeTypeVisibleInMode({ mode: 'overview', edgeType: 'prereq', editorEdgeTypeSet: editorSet })).toBe(true)
    expect(isEdgeTypeVisibleInMode({ mode: 'overview', edgeType: 'contains', editorEdgeTypeSet: editorSet })).toBe(
      false
    )
    expect(isEdgeTypeVisibleInMode({ mode: 'overview', edgeType: 'alignsTo', editorEdgeTypeSet: editorSet })).toBe(
      false
    )
  })

  it('Editor mode uses editor edge set', () => {
    const editorSet = new Set(['contains', 'prereq'])
    expect(isEdgeTypeVisibleInMode({ mode: 'editor', edgeType: 'contains', editorEdgeTypeSet: editorSet })).toBe(true)
    expect(isEdgeTypeVisibleInMode({ mode: 'editor', edgeType: 'alignsTo', editorEdgeTypeSet: editorSet })).toBe(false)
  })

  it('hides edge labels in overview and keeps labels in editor', () => {
    expect(getEdgeLabelForMode({ mode: 'overview', edgeType: 'prereq' })).toBeUndefined()
    expect(getEdgeLabelForMode({ mode: 'editor', edgeType: 'prereq' })).toBe('prereq')
  })
})
