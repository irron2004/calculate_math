export type ResearchGraphViewMode = 'overview' | 'editor'

export const OVERVIEW_EDGE_TYPES = ['prereq'] as const
export const EDITOR_EDGE_TYPES = ['contains', 'alignsTo', 'prereq'] as const

export function getOverviewEdgeTypes(): string[] {
  return [...OVERVIEW_EDGE_TYPES]
}

export function getEditorDefaultEdgeTypes(): string[] {
  return [...EDITOR_EDGE_TYPES]
}

export function normalizeEditorEdgeTypes(edgeTypes: ReadonlyArray<string>): string[] {
  const preferred = new Set(edgeTypes)
  preferred.add('prereq')
  return EDITOR_EDGE_TYPES.filter((edgeType) => preferred.has(edgeType))
}

export function getEffectiveEdgeTypes(params: {
  mode: ResearchGraphViewMode
  editorEdgeTypes: ReadonlyArray<string>
}): string[] {
  if (params.mode === 'overview') return getOverviewEdgeTypes()
  return normalizeEditorEdgeTypes(params.editorEdgeTypes)
}

export function shouldShowEdgeLabels(mode: ResearchGraphViewMode): boolean {
  return mode === 'editor'
}
