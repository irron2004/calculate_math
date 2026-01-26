import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
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

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; graph: Awaited<ReturnType<typeof loadCurriculum2022Graph>> }

const NODE_WIDTH = 260
const NODE_HEIGHT = 70
const GRID_GAP_X = 40
const GRID_GAP_Y = 30
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
  const [activeTrack, setActiveTrack] = useState<ResearchTrack>(initialEditorState.selectedTrack)
  const [selectedPrereq, setSelectedPrereq] = useState<PrereqEdgeWithOrigin | null>(null)
  const [message, setMessage] = useState<string | null>(null)
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

  const currentPrereqEdges = useMemo(() => {
    if (!editState) return []
    return listCurrentPrereqEdges(editState).filter(
      (edge) => nodeTypeById.has(edge.source) && nodeTypeById.has(edge.target)
    )
  }, [editState, nodeTypeById])

  const prereqCycle = useMemo(() => {
    const edges = currentPrereqEdges.map((edge) => ({ source: edge.source, target: edge.target }))
    return detectPrereqCycle(edges)
  }, [currentPrereqEdges])

  const nodes = useMemo((): Node[] => {
    if (state.status !== 'ready') return []

    const nodeMap = new Map<
      string,
      { id: string; nodeType: string; label: string; proposed?: boolean; note?: string; reason?: string }
    >()
    for (const node of state.graph.nodes) {
      nodeMap.set(node.id, node)
    }
    for (const node of proposedNodes) {
      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, node)
      }
    }

    const allNodes = Array.from(nodeMap.values())

    return allNodes.map((node, index) => {
      const description = node.note ?? node.reason
      return {
        id: node.id,
        position: {
          x: (index % 4) * (NODE_WIDTH + GRID_GAP_X),
          y: Math.floor(index / 4) * (NODE_HEIGHT + GRID_GAP_Y)
        },
        data: {
          label: (
            <div>
              <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                {node.nodeType}
                {node.proposed ? (
                  <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                    proposed
                  </span>
                ) : null}
              </div>
              <div style={{ fontWeight: 600 }}>{node.label}</div>
              {description ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {description}
                </div>
              ) : null}
              <div className="mono" style={{ fontSize: 12, opacity: 0.75 }}>
                {node.id}
              </div>
            </div>
          )
        },
        style: {
          width: NODE_WIDTH,
          padding: 10,
          borderRadius: 12,
          color: '#0f172a',
          ...getNodeStyle(node.nodeType, Boolean(node.proposed))
        }
      }
    })
  }, [proposedNodes, state])

  const edges = useMemo((): Edge[] => {
    if (state.status !== 'ready') return []

    const nonPrereq = state.graph.edges
      .filter((edge) => edge.edgeType !== 'prereq')
      .map((edge) => {
        const style = getEdgeStyle(edge.edgeType)
        return {
          id: edge.id ?? `${edge.edgeType}:${edge.source}->${edge.target}`,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          label: edge.edgeType,
          data: { edgeType: edge.edgeType },
          style,
          labelStyle: { fill: (style.stroke as string) ?? '#64748b', fontSize: 12 }
        }
      })

    const prereq = currentPrereqEdges.map((edge) => {
      const origin =
        edge.origin === 'base' ? 'existing' : edge.origin === 'research' ? 'research' : 'manual'
      const style = getEdgeStyle('prereq', { prereqOrigin: origin })
      return {
        id: `prereq:${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        label: 'prereq',
        data: { edgeType: 'prereq', origin: edge.origin },
        style,
        labelStyle: { fill: (style.stroke as string) ?? '#64748b', fontSize: 12 }
      }
    })

    return [...nonPrereq, ...prereq]
  }, [currentPrereqEdges, state])

  const counts = useMemo(() => {
    if (state.status !== 'ready') return null
    const textbookUnitCount =
      state.graph.nodes.filter((node) => node.nodeType === 'textbookUnit').length +
      proposedNodes.filter((node) => node.nodeType === 'textbookUnit').length
    const prereqCounts = currentPrereqEdges.reduce(
      (acc, edge) => {
        acc.total += 1
        acc[edge.origin] += 1
        return acc
      },
      { total: 0, base: 0, research: 0, manual: 0 }
    )
    return {
      nodes: state.graph.nodes.length,
      edges: state.graph.edges.length,
      textbookUnits: textbookUnitCount,
      prereq: prereqCounts
    }
  }, [currentPrereqEdges, proposedNodes, state])

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
          nodes: {counts.nodes} / edges: {counts.edges} / textbookUnit: {counts.textbookUnits}
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
          <button type="button" className="button button-primary" onClick={handleExportPatch}>
            Export JSON
          </button>
          <div className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
            prereq: {counts?.prereq.total ?? 0} (existing {counts?.prereq.base ?? 0} / research{' '}
            {counts?.prereq.research ?? 0} / manual {counts?.prereq.manual ?? 0}) | changes: +{editState.added.length}{' '}
            / -{editState.removed.length}
          </div>
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
                        <div style={{ fontWeight: 600 }}>
                          {sourceLabel} → {targetLabel}
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

      {exportJson ? (
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

      {showAddProposed ? (
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

      {selectedPrereq ? (
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

      <div className="graph-canvas" aria-label="Research graph canvas">
        {state.status === 'ready' ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable={false}
            nodesConnectable
            deleteKeyCode={null}
            onConnect={(connection: Connection) => {
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
              const isPrereq = edge?.data?.edgeType === 'prereq' || edge?.label === 'prereq'
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
