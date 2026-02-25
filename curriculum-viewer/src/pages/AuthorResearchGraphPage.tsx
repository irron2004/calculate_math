import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import ReactFlow, { Background, Controls, MiniMap, type Connection, type Edge, type Node } from 'reactflow'
import 'reactflow/dist/style.css'
import { loadCurriculum2022Graph } from '../lib/curriculum2022/graph'
import { getEdgeStyle } from '../lib/curriculum2022/view'
import {
  addPrereqEdge,
  createPrereqEditState,
  detectPrereqCycle,
  listCurrentPrereqEdges,
  removePrereqEdge,
  type PrereqEditState,
  type PrereqEdge,
  type PrereqEdgeWithOrigin
} from '../lib/curriculum2022/prereqEdit'
import { generateProposedNodeId } from '../lib/curriculum2022/proposedNodes'
import { loadResearchPatchForTrack } from '../lib/research/loaders'
import type { ResearchPatchV1, ResearchTrack } from '../lib/research/schema'
import {
  getResearchSuggestionStatus,
  loadResearchSuggestionsStore,
  saveResearchSuggestionsStore,
  setResearchSuggestionStatus,
  type ResearchSuggestionStatus,
  type ResearchSuggestionsStoreV1
} from '../lib/research/suggestionsStore'
import { applyResearchPatch, researchEdgeKey } from '../lib/research/applyResearchPatch'
import type { ProposedTextbookUnitNode } from '../lib/curriculum2022/types'
import { buildPatchExport } from '../lib/research/patchExport'
import { loadResearchEditorState, saveResearchEditorState } from '../lib/research/editorState'
import { parseProblemBank, type ProblemBank } from '../lib/learn/problems'
import ResearchGraphModeToggle from '../components/ResearchGraphModeToggle'
import { buildResearchNodeLabel } from '../lib/researchGraph/nodeLabel'
import { getEdgeLabelForMode, isEdgeTypeVisibleInMode } from '../lib/researchGraph/edgeLod'
import {
  getEffectiveEdgeTypes,
  getEditorDefaultEdgeTypes,
  normalizeEditorEdgeTypes,
  shouldShowEdgeLabels,
  type ResearchGraphViewMode
} from '../lib/researchGraph/viewMode'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; graph: Awaited<ReturnType<typeof loadCurriculum2022Graph>> }

type HoverEdgeRef = {
  id: string
  source: string
  target: string
}

type HoverHighlight = {
  nodeIds: Set<string>
  edgeIds: Set<string>
}

type InspectableNode = {
  id: string
  nodeType: string
  label: string
  gradeBand?: string
  parentId?: string
  domainCode?: string
  text?: string
  note?: string
  reason?: string
  proposed?: boolean
}

type ExamplePrompt = {
  nodeId: string
  prompt: string
}

const NODE_WIDTH = 260
const NODE_HEIGHT = 70
const GRID_GAP_X = 40
const GRID_GAP_Y = 30
const GRADE_BAND_GAP_Y = 120
const DOMAIN_LAYER_GAP_Y = 160
const DOMAIN_LAYER_ORDER = ['NA', 'RR', 'GM', 'DP'] as const
const DOMAIN_LAYER_FALLBACK = '__unspecified__'
const HOVER_LEAVE_DEBOUNCE_MS = 120

type DomainLayerCode = (typeof DOMAIN_LAYER_ORDER)[number] | typeof DOMAIN_LAYER_FALLBACK

const DOMAIN_LABEL_DEFAULT: Record<(typeof DOMAIN_LAYER_ORDER)[number], string> = {
  NA: '수와 연산',
  RR: '변화와 관계',
  GM: '도형과 측정',
  DP: '자료와 가능성'
}

function normalizeDomainCode(value: unknown): DomainLayerCode {
  return value === 'NA' || value === 'RR' || value === 'GM' || value === 'DP' ? value : DOMAIN_LAYER_FALLBACK
}

function domainLayerSortKey(code: DomainLayerCode): number {
  if (code === DOMAIN_LAYER_FALLBACK) return DOMAIN_LAYER_ORDER.length + 1
  const index = DOMAIN_LAYER_ORDER.indexOf(code)
  return index === -1 ? DOMAIN_LAYER_ORDER.length : index
}

function sortDomainCodes(values: Iterable<DomainLayerCode>): DomainLayerCode[] {
  const unique = new Set<DomainLayerCode>()
  for (const value of values) {
    unique.add(normalizeDomainCode(value))
  }
  return Array.from(unique).sort((a, b) => domainLayerSortKey(a) - domainLayerSortKey(b))
}

function gradeBandSortKey(value: string): number {
  const match = value.match(/\d+/)
  if (!match) return Number.POSITIVE_INFINITY
  return Number(match[0])
}

function gradeBandSchoolLevel(band: string): 'E' | 'M' | 'H' | 'U' {
  const match = band.match(/^(\d+)(?:\D+(\d+))?$/)
  if (!match) return 'U'
  const start = Number(match[1])
  if (!Number.isFinite(start)) return 'U'
  if (start <= 6) return 'E'
  if (start <= 9) return 'M'
  return 'H'
}

function formatGradeBandLabel(band: string): string {
  const level = gradeBandSchoolLevel(band)
  switch (level) {
    case 'E':
      return `초 ${band}`
    case 'M':
      return `중 ${band}`
    case 'H':
      return `고 ${band}`
    default:
      return band
  }
}

function compareGradeBand(a?: string, b?: string): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  const keyDiff = gradeBandSortKey(a) - gradeBandSortKey(b)
  if (keyDiff !== 0) return keyDiff
  return a.localeCompare(b)
}

function computePrereqDepths(nodeIds: string[], edges: PrereqEdge[]): Map<string, number> {
  const nodeIdSet = new Set(nodeIds)
  const depth = new Map<string, number>(nodeIds.map((id) => [id, 1]))
  const indegree = new Map<string, number>(nodeIds.map((id) => [id, 0]))
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()

  for (const edge of edges) {
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) continue
    const out = outgoing.get(edge.source)
    if (out) {
      out.push(edge.target)
    } else {
      outgoing.set(edge.source, [edge.target])
    }
    const inc = incoming.get(edge.target)
    if (inc) {
      inc.push(edge.source)
    } else {
      incoming.set(edge.target, [edge.source])
    }
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, count] of indegree) {
    if (count === 0) queue.push(id)
  }

  while (queue.length > 0) {
    const id = queue.shift()
    if (!id) break
    const nextDepth = (depth.get(id) ?? 1) + 1
    const targets = outgoing.get(id) ?? []
    for (const target of targets) {
      if ((depth.get(target) ?? 1) < nextDepth) {
        depth.set(target, nextDepth)
      }
      const nextIndegree = (indegree.get(target) ?? 0) - 1
      indegree.set(target, nextIndegree)
      if (nextIndegree === 0) {
        queue.push(target)
      }
    }
  }

  const baseDepth = new Map(depth)
  for (const [id, count] of indegree) {
    if (count <= 0) continue
    const preds = incoming.get(id) ?? []
    let maxPredDepth = 0
    for (const pred of preds) {
      maxPredDepth = Math.max(maxPredDepth, baseDepth.get(pred) ?? 1)
    }
    if (maxPredDepth > 0) {
      depth.set(id, Math.max(depth.get(id) ?? 1, maxPredDepth + 1))
    }
  }

  return depth
}
const RESEARCH_TRACKS: ResearchTrack[] = ['T1', 'T2', 'T3']

function getNodeStyle(nodeType: string, proposed?: boolean): CSSProperties {
  if (proposed) {
    return {
      border: '1px dashed rgba(217, 119, 6, 0.7)',
      borderLeft: '4px solid #d97706',
      background: '#fffbeb'
    }
  }

  switch (nodeType) {
    case 'textbookUnit':
      return { border: '1px solid #e2e8f0', borderLeft: '4px solid #0ea5e9', background: '#ffffff' }
    case 'achievement':
      return { border: '1px solid #e2e8f0', borderLeft: '4px solid #22c55e', background: '#ffffff' }
    default:
      return { border: '1px solid #e2e8f0', background: '#ffffff' }
  }
}

