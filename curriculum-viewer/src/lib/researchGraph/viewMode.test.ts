import {
  EDITOR_EDGE_TYPES,
  OVERVIEW_EDGE_TYPES,
  getEffectiveEdgeTypes,
  getEditorDefaultEdgeTypes,
  getOverviewEdgeTypes,
  normalizeEditorEdgeTypes,
  shouldShowEdgeLabels
} from './viewMode'

describe('researchGraph/viewMode', () => {
  it('returns overview defaults with prereq only', () => {
    expect(getOverviewEdgeTypes()).toEqual(['prereq'])
    expect(OVERVIEW_EDGE_TYPES).toEqual(['prereq'])
  })

  it('returns editor defaults with all known edge types', () => {
    expect(getEditorDefaultEdgeTypes()).toEqual(['contains', 'alignsTo', 'prereq'])
    expect(EDITOR_EDGE_TYPES).toEqual(['contains', 'alignsTo', 'prereq'])
  })

  it('normalizeEditorEdgeTypes keeps prereq even if missing', () => {
    expect(normalizeEditorEdgeTypes(['contains'])).toEqual(['contains', 'prereq'])
  })

  it('getEffectiveEdgeTypes uses overview rules in overview mode', () => {
    expect(getEffectiveEdgeTypes({ mode: 'overview', editorEdgeTypes: ['contains', 'alignsTo', 'prereq'] })).toEqual([
      'prereq'
    ])
  })

  it('getEffectiveEdgeTypes uses editor preferences in editor mode', () => {
    expect(getEffectiveEdgeTypes({ mode: 'editor', editorEdgeTypes: ['contains', 'prereq'] })).toEqual([
      'contains',
      'prereq'
    ])
  })

  it('shouldShowEdgeLabels returns false in overview and true in editor', () => {
    expect(shouldShowEdgeLabels('overview')).toBe(false)
    expect(shouldShowEdgeLabels('editor')).toBe(true)
  })
})
