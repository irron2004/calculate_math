import type { ResearchGraphViewMode } from './viewMode'

export function isEdgeTypeVisibleInMode(params: {
  mode: ResearchGraphViewMode
  edgeType: string
  editorEdgeTypeSet: ReadonlySet<string>
}): boolean {
  if (params.mode === 'overview') return params.edgeType === 'prereq'
  return params.editorEdgeTypeSet.has(params.edgeType)
}

export function getEdgeLabelForMode(params: {
  mode: ResearchGraphViewMode
  edgeType: string
}): string | undefined {
  if (params.mode === 'overview') return undefined
  return params.edgeType
}
