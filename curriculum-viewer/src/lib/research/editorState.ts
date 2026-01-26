import type { PrereqEdge } from '../curriculum2022/prereqEdit'
import type { ProposedTextbookUnitNode } from '../curriculum2022/types'
import type { ResearchTrack } from './schema'
import { getBrowserStorage, isRecord, safeGetItem, safeParseJson, safeSetItem } from '../repository/storage'

export const RESEARCH_EDITOR_STORAGE_KEY = 'curriculum-viewer:author:research-editor:v1'

export type ResearchEditorStateV1 = {
  version: 1
  selectedTrack: ResearchTrack
  proposedNodes: ProposedTextbookUnitNode[]
  addedEdges: PrereqEdge[]
  removedEdges: PrereqEdge[]
}

const DEFAULT_TRACK: ResearchTrack = 'T3'

function normalizeTrack(raw: unknown): ResearchTrack {
  return raw === 'T1' || raw === 'T2' || raw === 'T3' ? raw : DEFAULT_TRACK
}

function normalizeEdges(raw: unknown): PrereqEdge[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const edges: PrereqEdge[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const source = typeof item.source === 'string' ? item.source.trim() : ''
    const target = typeof item.target === 'string' ? item.target.trim() : ''
    if (!source || !target) continue
    const key = `${source}\u0000${target}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({ source, target })
  }
  return edges
}

function normalizeProposedNodes(raw: unknown): ProposedTextbookUnitNode[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const nodes: ProposedTextbookUnitNode[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    const label = typeof item.label === 'string' ? item.label.trim() : ''
    if (!id || !label) continue
    if (seen.has(id)) continue
    seen.add(id)
    const note = typeof item.note === 'string' && item.note.trim() ? item.note.trim() : undefined
    const reason = typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : undefined
    nodes.push({
      id,
      nodeType: 'textbookUnit',
      label,
      proposed: true,
      origin: 'manual',
      ...(note ? { note } : {}),
      ...(reason ? { reason } : {})
    })
  }
  return nodes
}

export function createDefaultResearchEditorState(): ResearchEditorStateV1 {
  return {
    version: 1,
    selectedTrack: DEFAULT_TRACK,
    proposedNodes: [],
    addedEdges: [],
    removedEdges: []
  }
}

export function normalizeResearchEditorState(raw: unknown): ResearchEditorStateV1 | null {
  if (!isRecord(raw)) return null
  if (raw.version !== 1) return null

  return {
    version: 1,
    selectedTrack: normalizeTrack(raw.selectedTrack),
    proposedNodes: normalizeProposedNodes(raw.proposedNodes),
    addedEdges: normalizeEdges(raw.addedEdges),
    removedEdges: normalizeEdges(raw.removedEdges)
  }
}

export function loadResearchEditorState(): ResearchEditorStateV1 {
  const storage = getBrowserStorage()
  if (!storage) return createDefaultResearchEditorState()

  const rawValue = safeGetItem(storage, RESEARCH_EDITOR_STORAGE_KEY)
  if (!rawValue) return createDefaultResearchEditorState()

  const raw = safeParseJson(rawValue)
  const parsed = normalizeResearchEditorState(raw)
  return parsed ?? createDefaultResearchEditorState()
}

export function saveResearchEditorState(state: ResearchEditorStateV1): void {
  const storage = getBrowserStorage()
  if (!storage) return
  safeSetItem(storage, RESEARCH_EDITOR_STORAGE_KEY, JSON.stringify(state))
}