export default function AuthorResearchGraphPage() {
  const initialEditorState = useMemo(() => loadResearchEditorState(), [])
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [viewMode, setViewMode] = useState<ResearchGraphViewMode>('overview')
  const [activeTrack, setActiveTrack] = useState<ResearchTrack>(initialEditorState.selectedTrack)
  const [visibleDomainCodes, setVisibleDomainCodes] = useState<DomainLayerCode[]>([
    ...DOMAIN_LAYER_ORDER,
    DOMAIN_LAYER_FALLBACK
  ])
  const [visibleDepthRange, setVisibleDepthRange] = useState<{ min: number; max: number }>({ min: 1, max: 99 })
  const [visibleGradeBands, setVisibleGradeBands] = useState<string[]>([]) // empty means all visible
  const [editorVisibleEdgeTypes, setEditorVisibleEdgeTypes] = useState<string[]>(() =>
    normalizeEditorEdgeTypes(getEditorDefaultEdgeTypes())
  )
  const [selectedPrereq, setSelectedPrereq] = useState<PrereqEdgeWithOrigin | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [problemBank2022, setProblemBank2022] = useState<ProblemBank | null>(null)
  const [manualProposedNodes, setManualProposedNodes] = useState<ProposedTextbookUnitNode[]>(
    initialEditorState.proposedNodes
  )
  const [manualAddedEdges, setManualAddedEdges] = useState<PrereqEdge[]>(initialEditorState.addedEdges)
  const [manualRemovedEdges, setManualRemovedEdges] = useState<PrereqEdge[]>(initialEditorState.removedEdges)
  const [showAddProposed, setShowAddProposed] = useState(false)
  const [proposedLabel, setProposedLabel] = useState('')
  const [proposedNote, setProposedNote] = useState('')
  const [proposedError, setProposedError] = useState<string | null>(null)
  const [suggestionsStore, setSuggestionsStore] = useState<ResearchSuggestionsStoreV1>(() => loadResearchSuggestionsStore())
  const [patchesByTrack, setPatchesByTrack] = useState<Partial<Record<ResearchTrack, ResearchPatchV1>>>({})
  const [patchErrorsByTrack, setPatchErrorsByTrack] = useState<Partial<Record<ResearchTrack, string>>>({})
  const [patchLoading, setPatchLoading] = useState(false)
  const [exportJson, setExportJson] = useState<string | null>(null)
  const hoverLeaveTimerRef = useRef<number | null>(null)
  const hoverPanelActiveRef = useRef(false)

  const cancelHoverLeaveTimer = useCallback(() => {
    if (hoverLeaveTimerRef.current === null) return
    window.clearTimeout(hoverLeaveTimerRef.current)
    hoverLeaveTimerRef.current = null
  }, [])

  const clearHoverState = useCallback(() => {
    setHoveredNodeId(null)
    setInspectedNodeId(null)
  }, [])

  const scheduleHoverLeave = useCallback(() => {
    cancelHoverLeaveTimer()
    hoverLeaveTimerRef.current = window.setTimeout(() => {
      hoverLeaveTimerRef.current = null
      if (hoverPanelActiveRef.current) return
      clearHoverState()
    }, HOVER_LEAVE_DEBOUNCE_MS)
  }, [cancelHoverLeaveTimer, clearHoverState])

  const handleNodeMouseEnter = useCallback(
    (_: unknown, node: Node) => {
      if (node.id.startsWith('__')) return
      hoverPanelActiveRef.current = false
      cancelHoverLeaveTimer()
      setHoveredNodeId(node.id)
      setInspectedNodeId(node.id)
    },
    [cancelHoverLeaveTimer]
  )

  const handleNodeMouseLeave = useCallback(
    (_: unknown, node: Node) => {
      if (node.id.startsWith('__')) return
      if (hoveredNodeId !== node.id) return
      scheduleHoverLeave()
    },
    [hoveredNodeId, scheduleHoverLeave]
  )

  const handleHoverPanelMouseEnter = useCallback(() => {
    hoverPanelActiveRef.current = true
    cancelHoverLeaveTimer()
  }, [cancelHoverLeaveTimer])

  const handleHoverPanelMouseLeave = useCallback(() => {
    hoverPanelActiveRef.current = false
    scheduleHoverLeave()
  }, [scheduleHoverLeave])

  useEffect(() => {
    return () => {
      cancelHoverLeaveTimer()
    }
  }, [cancelHoverLeaveTimer])

  useEffect(() => {
    saveResearchEditorState({
      version: 1,
      selectedTrack: activeTrack,
      proposedNodes: manualProposedNodes,
      addedEdges: manualAddedEdges,
      removedEdges: manualRemovedEdges
    })
  }, [activeTrack, manualAddedEdges, manualProposedNodes, manualRemovedEdges])

  useEffect(() => {
    if (viewMode !== 'overview') return
    setShowAddProposed(false)
    setSelectedPrereq(null)
    setExportJson(null)
    setProposedError(null)
  }, [viewMode])

  useEffect(() => {
    const controller = new AbortController()

    loadCurriculum2022Graph(controller.signal)
      .then((graph) => setState({ status: 'ready', graph }))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        setState({ status: 'error', message })
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetch('/data/problems_2022_v1.json', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return
        const json = (await response.json()) as unknown
        const parsed = parseProblemBank(json)
        if (!parsed) return
        if (controller.signal.aborted) return
        setProblemBank2022(parsed)
      })
      .catch(() => {
        // ignore (missing file / offline / aborted)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setPatchLoading(true)

    Promise.allSettled(
      RESEARCH_TRACKS.map((track) => loadResearchPatchForTrack(track, { signal: controller.signal }))
    )
      .then((results) => {
        if (controller.signal.aborted) return
        const nextPatches: Partial<Record<ResearchTrack, ResearchPatchV1>> = {}
        const nextErrors: Partial<Record<ResearchTrack, string>> = {}
        results.forEach((result, index) => {
          const track = RESEARCH_TRACKS[index]
          if (result.status === 'fulfilled') {
            nextPatches[track] = result.value
          } else {
            const error = result.reason
            nextErrors[track] = error instanceof Error ? error.message : String(error)
          }
        })
        setPatchesByTrack(nextPatches)
        setPatchErrorsByTrack(nextErrors)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPatchLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const patches = RESEARCH_TRACKS.map((track) => patchesByTrack[track]).filter(
      (patch): patch is ResearchPatchV1 => Boolean(patch)
    )
    if (patches.length === 0) return

    setSuggestionsStore((prev) => {
      const acceptedNodeIds = new Set(prev.accepted.nodeIds)
      const acceptedEdgeKeys = new Set(prev.accepted.edgeKeys)
      const excludedNodeIds = new Set(prev.excluded.nodeIds)
      const excludedEdgeKeys = new Set(prev.excluded.edgeKeys)
      let changed = false

      for (const patch of patches) {
        for (const node of patch.add_nodes) {
          if (excludedNodeIds.has(node.id)) continue
          if (acceptedNodeIds.has(node.id)) continue
          acceptedNodeIds.add(node.id)
          changed = true
        }
        for (const edge of patch.add_edges) {
          const key = researchEdgeKey(edge)
          if (excludedEdgeKeys.has(key)) continue
          if (acceptedEdgeKeys.has(key)) continue
          acceptedEdgeKeys.add(key)
          changed = true
        }
      }

      if (!changed) return prev

      const next: ResearchSuggestionsStoreV1 = {
        version: 1,
        accepted: {
          nodeIds: Array.from(acceptedNodeIds),
          edgeKeys: Array.from(acceptedEdgeKeys)
        },
        excluded: prev.excluded
      }
      saveResearchSuggestionsStore(next)
      return next
    })
  }, [patchesByTrack])

  const setSuggestionStatus = useCallback(
    (params: { type: 'node' | 'edge'; key: string; status: 'accepted' | 'excluded' }) => {
      setSuggestionsStore((prev) => {
        const next = setResearchSuggestionStatus({ store: prev, type: params.type, key: params.key, status: params.status })
        saveResearchSuggestionsStore(next)
        return next
      })
    },
    []
  )

  const baseNodeIds = useMemo(() => {
    if (state.status !== 'ready') return []
    return state.graph.nodes.map((node) => node.id)
  }, [state])

  const basePrereqEdges = useMemo(() => {
    if (state.status !== 'ready') return []
    return state.graph.edges
      .filter((edge) => edge.edgeType === 'prereq')
      .map((edge) => ({ source: edge.source, target: edge.target }))
  }, [state])

  const appliedResearchState = useMemo(() => {
    if (state.status !== 'ready') return null
    let nextState = {
      proposedNodes: manualProposedNodes,
      prereq: createPrereqEditState({ base: basePrereqEdges, research: [] })
    }

    for (const track of RESEARCH_TRACKS) {
      const patch = patchesByTrack[track]
      if (!patch) continue
      const acceptedPatch: ResearchPatchV1 = {
        ...patch,
        add_nodes: patch.add_nodes.filter(
          (node) => getResearchSuggestionStatus({ store: suggestionsStore, type: 'node', key: node.id }) === 'accepted'
        ),
        add_edges: patch.add_edges.filter(
          (edge) =>
            getResearchSuggestionStatus({ store: suggestionsStore, type: 'edge', key: researchEdgeKey(edge) }) ===
            'accepted'
        ),
        remove_edges: []
      }
      nextState = applyResearchPatch({ state: nextState, baseNodeIds, patch: acceptedPatch })
    }

    const nextPrereq: PrereqEditState = {
      ...nextState.prereq,
      added: manualAddedEdges,
      removed: manualRemovedEdges,
      suppressedResearch: []
    }

    return { proposedNodes: nextState.proposedNodes, editState: nextPrereq }
  }, [baseNodeIds, basePrereqEdges, manualAddedEdges, manualProposedNodes, manualRemovedEdges, patchesByTrack, state, suggestionsStore])

  const editState = appliedResearchState?.editState ?? null
  const proposedNodes = appliedResearchState?.proposedNodes ?? manualProposedNodes

  const inspectableNodeById = useMemo(() => {
    const map = new Map<string, InspectableNode>()
    if (state.status === 'ready') {
      for (const node of state.graph.nodes) {
        map.set(node.id, node)
      }
    }
    for (const node of proposedNodes) {
      map.set(node.id, node)
    }
    return map
  }, [proposedNodes, state])

  const mergedNonPrereqEdges = useMemo(() => {
    const merged = new Map<string, { id?: string; edgeType: string; source: string; target: string }>()
    if (state.status !== 'ready') return []

    const hasNode = (id: string) => inspectableNodeById.has(id)

    for (const edge of state.graph.edges) {
      if (edge.edgeType === 'prereq') continue
      if (!hasNode(edge.source) || !hasNode(edge.target)) continue
      const key = `${edge.edgeType}\u0000${edge.source}\u0000${edge.target}`
      merged.set(key, edge)
    }

    for (const track of RESEARCH_TRACKS) {
      const patch = patchesByTrack[track]
      if (!patch) continue
      for (const edge of patch.add_edges) {
        if (!edge.edgeType || edge.edgeType === 'prereq') continue
        if (!hasNode(edge.source) || !hasNode(edge.target)) continue

        const status = getResearchSuggestionStatus({ store: suggestionsStore, type: 'edge', key: researchEdgeKey(edge) })
        if (status === 'excluded') continue

        const key = `${edge.edgeType}\u0000${edge.source}\u0000${edge.target}`
        if (merged.has(key)) continue
        merged.set(key, { edgeType: edge.edgeType, source: edge.source, target: edge.target })
      }
    }

    return Array.from(merged.values())
  }, [inspectableNodeById, patchesByTrack, state, suggestionsStore])

  const alignsToBySource = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const edge of mergedNonPrereqEdges) {
      if (edge.edgeType !== 'alignsTo') continue
      const bucket = map.get(edge.source)
      if (bucket) {
        bucket.push(edge.target)
      } else {
        map.set(edge.source, [edge.target])
      }
    }
    return map
  }, [mergedNonPrereqEdges])

  const nodeTypeById = useMemo(() => {
    const map = new Map<string, string>()
    if (state.status === 'ready') {
      for (const node of state.graph.nodes) {
        map.set(node.id, node.nodeType)
      }
    }
    for (const node of proposedNodes) {
      map.set(node.id, node.nodeType)
    }
    return map
  }, [proposedNodes, state])

  const nodeLabelById = useMemo(() => {
    const map = new Map<string, string>()
    if (state.status === 'ready') {
      for (const node of state.graph.nodes) {
        map.set(node.id, node.label)
      }
    }
    for (const node of proposedNodes) {
      map.set(node.id, node.label)
    }
    return map
  }, [proposedNodes, state])

  const domainLabelByCode = useMemo(() => {
    const map = new Map<DomainLayerCode, string>()
    for (const code of DOMAIN_LAYER_ORDER) {
      map.set(code, DOMAIN_LABEL_DEFAULT[code])
    }
    map.set(DOMAIN_LAYER_FALLBACK, '기타/미분류')

    if (state.status !== 'ready') return map

    for (const node of state.graph.nodes) {
      if (node.nodeType !== 'domain') continue
      const code = normalizeDomainCode((node as { domainCode?: unknown }).domainCode)
      if (code === DOMAIN_LAYER_FALLBACK) continue
      map.set(code, node.label)
    }
    return map
  }, [state])

  const domainCodeById = useMemo(() => {
    const map = new Map<string, DomainLayerCode>()
    if (state.status !== 'ready') {
      for (const node of proposedNodes) {
        map.set(node.id, normalizeDomainCode((node as { domainCode?: unknown }).domainCode))
      }
      return map
    }

    const idToNode = new Map(state.graph.nodes.map((node) => [node.id, node] as const))
    for (const node of proposedNodes) {
      if (!idToNode.has(node.id)) {
        idToNode.set(node.id, node)
      }
    }

    const cache = new Map<string, DomainLayerCode>()
    const resolveDomainCode = (id: string): DomainLayerCode => {
      const cached = cache.get(id)
      if (cached) return cached

      const node = idToNode.get(id)
      if (!node) {
        cache.set(id, DOMAIN_LAYER_FALLBACK)
        return DOMAIN_LAYER_FALLBACK
      }

      const ownCode = normalizeDomainCode((node as { domainCode?: unknown }).domainCode)
      if (ownCode !== DOMAIN_LAYER_FALLBACK) {
        cache.set(id, ownCode)
        return ownCode
      }

      const parentId = typeof (node as { parentId?: unknown }).parentId === 'string' ? node.parentId : null
      const parentCode = parentId ? resolveDomainCode(parentId) : DOMAIN_LAYER_FALLBACK
      cache.set(id, parentCode)
      return parentCode
    }

    for (const id of idToNode.keys()) {
      map.set(id, resolveDomainCode(id))
    }
    return map
  }, [proposedNodes, state])

  const domainOptions = useMemo(() => {
    const codes = new Set<DomainLayerCode>([...DOMAIN_LAYER_ORDER, DOMAIN_LAYER_FALLBACK])
    for (const code of domainCodeById.values()) {
      codes.add(code)
    }
    const orderedCodes = sortDomainCodes(codes)
    return orderedCodes.map((code) => ({ code, label: domainLabelByCode.get(code) ?? code }))
  }, [domainCodeById, domainLabelByCode])

  const visibleDomainCodeSet = useMemo(() => {
    return new Set(visibleDomainCodes.map((code) => normalizeDomainCode(code)))
  }, [visibleDomainCodes])

  const handleToggleDomainCode = useCallback((code: DomainLayerCode) => {
    setVisibleDomainCodes((prev) => {
      const normalized = normalizeDomainCode(code)
      if (prev.includes(normalized)) {
        return sortDomainCodes(prev.filter((value) => value !== normalized))
      }
      return sortDomainCodes([...prev, normalized])
    })
  }, [])

  const handleShowAllDomains = useCallback(() => {
    setVisibleDomainCodes(sortDomainCodes([...DOMAIN_LAYER_ORDER, DOMAIN_LAYER_FALLBACK]))
  }, [])

  const handleShowOnlyDomain = useCallback((code: DomainLayerCode) => {
    setVisibleDomainCodes([normalizeDomainCode(code)])
  }, [])

  const handleToggleGradeBand = useCallback((band: string) => {
    setVisibleGradeBands((prev) => {
      if (prev.length === 0) {
        // Currently showing all, switch to showing all except this one
        return [] // This case is handled differently - we'll show only this one
      }
      if (prev.includes(band)) {
        const next = prev.filter((b) => b !== band)
        return next.length === 0 ? [] : next
      }
      return [...prev, band].sort(compareGradeBand)
    })
  }, [])

  const handleShowAllGradeBands = useCallback(() => {
    setVisibleGradeBands([])
  }, [])

  const handleShowOnlyGradeBand = useCallback((band: string) => {
    setVisibleGradeBands([band])
  }, [])

  const handleToggleEdgeType = useCallback((edgeType: string) => {
    setEditorVisibleEdgeTypes((prev) => {
      if (prev.includes(edgeType)) return prev.filter((t) => t !== edgeType)
      return [...prev, edgeType]
    })
  }, [])

  const handleShowOnlyEdgeType = useCallback((edgeType: string) => {
    setEditorVisibleEdgeTypes(normalizeEditorEdgeTypes([edgeType]))
  }, [])

  const handleShowAllEdgeTypes = useCallback(() => {
    setEditorVisibleEdgeTypes(getEditorDefaultEdgeTypes())
  }, [])

  const allNodes = useMemo(() => {
    if (state.status !== 'ready') return []

    const nodeMap = new Map<
      string,
      { id: string; nodeType: string; label: string; proposed?: boolean; note?: string; reason?: string; gradeBand?: string }
    >()
    for (const node of state.graph.nodes) {
      nodeMap.set(node.id, node)
    }
    for (const node of proposedNodes) {
      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, node)
      }
    }
    return Array.from(nodeMap.values())
  }, [proposedNodes, state])

  const gradeBandOptions = useMemo(() => {
    const bands = new Set<string>()
    for (const node of allNodes) {
      if (node.gradeBand) {
        bands.add(node.gradeBand)
      }
    }
    return Array.from(bands).sort(compareGradeBand)
  }, [allNodes])

  const handleShowSchoolLevel = useCallback(
    (level: 'E' | 'M' | 'H') => {
      const bands = gradeBandOptions.filter((band) => gradeBandSchoolLevel(band) === level)
      setVisibleGradeBands(bands)
    },
    [gradeBandOptions]
  )

  const visibleGradeBandSet = useMemo(() => {
    // Empty array means all visible
    if (visibleGradeBands.length === 0) return null
    return new Set(visibleGradeBands)
  }, [visibleGradeBands])

  const effectiveVisibleEdgeTypes = useMemo(() => {
    return getEffectiveEdgeTypes({ mode: viewMode, editorEdgeTypes: editorVisibleEdgeTypes })
  }, [editorVisibleEdgeTypes, viewMode])

  const editorVisibleEdgeTypeSet = useMemo(() => {
    return new Set(editorVisibleEdgeTypes)
  }, [editorVisibleEdgeTypes])

  const visibleEdgeTypeSet = useMemo(() => {
    return new Set(effectiveVisibleEdgeTypes)
  }, [effectiveVisibleEdgeTypes])

  const currentPrereqEdges = useMemo(() => {
    if (!editState) return []
    return listCurrentPrereqEdges(editState).filter(
      (edge) => nodeTypeById.has(edge.source) && nodeTypeById.has(edge.target)
    )
  }, [editState, nodeTypeById])

  // Calculate depth for ALL nodes first (before domain filtering)
  const allPrereqEdgesForDepth = useMemo(() => {
    const map = new Map<string, PrereqEdge>()
    for (const edge of currentPrereqEdges) {
      map.set(`${edge.source}\u0000${edge.target}`, { source: edge.source, target: edge.target })
    }

    for (const track of RESEARCH_TRACKS) {
      const patch = patchesByTrack[track]
      if (!patch) continue
      for (const edge of patch.add_edges) {
        if (edge.edgeType && edge.edgeType !== 'prereq') continue
        const status = getResearchSuggestionStatus({
          store: suggestionsStore,
          type: 'edge',
          key: researchEdgeKey(edge)
        })
        if (status === 'excluded') continue
        map.set(`${edge.source}\u0000${edge.target}`, { source: edge.source, target: edge.target })
      }
    }

    return Array.from(map.values())
  }, [currentPrereqEdges, patchesByTrack, suggestionsStore])

  // Compute depth for all nodes
  const allNodesDepthById = useMemo(() => {
    return computePrereqDepths(
      allNodes.map((node) => node.id),
      allPrereqEdgesForDepth
    )
  }, [allNodes, allPrereqEdgesForDepth])

  // Available depth range
  const availableDepthRange = useMemo(() => {
    let min = Infinity
    let max = 0
    for (const depth of allNodesDepthById.values()) {
      if (depth < min) min = depth
      if (depth > max) max = depth
    }
    if (min === Infinity) min = 1
    if (max === 0) max = 1
    return { min, max }
  }, [allNodesDepthById])

  const visibleNodes = useMemo(() => {
    if (state.status !== 'ready') return []
    if (visibleDomainCodeSet.size === 0) return []
    return allNodes.filter((node) => {
      const domainCode = domainCodeById.get(node.id) ?? DOMAIN_LAYER_FALLBACK
      if (!visibleDomainCodeSet.has(domainCode)) return false
      const depth = allNodesDepthById.get(node.id) ?? 1
      if (depth < visibleDepthRange.min || depth > visibleDepthRange.max) return false
      // Grade band filter (null means all visible)
      if (visibleGradeBandSet !== null) {
        const gradeBand = node.gradeBand ?? '__unspecified__'
        if (!visibleGradeBandSet.has(gradeBand) && !visibleGradeBandSet.has('__unspecified__')) {
          // If no gradeBand and __unspecified__ is not selected, hide
          if (!node.gradeBand) return false
          // If has gradeBand but not in the set, hide
          if (!visibleGradeBandSet.has(gradeBand)) return false
        }
      }
      return true
    })
  }, [allNodes, allNodesDepthById, domainCodeById, state, visibleDomainCodeSet, visibleDepthRange, visibleGradeBandSet])

  const visibleNodeIdSet = useMemo(() => {
    return new Set(visibleNodes.map((node) => node.id))
  }, [visibleNodes])

  const hoverEdgeRefs = useMemo((): HoverEdgeRef[] => {
    const out: HoverEdgeRef[] = []

    for (const edge of mergedNonPrereqEdges) {
      if (edge.edgeType === 'contains' || edge.edgeType === 'alignsTo') {
        if (!visibleEdgeTypeSet.has(edge.edgeType)) continue
      }
      if (!visibleNodeIdSet.has(edge.source) || !visibleNodeIdSet.has(edge.target)) continue
      out.push({
        id: edge.id ?? `${edge.edgeType}:${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target
      })
    }

    if (visibleEdgeTypeSet.has('prereq')) {
      for (const edge of currentPrereqEdges) {
        if (!visibleNodeIdSet.has(edge.source) || !visibleNodeIdSet.has(edge.target)) continue
        out.push({
          id: `prereq:${edge.source}->${edge.target}`,
          source: edge.source,
          target: edge.target
        })
      }
    }

    return out
  }, [currentPrereqEdges, mergedNonPrereqEdges, visibleEdgeTypeSet, visibleNodeIdSet])

  const hoverHighlight = useMemo((): HoverHighlight | null => {
    if (!hoveredNodeId) return null
    if (!visibleNodeIdSet.has(hoveredNodeId)) return null

    const nodeIds = new Set<string>([hoveredNodeId])
    const edgeIds = new Set<string>()

    for (const edge of hoverEdgeRefs) {
      if (edge.source !== hoveredNodeId && edge.target !== hoveredNodeId) continue
      edgeIds.add(edge.id)
      nodeIds.add(edge.source)
      nodeIds.add(edge.target)
    }

    return { nodeIds, edgeIds }
  }, [hoverEdgeRefs, hoveredNodeId, visibleNodeIdSet])

  useEffect(() => {
    if (!hoveredNodeId) return
    if (!visibleNodeIdSet.has(hoveredNodeId)) {
      setHoveredNodeId(null)
    }
  }, [hoveredNodeId, visibleNodeIdSet])

  useEffect(() => {
    if (!inspectedNodeId) return
    if (!visibleNodeIdSet.has(inspectedNodeId)) {
      setInspectedNodeId(null)
    }
  }, [inspectedNodeId, visibleNodeIdSet])

  useEffect(() => {
    if (!inspectedNodeId) {
      hoverPanelActiveRef.current = false
    }
  }, [inspectedNodeId])

  const inspectedPanel = useMemo(() => {
    if (!inspectedNodeId) return null
    if (!visibleNodeIdSet.has(inspectedNodeId)) return null

    const node = inspectableNodeById.get(inspectedNodeId)
    if (!node) return null

    const depth = allNodesDepthById.get(inspectedNodeId) ?? null
    const domainCode = domainCodeById.get(inspectedNodeId) ?? DOMAIN_LAYER_FALLBACK
    const domainLabel = domainLabelByCode.get(domainCode) ?? domainCode
    const gradeBand = node.gradeBand ?? null

    const alignedAchievementIds =
      node.nodeType === 'textbookUnit' ? alignsToBySource.get(inspectedNodeId) ?? [] : []

    const alignedAchievements = alignedAchievementIds
      .map((id) => inspectableNodeById.get(id))
      .filter((item): item is InspectableNode => item !== undefined && item.nodeType === 'achievement')

    const goals =
      node.nodeType === 'textbookUnit'
        ? alignedAchievements.map((achievement) => ({
            id: achievement.id,
            label: achievement.label,
            text: achievement.text ?? null
          }))
        : node.nodeType === 'achievement'
          ? [
              {
                id: node.id,
                label: node.label,
                text: node.text ?? null
              }
            ]
          : []

    const note = node.note ?? node.reason ?? null

    const examplePrompts: ExamplePrompt[] = []
    if (problemBank2022) {
      if (node.nodeType === 'achievement') {
        const problems = problemBank2022.problemsByNodeId[node.id] ?? []
        for (const problem of problems.slice(0, 2)) {
          examplePrompts.push({ nodeId: node.id, prompt: problem.prompt })
        }
      } else if (node.nodeType === 'textbookUnit') {
        for (const achievement of alignedAchievements) {
          const problems = problemBank2022.problemsByNodeId[achievement.id] ?? []
          if (problems.length === 0) continue
          examplePrompts.push({ nodeId: achievement.id, prompt: problems[0].prompt })
          if (examplePrompts.length >= 2) break
        }
      }
    }

    return {
      node,
      depth,
      domainCode,
      domainLabel,
      gradeBand,
      goals,
      alignedAchievementCount: alignedAchievements.length,
      note,
      examplePrompts
    }
  }, [
    alignsToBySource,
    allNodesDepthById,
    domainCodeById,
    domainLabelByCode,
    inspectableNodeById,
    inspectedNodeId,
    problemBank2022,
    visibleNodeIdSet
  ])

  const depthPrereqEdges = useMemo(() => {
    return allPrereqEdgesForDepth.filter(
      (edge) => visibleNodeIdSet.has(edge.source) && visibleNodeIdSet.has(edge.target)
    )
  }, [allPrereqEdgesForDepth, visibleNodeIdSet])

  const prereqCycle = useMemo(() => {
    const edges = depthPrereqEdges.map((edge) => ({ source: edge.source, target: edge.target }))
    return detectPrereqCycle(edges)
  }, [depthPrereqEdges])

  const nodes = useMemo((): Node[] => {
    if (state.status !== 'ready') return []
    if (visibleNodes.length === 0) return []

    const hoverNodeIds = hoverHighlight?.nodeIds ?? null
    const hoverActive = Boolean(hoveredNodeId && hoverNodeIds)
    const decorateNodeStyle = (id: string, style: CSSProperties): CSSProperties => {
      if (!hoverActive || !hoverNodeIds) return style

      if (!hoverNodeIds.has(id)) {
        return { ...style, opacity: 0.18 }
      }

      const isPrimary = id === hoveredNodeId
      return {
        ...style,
        opacity: 1,
        zIndex: isPrimary ? 10 : 5,
        outline: isPrimary ? '3px solid #f97316' : '2px solid rgba(249, 115, 22, 0.55)',
        outlineOffset: 2,
        ...(isPrimary ? { boxShadow: 'var(--shadow-glow-primary)' } : {})
      }
    }

    // Use pre-calculated depth from allNodesDepthById
    const depthById = allNodesDepthById

    const nodesByDomain = new Map<DomainLayerCode, typeof visibleNodes>()
    for (const node of visibleNodes) {
      const domainCode = domainCodeById.get(node.id) ?? DOMAIN_LAYER_FALLBACK
      const bucket = nodesByDomain.get(domainCode)
      if (bucket) {
        bucket.push(node)
      } else {
        nodesByDomain.set(domainCode, [node])
      }
    }

    const domainCodes = sortDomainCodes(nodesByDomain.keys())
    const layeredNodes: Node[] = []
    const DOMAIN_HEADER_HEIGHT = 36
    const DOMAIN_HEADER_GAP_Y = 12
    const DEPTH_HEADER_HEIGHT = 28
    const DEPTH_HEADER_GAP_Y = 10
    let yOffset = 0

    for (const domainCode of domainCodes) {
      const domainNodes = nodesByDomain.get(domainCode)
      if (!domainNodes || domainNodes.length === 0) continue

      const domainLabel = domainLabelByCode.get(domainCode) ?? domainCode
      const headerId = `__domain_header_${domainCode}`
      layeredNodes.push({
        id: headerId,
        position: { x: 0, y: yOffset },
        data: {
          label: (
            <div style={{ fontWeight: 700 }}>
              {domainLabel} <span className="mono">({domainCode})</span>
            </div>
          )
        },
        style: decorateNodeStyle(headerId, {
          width: NODE_WIDTH,
          height: DOMAIN_HEADER_HEIGHT,
          padding: 10,
          borderRadius: 12,
          border: '1px solid #0f172a',
          background: '#0f172a',
          color: '#f8fafc'
        }),
        draggable: false,
        selectable: false,
        connectable: false
      })

      const maxDepth = domainNodes.reduce((max, node) => Math.max(max, depthById.get(node.id) ?? 1), 1)
      const depthHeaderY = yOffset + DOMAIN_HEADER_HEIGHT + DOMAIN_HEADER_GAP_Y

      if (viewMode === 'editor') {
        for (let depth = 1; depth <= maxDepth; depth += 1) {
          layeredNodes.push({
            id: `__domain_depth_${domainCode}_${depth}`,
            position: {
              x: (depth - 1) * (NODE_WIDTH + GRID_GAP_X),
              y: depthHeaderY
            },
            data: {
              label: (
                <div className="mono" style={{ fontWeight: 700 }}>
                  depth {depth}
                </div>
              )
            },
            style: decorateNodeStyle(`__domain_depth_${domainCode}_${depth}`, {
              width: NODE_WIDTH,
              height: DEPTH_HEADER_HEIGHT,
              padding: 8,
              borderRadius: 10,
              border: '1px solid #0f172a',
              background: '#e2e8f0',
              color: '#0f172a'
            }),
            draggable: false,
            selectable: false,
            connectable: false
          })
        }
      }

      let domainYOffset =
        viewMode === 'editor'
          ? depthHeaderY + DEPTH_HEADER_HEIGHT + DEPTH_HEADER_GAP_Y
          : yOffset + DOMAIN_HEADER_HEIGHT + DOMAIN_HEADER_GAP_Y

      const groupedByBand = new Map<string, typeof domainNodes>()
      for (const node of domainNodes) {
        const band = node.gradeBand ?? '__unspecified__'
        const bucket = groupedByBand.get(band)
        if (bucket) {
          bucket.push(node)
        } else {
          groupedByBand.set(band, [node])
        }
      }

      const bandKeys = Array.from(groupedByBand.keys())
        .filter((key) => key !== '__unspecified__')
        .sort(compareGradeBand)
      if (groupedByBand.has('__unspecified__')) {
        bandKeys.push('__unspecified__')
      }

      for (const band of bandKeys) {
        const bandNodes = groupedByBand.get(band)
        if (!bandNodes || bandNodes.length === 0) continue

        const ordered = [...bandNodes].sort((a, b) => {
          const depthDiff = (depthById.get(a.id) ?? 1) - (depthById.get(b.id) ?? 1)
          if (depthDiff !== 0) return depthDiff
          return a.id.localeCompare(b.id)
        })

        ordered.forEach((node, index) => {
          const depth = depthById.get(node.id) ?? 1
          const description = node.note ?? node.reason

          layeredNodes.push({
            id: node.id,
            position: {
              x: (depth - 1) * (NODE_WIDTH + GRID_GAP_X),
              y: domainYOffset + index * (NODE_HEIGHT + GRID_GAP_Y)
            },
            data: {
              label: buildResearchNodeLabel({
                mode: viewMode,
                nodeType: node.nodeType,
                depth,
                label: node.label,
                id: node.id,
                proposed: Boolean(node.proposed),
                description
              })
            },
            style: decorateNodeStyle(node.id, {
              width: NODE_WIDTH,
              padding: 10,
              borderRadius: 12,
              color: '#0f172a',
              ...getNodeStyle(node.nodeType, Boolean(node.proposed))
            })
          })
        })

        domainYOffset += ordered.length * (NODE_HEIGHT + GRID_GAP_Y) + GRADE_BAND_GAP_Y
      }

      yOffset = domainYOffset + DOMAIN_LAYER_GAP_Y
    }

    return layeredNodes
  }, [allNodesDepthById, domainCodeById, domainLabelByCode, hoverHighlight, hoveredNodeId, state, viewMode, visibleNodes])

  const edges = useMemo((): Edge[] => {
    if (state.status !== 'ready') return []

    const hoverEdgeIds = hoverHighlight?.edgeIds ?? null
    const hoverActive = Boolean(hoveredNodeId && hoverEdgeIds)
    const decorateEdgeStyle = (edgeId: string, style: CSSProperties): CSSProperties => {
      if (!hoverActive || !hoverEdgeIds) return style

      const baseOpacity = typeof style.opacity === 'number' ? style.opacity : 1
      const baseStrokeWidth = typeof style.strokeWidth === 'number' ? style.strokeWidth : 1.5

      if (hoverEdgeIds.has(edgeId)) {
        return {
          ...style,
          opacity: 1,
          strokeWidth: baseStrokeWidth + 1.5,
          zIndex: 10
        }
      }

      return {
        ...style,
        opacity: Math.min(0.08, baseOpacity * 0.12),
        zIndex: 1
      }
    }

    const decorateForDomain = (style: Record<string, unknown>, source: string, target: string) => {
      const sourceDomain = domainCodeById.get(source) ?? DOMAIN_LAYER_FALLBACK
      const targetDomain = domainCodeById.get(target) ?? DOMAIN_LAYER_FALLBACK
      if (sourceDomain === targetDomain) return style
      return {
        ...style,
        strokeDasharray: '6 4',
        opacity: 0.7
      }
    }

    const shouldShowNonPrereqEdge = (edgeType: string) => {
      return isEdgeTypeVisibleInMode({
        mode: viewMode,
        edgeType,
        editorEdgeTypeSet: editorVisibleEdgeTypeSet
      })
    }

    const showEdgeLabels = shouldShowEdgeLabels(viewMode)

    const nonPrereq =
      viewMode === 'overview'
        ? []
        : mergedNonPrereqEdges
            .filter((edge) => visibleNodeIdSet.has(edge.source) && visibleNodeIdSet.has(edge.target))
            .filter((edge) => shouldShowNonPrereqEdge(edge.edgeType))
            .map((edge) => {
              const baseStyle = getEdgeStyle(edge.edgeType)
              const domainStyle = decorateForDomain({ ...baseStyle }, edge.source, edge.target) as CSSProperties
              const id = edge.id ?? `${edge.edgeType}:${edge.source}->${edge.target}`
              const dimLabel = hoverActive && hoverEdgeIds && !hoverEdgeIds.has(id)
              return {
                id,
                source: edge.source,
                target: edge.target,
                type: 'smoothstep',
                label: getEdgeLabelForMode({ mode: viewMode, edgeType: edge.edgeType }),
                data: { edgeType: edge.edgeType },
                style: decorateEdgeStyle(id, domainStyle),
                labelStyle: showEdgeLabels
                  ? {
                      fill: (domainStyle.stroke as string) ?? '#64748b',
                      fontSize: 12,
                      ...(dimLabel ? { opacity: 0 } : {})
                    }
                  : undefined
              }
            })

    const prereq = visibleEdgeTypeSet.has('prereq')
      ? currentPrereqEdges
          .filter((edge) => visibleNodeIdSet.has(edge.source) && visibleNodeIdSet.has(edge.target))
          .map((edge) => {
            const origin =
              edge.origin === 'base' ? 'existing' : edge.origin === 'research' ? 'research' : 'manual'
            const baseStyle = getEdgeStyle('prereq', { prereqOrigin: origin })
            const domainStyle = decorateForDomain({ ...baseStyle }, edge.source, edge.target) as CSSProperties
            const id = `prereq:${edge.source}->${edge.target}`
            const dimLabel = hoverActive && hoverEdgeIds && !hoverEdgeIds.has(id)
            return {
              id,
              source: edge.source,
              target: edge.target,
              type: 'smoothstep',
              label: getEdgeLabelForMode({ mode: viewMode, edgeType: 'prereq' }),
              data: { edgeType: 'prereq', origin: edge.origin },
              style: decorateEdgeStyle(id, domainStyle),
              labelStyle: showEdgeLabels
                ? {
                    fill: (domainStyle.stroke as string) ?? '#64748b',
                    fontSize: 12,
                    ...(dimLabel ? { opacity: 0 } : {})
                  }
                : undefined
            }
          })
      : []

    return [...nonPrereq, ...prereq]
  }, [
    currentPrereqEdges,
    domainCodeById,
    editorVisibleEdgeTypeSet,
    hoverHighlight,
    hoveredNodeId,
    mergedNonPrereqEdges,
    state,
    viewMode,
    visibleEdgeTypeSet,
    visibleNodeIdSet
  ])

  const counts = useMemo(() => {
    if (state.status !== 'ready') return null
    const textbookUnitCount =
      state.graph.nodes.filter((node) => node.nodeType === 'textbookUnit').length +
      proposedNodes.filter((node) => node.nodeType === 'textbookUnit').length
    const visibleTextbookUnitCount = visibleNodes.filter((node) => node.nodeType === 'textbookUnit').length
    const prereqCounts = currentPrereqEdges.reduce(
      (acc, edge) => {
        acc.total += 1
        acc[edge.origin] += 1
        return acc
      },
      { total: 0, base: 0, research: 0, manual: 0 }
    )
    const visiblePrereqCounts = currentPrereqEdges
      .filter((edge) => visibleNodeIdSet.has(edge.source) && visibleNodeIdSet.has(edge.target))
      .reduce(
        (acc, edge) => {
          acc.total += 1
          acc[edge.origin] += 1
          return acc
        },
        { total: 0, base: 0, research: 0, manual: 0 }
      )
    return {
      nodes: state.graph.nodes.length,
      visibleNodes: visibleNodes.length,
      edges: state.graph.edges.length,
      visibleEdges: edges.length,
      textbookUnits: textbookUnitCount,
      visibleTextbookUnits: visibleTextbookUnitCount,
      prereq: prereqCounts,
      visiblePrereq: visiblePrereqCounts
    }
  }, [currentPrereqEdges, edges, proposedNodes, state, visibleNodeIdSet, visibleNodes])

  const activePatch = patchesByTrack[activeTrack]
  const activePatchError = patchErrorsByTrack[activeTrack]

  const nodeSuggestions = useMemo(() => {
    const nodes = activePatch?.add_nodes ?? []
    return nodes.map((node) => ({
      node,
      status: getResearchSuggestionStatus({ store: suggestionsStore, type: 'node', key: node.id })
    }))
  }, [activePatch, suggestionsStore])

  const edgeSuggestions = useMemo(() => {
    const edges = activePatch?.add_edges ?? []
    return edges.map((edge) => ({
      edge,
      status: getResearchSuggestionStatus({ store: suggestionsStore, type: 'edge', key: researchEdgeKey(edge) })
    }))
  }, [activePatch, suggestionsStore])

  const suggestionStats = useMemo(() => {
    const nodeStats = { total: nodeSuggestions.length, accepted: 0, excluded: 0, pending: 0 }
    const edgeStats = { total: edgeSuggestions.length, accepted: 0, excluded: 0, pending: 0 }
    for (const item of nodeSuggestions) {
      nodeStats[item.status] += 1
    }
    for (const item of edgeSuggestions) {
      edgeStats[item.status] += 1
    }
    return { nodes: nodeStats, edges: edgeStats }
  }, [edgeSuggestions, nodeSuggestions])

  const handleExportPatch = useCallback(() => {
    if (state.status !== 'ready' || !editState) return
    const patch = buildPatchExport({
      baseNodeIds,
      editState,
      proposedNodes
    })
    setExportJson(JSON.stringify(patch, null, 2))
  }, [baseNodeIds, editState, proposedNodes, state])

  const renderStatusBadge = (status: ResearchSuggestionStatus) => {
    if (status === 'accepted') {
      return <span className="badge badge-ok">수용됨</span>
    }
    if (status === 'excluded') {
      return <span className="badge badge-warn">제외됨</span>
    }
    return <span className="badge">보류</span>
  }

  const formatConfidence = (value: number | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return `${Math.round(value * 100)}%`
  }

  return (
    <section>
      <h1>Research Graph Editor</h1>
      <p className="muted">2022 그래프 기본 렌더링 (React Flow)</p>

      {counts ? (
        <p className="muted">
          nodes: {counts.visibleNodes}/{counts.nodes} · edges: {counts.visibleEdges}/{counts.edges} · textbookUnit:{' '}
          {counts.visibleTextbookUnits}/{counts.textbookUnits}
        </p>
      ) : null}

      {editState ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <label className="graph-control">
            Research track
            <select
              value={activeTrack}
              onChange={(event) => setActiveTrack(event.target.value as ResearchTrack)}
            >
              <option value="T1">T1</option>
              <option value="T2">T2</option>
              <option value="T3">T3</option>
            </select>
          </label>
          <div className="graph-control" style={{ minWidth: 180 }}>
            <div className="mono" style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
              View mode
            </div>
            <ResearchGraphModeToggle mode={viewMode} onChange={setViewMode} disabled={state.status !== 'ready'} />
          </div>
          <div className="graph-control" style={{ minWidth: 320 }}>
            <div className="mono" style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
              Domain layers
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {domainOptions.map((option) => {
                const checked = visibleDomainCodeSet.has(option.code)
                return (
                  <div key={`domain-${option.code}`} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleDomainCode(option.code)}
                      />
                      <span>{option.label}</span>
                    </label>
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => handleShowOnlyDomain(option.code)}
                      title={`${option.label}만 보기`}
                    >
                      only
                    </button>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 6 }}>
              <button type="button" className="button button-ghost button-small" onClick={handleShowAllDomains}>
                all
              </button>
            </div>
          </div>
          <div className="graph-control" style={{ minWidth: 200 }}>
            <div className="mono" style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
              Depth filter (1-{availableDepthRange.max})
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span>min</span>
                <input
                  type="number"
                  min={1}
                  max={availableDepthRange.max}
                  value={visibleDepthRange.min}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(Number(e.target.value), visibleDepthRange.max))
                    setVisibleDepthRange((prev) => ({ ...prev, min: val }))
                  }}
                  style={{ width: 50 }}
                />
              </label>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span>max</span>
                <input
                  type="number"
                  min={1}
                  max={availableDepthRange.max}
                  value={Math.min(visibleDepthRange.max, availableDepthRange.max)}
                  onChange={(e) => {
                    const val = Math.max(visibleDepthRange.min, Math.min(Number(e.target.value), availableDepthRange.max))
                    setVisibleDepthRange((prev) => ({ ...prev, max: val }))
                  }}
                  style={{ width: 50 }}
                />
              </label>
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => setVisibleDepthRange({ min: 1, max: availableDepthRange.max })}
              >
                reset
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {Array.from({ length: availableDepthRange.max }, (_, i) => i + 1).map((depth) => (
                <button
                  key={`depth-${depth}`}
                  type="button"
                  className={`button button-small ${
                    visibleDepthRange.min === depth && visibleDepthRange.max === depth
                      ? 'button-primary'
                      : 'button-ghost'
                  }`}
                  onClick={() => setVisibleDepthRange({ min: depth, max: depth })}
                  title={`depth ${depth}만 보기`}
                >
                  {depth}
                </button>
              ))}
            </div>
          </div>
          {gradeBandOptions.length > 0 ? (
            <div className="graph-control" style={{ minWidth: 200 }}>
              <div className="mono" style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                학년 필터
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={() => handleShowSchoolLevel('E')}
                  title="초등 학년군만 보기"
                >
                  초등
                </button>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={() => handleShowSchoolLevel('M')}
                  title="중등 학년군만 보기"
                >
                  중등
                </button>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={() => handleShowSchoolLevel('H')}
                  title="고등 학년군만 보기"
                >
                  고등
                </button>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={handleShowAllGradeBands}
                  title="전체 학년군 보기"
                >
                  all
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {gradeBandOptions.map((band) => {
                  const isAllVisible = visibleGradeBands.length === 0
                  const checked = isAllVisible || visibleGradeBands.includes(band)
                  const label = formatGradeBandLabel(band)
                  return (
                    <div key={`grade-${band}`} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (isAllVisible) {
                              // Currently all visible, switch to only this one
                              handleShowOnlyGradeBand(band)
                            } else {
                              handleToggleGradeBand(band)
                            }
                          }}
                        />
                        <span title={band}>{label}</span>
                      </label>
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => handleShowOnlyGradeBand(band)}
                        title={`${label}만 보기`}
                      >
                        only
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
          {viewMode === 'editor' ? (
            <div className="graph-control" style={{ minWidth: 260 }}>
            <div className="mono" style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
              Edge filter
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={visibleEdgeTypeSet.has('contains')}
                  onChange={() => handleToggleEdgeType('contains')}
                />
                <span className="legend-item" title="구조(소속/포함) 관계">
                  <span className="legend-inline contains" /> contains
                </span>
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={visibleEdgeTypeSet.has('alignsTo')}
                  onChange={() => handleToggleEdgeType('alignsTo')}
                />
                <span className="legend-item" title="단원 ↔ 성취기준 연결">
                  <span className="legend-inline alignsTo" /> alignsTo
                </span>
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={visibleEdgeTypeSet.has('prereq')}
                  onChange={() => handleToggleEdgeType('prereq')}
                />
                <span className="legend-item" title="선수(선행학습) 관계">
                  <span className="legend-inline prereq" /> prereq
                </span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => handleShowOnlyEdgeType('prereq')}
                title="prereq만 보기"
              >
                prereq only
              </button>
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={handleShowAllEdgeTypes}
                title="전체 엣지 보기"
              >
                all
              </button>
            </div>
            </div>
          ) : null}
          {viewMode === 'editor' ? (
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                setShowAddProposed((prev) => !prev)
                setProposedError(null)
              }}
            >
              Proposed 노드 추가
            </button>
          ) : null}
          {viewMode === 'editor' ? (
            <button type="button" className="button button-primary" onClick={handleExportPatch}>
              Export JSON
            </button>
          ) : null}
          {viewMode === 'editor' ? (
            <div className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
              prereq: {counts?.visiblePrereq.total ?? 0}/{counts?.prereq.total ?? 0} (existing{' '}
              {counts?.visiblePrereq.base ?? 0}/{counts?.prereq.base ?? 0} / research {counts?.visiblePrereq.research ?? 0}/
              {counts?.prereq.research ?? 0} / manual {counts?.visiblePrereq.manual ?? 0}/{counts?.prereq.manual ?? 0}) |
              changes: +{editState.added.length} / -{editState.removed.length}
            </div>
          ) : null}
        </div>
      ) : null}

      {state.status === 'loading' ? <p>Loading…</p> : null}
      {state.status === 'error' ? <p className="error">{state.message}</p> : null}
      {patchLoading ? <p className="muted">research patch loading…</p> : null}
      {activePatchError ? (
        <p className="error">
          Failed to load {activeTrack} patch: {activePatchError}
        </p>
      ) : null}
      {message ? <p className="error">{message}</p> : null}
      {proposedError ? <p className="error">{proposedError}</p> : null}
      {prereqCycle.hasCycle && prereqCycle.path ? (
        <p role="alert" style={{ color: '#d97706' }}>
          prereq cycle detected: {prereqCycle.path.join(' → ')}
        </p>
      ) : null}

      {viewMode === 'editor' ? (
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 12,
            background: '#f8fafc',
            marginBottom: 12
          }}
        >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <strong>Research Suggestions</strong>
          <span className="mono" style={{ fontSize: 12, opacity: 0.75 }}>
            nodes {suggestionStats.nodes.total} (accepted {suggestionStats.nodes.accepted} / excluded{' '}
            {suggestionStats.nodes.excluded} / pending {suggestionStats.nodes.pending}) · edges{' '}
            {suggestionStats.edges.total} (accepted {suggestionStats.edges.accepted} / excluded {suggestionStats.edges.excluded}{' '}
            / pending {suggestionStats.edges.pending})
          </span>
        </div>

        {!activePatch && patchLoading ? <p className="muted">패치 로딩 중…</p> : null}
        {!activePatch && !patchLoading ? <p className="muted">선택된 트랙의 패치가 없습니다.</p> : null}

        {activePatch ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <h3 style={{ margin: '4px 0 8px' }}>Nodes</h3>
              {nodeSuggestions.length === 0 ? <p className="muted">제안된 노드가 없습니다.</p> : null}
              {nodeSuggestions.map(({ node, status }) => (
                <div
                  key={`node-${node.id}`}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: 10,
                    background: '#ffffff',
                    marginBottom: 8
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{node.label}</div>
                      <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                        {node.id}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {renderStatusBadge(status)}
                      <button
                        type="button"
                        className="button button-primary button-small"
                        disabled={status === 'accepted'}
                        onClick={() =>
                          setSuggestionStatus({ type: 'node', key: node.id, status: 'accepted' })
                        }
                      >
                        수용
                      </button>
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        disabled={status === 'excluded'}
                        onClick={() =>
                          setSuggestionStatus({ type: 'node', key: node.id, status: 'excluded' })
                        }
                      >
                        제외
                      </button>
                    </div>
                  </div>
                  {node.reason ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {node.reason}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div>
              <h3 style={{ margin: '4px 0 8px' }}>Edges</h3>
              {edgeSuggestions.length === 0 ? <p className="muted">제안된 엣지가 없습니다.</p> : null}
              {edgeSuggestions.map(({ edge, status }) => {
                const key = researchEdgeKey(edge)
                const sourceLabel = nodeLabelById.get(edge.source) ?? edge.source
                const targetLabel = nodeLabelById.get(edge.target) ?? edge.target
                const confidence = formatConfidence(edge.confidence)
                return (
                  <div
                    key={`edge-${key}`}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 10,
                      background: '#ffffff',
                      marginBottom: 8
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <span className="badge">
                            <span className="mono">{edge.edgeType}</span>
                          </span>
                          <span>
                            {sourceLabel} → {targetLabel}
                          </span>
                        </div>
                        <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                          {edge.source} → {edge.target}
                        </div>
                        {confidence ? (
                          <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                            confidence {confidence}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {renderStatusBadge(status)}
                        <button
                          type="button"
                          className="button button-primary button-small"
                          disabled={status === 'accepted'}
                          onClick={() =>
                            setSuggestionStatus({ type: 'edge', key, status: 'accepted' })
                          }
                        >
                          수용
                        </button>
                        <button
                          type="button"
                          className="button button-ghost button-small"
                          disabled={status === 'excluded'}
                          onClick={() =>
                            setSuggestionStatus({ type: 'edge', key, status: 'excluded' })
                          }
                        >
                          제외
                        </button>
                      </div>
                    </div>
                    {edge.rationale ? (
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        {edge.rationale}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
        </div>
      ) : null}

      {viewMode === 'editor' && exportJson ? (
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 12,
            background: '#ffffff',
            marginBottom: 12
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <strong>Patch JSON</strong>
            <button type="button" className="button button-ghost" onClick={() => setExportJson(null)}>
              닫기
            </button>
          </div>
          <textarea
            readOnly
            value={exportJson}
            style={{ width: '100%', minHeight: 180, marginTop: 8, fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>
      ) : null}

      {viewMode === 'editor' && showAddProposed ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (state.status !== 'ready') return

            const trimmedLabel = proposedLabel.trim()
            if (!trimmedLabel) {
              setProposedError('label을 입력하세요.')
              return
            }

            const existingIds = new Set<string>(nodeTypeById.keys())
            const id = generateProposedNodeId(trimmedLabel, existingIds)
            if (!id) {
              setProposedError('유효한 slug를 생성할 수 없습니다. label을 변경하세요.')
              return
            }

            setProposedError(null)
            setManualProposedNodes((prev) => [
              ...prev,
              {
                id,
                nodeType: 'textbookUnit',
                label: trimmedLabel,
                proposed: true,
                origin: 'manual',
                note: proposedNote.trim() ? proposedNote.trim() : undefined
              }
            ])

            setProposedLabel('')
            setProposedNote('')
            setShowAddProposed(false)
          }}
          style={{
            marginBottom: 10,
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 12,
            background: '#fff7ed'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <label className="form-field" style={{ flex: '1 1 260px' }}>
              label
              <input value={proposedLabel} onChange={(event) => setProposedLabel(event.target.value)} />
            </label>
            <label className="form-field" style={{ flex: '2 1 340px' }}>
              note (optional)
              <input value={proposedNote} onChange={(event) => setProposedNote(event.target.value)} />
            </label>
          </div>
          <div className="node-actions" style={{ marginTop: 8 }}>
            <button type="submit" className="button button-primary">
              생성
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                setShowAddProposed(false)
                setProposedError(null)
              }}
            >
              취소
            </button>
          </div>
        </form>
      ) : null}

      {viewMode === 'editor' && selectedPrereq ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <div className="mono" style={{ fontSize: 12 }}>
            selected prereq: {selectedPrereq.source} → {selectedPrereq.target}
          </div>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              if (!editState) return
              if (selectedPrereq.origin === 'research') {
                setSuggestionStatus({
                  type: 'edge',
                  key: researchEdgeKey({ edgeType: 'prereq', source: selectedPrereq.source, target: selectedPrereq.target }),
                  status: 'excluded'
                })
              } else {
                const next = removePrereqEdge(editState, selectedPrereq)
                setManualAddedEdges(next.added)
                setManualRemovedEdges(next.removed)
              }
              setSelectedPrereq(null)
            }}
          >
            삭제
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setSelectedPrereq(null)}
          >
            취소
          </button>
        </div>
      ) : null}

      <div className="graph-canvas research-graph-canvas" aria-label="Research graph canvas">
        {inspectedPanel ? (
          <aside
            className="research-hover-panel"
            data-testid="research-hover-panel"
            onMouseEnter={handleHoverPanelMouseEnter}
            onMouseLeave={handleHoverPanelMouseLeave}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <strong style={{ fontSize: 14, lineHeight: 1.2 }}>{inspectedPanel.node.label}</strong>
                  {inspectedPanel.node.proposed ? <span className="badge badge-warn">proposed</span> : null}
                </div>
                <div className="mono" style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  {inspectedPanel.node.nodeType}
                  {inspectedPanel.depth ? ` · depth ${inspectedPanel.depth}` : ''}
                  {inspectedPanel.gradeBand ? ` · ${formatGradeBandLabel(inspectedPanel.gradeBand)}` : ''}
                  {inspectedPanel.domainLabel ? ` · ${inspectedPanel.domainLabel}` : ''}
                </div>
                <div className="mono" style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
                  {inspectedPanel.node.id}
                </div>
              </div>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  hoverPanelActiveRef.current = false
                  cancelHoverLeaveTimer()
                  clearHoverState()
                }}
              >
                닫기
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
                  목표
                  {inspectedPanel.node.nodeType === 'textbookUnit'
                    ? ` (성취기준 ${inspectedPanel.alignedAchievementCount}개)`
                    : ''}
                </div>

                {inspectedPanel.goals.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {inspectedPanel.goals.slice(0, 8).map((goal) => (
                      <div key={goal.id} style={{ borderLeft: '3px solid #e2e8f0', paddingLeft: 10 }}>
                        <div style={{ fontWeight: 650, fontSize: 13 }}>{goal.label}</div>
                        {goal.text ? (
                          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                            {goal.text}
                          </div>
                        ) : null}
                        <div className="mono" style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
                          {goal.id}
                        </div>
                      </div>
                    ))}
                    {inspectedPanel.goals.length > 8 ? (
                      <div className="muted" style={{ fontSize: 12 }}>
                        … +{inspectedPanel.goals.length - 8}개 더 있음
                      </div>
                    ) : null}
                    {inspectedPanel.note ? (
                      <div className="muted" style={{ fontSize: 12 }}>
                        메모: {inspectedPanel.note}
                      </div>
                    ) : null}
                  </div>
                ) : inspectedPanel.note ? (
                  <div className="muted" style={{ fontSize: 12 }}>{inspectedPanel.note}</div>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>아직 목표/설명이 없습니다.</div>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>예시 문제</div>

                {inspectedPanel.examplePrompts.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {inspectedPanel.examplePrompts.map((item, index) => (
                      <li key={`${item.nodeId}\u0000${index}`}>
                        <div className="mono" style={{ fontSize: 11, opacity: 0.75 }}>
                          {item.nodeId}
                        </div>
                        <div style={{ fontSize: 13 }}>{item.prompt}</div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>
                    예시 문제가 아직 없습니다.
                  </div>
                )}

                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  정답은 표시하지 않습니다.
                </div>
              </div>
            </div>
          </aside>
        ) : null}
        {state.status === 'ready' ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable={false}
            nodesConnectable={viewMode === 'editor'}
            deleteKeyCode={null}
            onNodeMouseEnter={handleNodeMouseEnter}
            onNodeMouseLeave={handleNodeMouseLeave}
            onConnect={(connection: Connection) => {
              if (viewMode !== 'editor') return
              if (!editState) return

              const source = connection.source
              const target = connection.target
              if (!source || !target) return

              if (source === target) {
                setMessage('Self-loop prereq는 추가할 수 없습니다.')
                return
              }

              setMessage(null)
              const next = addPrereqEdge(editState, { source, target })
              setManualAddedEdges(next.added)
              setManualRemovedEdges(next.removed)
            }}
            onEdgeClick={(_, edge) => {
              if (viewMode !== 'editor') return
              const isPrereq = edge?.data?.edgeType === 'prereq'
              if (!isPrereq) return
              const origin = edge?.data?.origin
              if (origin !== 'base' && origin !== 'research' && origin !== 'manual') return
              setSelectedPrereq({ source: edge.source, target: edge.target, origin })
            }}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        ) : null}
      </div>
    </section>
  )
}
