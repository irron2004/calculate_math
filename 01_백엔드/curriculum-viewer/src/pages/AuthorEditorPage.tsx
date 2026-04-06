import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAuth } from '../lib/auth/AuthProvider'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import { useRepositories } from '../lib/repository/RepositoryProvider'
import { getAuthorActiveGraphId, setAuthorActiveGraphId } from '../lib/skillGraph/authorState'
import { getEdgeAdditionError, listConnectableTargets } from '../lib/skillGraph/authorPreviewConnections'
import { filterSkillGraphNodes } from '../lib/skillGraph/authorPreviewFilters'
import { getStartableNodeIds } from '../lib/skillGraph/authorPreviewRules'
import { deriveCurriculumGraphId, mergeCurriculumIntoGraph } from '../lib/skillGraph/curriculumSync'
import {
  ensureGraphLayoutPositions,
  readGraphLayoutPositions,
  resetGraphLayout,
  updateGraphLayoutPosition,
  type LayoutPositions
} from '../lib/skillGraph/layout'
import type { SkillGraphEdgeType, SkillGraphNodeCategory, SkillGraphNodeV1, SkillGraphV1 } from '../lib/skillGraph/schema'
import { ROUTES } from '../routes'

type GraphNodeData = {
  label: React.ReactNode
  nodeCategory: SkillGraphNodeCategory
  isStartable: boolean
}

const NODE_WIDTH = 300
const NODE_HEIGHT = 90
const GRID_GAP_X = 60
const GRID_GAP_Y = 40

const EDGE_TYPES: SkillGraphEdgeType[] = ['requires', 'prepares_for', 'related', 'contains']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable
}

function getEdgeColor(edgeType: SkillGraphEdgeType): string {
  switch (edgeType) {
    case 'requires':
      return '#ef4444'
    case 'prepares_for':
      return '#0ea5e9'
    case 'related':
      return '#64748b'
    case 'contains':
      return '#22c55e'
    default:
      return '#64748b'
  }
}

function edgeId(edgeType: SkillGraphEdgeType, source: string, target: string): string {
  return `${edgeType}:${source}->${target}`
}

function edgeKey(edgeType: SkillGraphEdgeType, source: string, target: string): string {
  return `${edgeType}\u0000${source}\u0000${target}`
}

function buildGraphNodes(params: {
  graph: SkillGraphV1
  positions: LayoutPositions
  startableIds: Set<string>
  selectedNodeId: string | null
  curriculumTypeById: Map<string, string>
}): Array<Node<GraphNodeData>> {
  return params.graph.nodes.map((node, index) => {
    const isStartable = params.startableIds.has(node.id)
    const isSelected = params.selectedNodeId === node.id
    const position = params.positions[node.id] ?? {
      x: (index % 3) * (NODE_WIDTH + GRID_GAP_X),
      y: Math.floor(index / 3) * (NODE_HEIGHT + GRID_GAP_Y)
    }
    const curriculumType = params.curriculumTypeById.get(node.id)

    return {
      id: node.id,
      position,
      data: {
        label: (
          <div>
            <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
              {curriculumType ?? node.nodeCategory}
              {isStartable ? (
                <span className="badge badge-ok" style={{ marginLeft: 6 }}>
                  startable
                </span>
              ) : null}
            </div>
            <div style={{ fontWeight: 600 }}>{node.label}</div>
            <div className="mono" style={{ fontSize: 12, opacity: 0.75 }}>
              {node.id}
            </div>
          </div>
        ),
        nodeCategory: node.nodeCategory,
        isStartable
      },
      style: {
        borderRadius: 12,
        border: isSelected ? '2px solid #0f172a' : `1px solid ${isStartable ? '#22c55e' : '#e2e8f0'}`,
        background: '#ffffff',
        padding: 10,
        width: NODE_WIDTH,
        color: '#0f172a'
      }
    }
  })
}

function buildGraphEdges(params: { graph: SkillGraphV1; selectedEdgeId: string | null }): Edge[] {
  return params.graph.edges.map((edge) => {
    const color = getEdgeColor(edge.edgeType)
    const id = edgeId(edge.edgeType, edge.source, edge.target)
    const isSelected = params.selectedEdgeId === id
    return {
      id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      label: edge.edgeType,
      style: { stroke: color, strokeWidth: isSelected ? 3 : 2, opacity: 0.95 },
      labelStyle: { fill: color, fontSize: 12 }
    }
  })
}

export default function AuthorEditorPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { graphRepository } = useRepositories()
  const { data: curriculumData, loading: curriculumLoading, error: curriculumError } = useCurriculum()

  const [graph, setGraph] = useState<SkillGraphV1 | null>(null)
  const [edgeType, setEdgeType] = useState<SkillGraphEdgeType>('requires')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | SkillGraphNodeCategory>('all')
  const [showAddNodeForm, setShowAddNodeForm] = useState(false)
  const [newNodeId, setNewNodeId] = useState('')
  const [newNodeLabel, setNewNodeLabel] = useState('')
  const [newNodeCategory, setNewNodeCategory] = useState<SkillGraphNodeCategory>('core')
  const [newNodeStart, setNewNodeStart] = useState(false)
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null)
  const [instanceReady, setInstanceReady] = useState(false)

  const instanceRef = useRef<ReactFlowInstance | null>(null)

  const curriculumTypeById = useMemo(() => {
    const map = new Map<string, string>()
    if (!curriculumData) return map
    for (const node of curriculumData.nodes) {
      map.set(node.id, node.type)
    }
    return map
  }, [curriculumData])

  const persistGraph = useCallback(
    (nextGraph: SkillGraphV1) => {
      const ensured = ensureGraphLayoutPositions(nextGraph)
      const graphToSave = ensured.graph
      setGraph(graphToSave)
      if (!userId) return
      graphRepository.saveDraft({ userId, graph: graphToSave, now: new Date().toISOString() })
    },
    [graphRepository, userId]
  )

  useEffect(() => {
    if (!userId || !curriculumData) return

    const activeGraphId = getAuthorActiveGraphId()
    const resolvedGraphId = activeGraphId ?? deriveCurriculumGraphId(curriculumData)
    if (!activeGraphId) {
      setAuthorActiveGraphId(resolvedGraphId)
    }

    const draft = graphRepository.loadDraft({ userId, graphId: resolvedGraphId })?.draft ?? null
    const merged = mergeCurriculumIntoGraph({ graph: draft, curriculum: curriculumData })
    let nextGraph = merged.graph
    if (!draft && nextGraph.graphId !== resolvedGraphId) {
      const meta = isRecord(nextGraph.meta) ? nextGraph.meta : {}
      const curriculumMeta = isRecord(meta.curriculum) ? meta.curriculum : {}
      nextGraph = {
        ...nextGraph,
        graphId: resolvedGraphId,
        meta: {
          ...meta,
          curriculum: {
            ...curriculumMeta,
            graphId: resolvedGraphId
          }
        }
      }
    }
    const layout = ensureGraphLayoutPositions(nextGraph)
    nextGraph = layout.graph

    if (!draft || merged.changed || layout.changed) {
      graphRepository.saveDraft({ userId, graph: nextGraph, now: new Date().toISOString() })
    }

    setGraph(nextGraph)
  }, [curriculumData, graphRepository, userId])

  const startableNodes = useMemo(() => {
    if (!graph) return []
    const ids = getStartableNodeIds(graph)
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
    return ids.map((id) => nodeById.get(id)).filter((node): node is SkillGraphNodeV1 => Boolean(node))
  }, [graph])

  const startableNodeIdSet = useMemo(() => {
    return new Set(startableNodes.map((node) => node.id))
  }, [startableNodes])

  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (!graph) return
    const positions = readGraphLayoutPositions(graph)
    setNodes(
      buildGraphNodes({
        graph,
        positions,
        startableIds: startableNodeIdSet,
        selectedNodeId,
        curriculumTypeById
      })
    )
  }, [curriculumTypeById, graph, selectedNodeId, setNodes, startableNodeIdSet])

  useEffect(() => {
    if (!graph) return
    setEdges(buildGraphEdges({ graph, selectedEdgeId }))
  }, [graph, selectedEdgeId, setEdges])

  const tryFocusNode = useCallback((nodeId: string) => {
    const instance = instanceRef.current
    if (!instance) return false
    const target = nodes.find((node) => node.id === nodeId)
    if (!target) return false
    requestAnimationFrame(() => {
      instance.fitView({ nodes: [target], padding: 0.5, duration: 250 })
    })
    return true
  }, [nodes])

  const focusNode = useCallback(
    (nodeId: string) => {
      if (!tryFocusNode(nodeId)) {
        setPendingFocusNodeId(nodeId)
      }
    },
    [tryFocusNode]
  )

  useEffect(() => {
    if (!pendingFocusNodeId || !instanceReady) return
    if (tryFocusNode(pendingFocusNodeId)) {
      setPendingFocusNodeId(null)
    }
  }, [instanceReady, nodes, pendingFocusNodeId, tryFocusNode])


  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!graph) return
      const source = connection.source
      const target = connection.target
      if (!source || !target) return

      const error = getEdgeAdditionError({ graph, edgeType, sourceId: source, targetId: target })
      if (error) {
        setMessage(error)
        return
      }

      const nextGraph: SkillGraphV1 = {
        ...graph,
        edges: [...graph.edges, { edgeType, source, target }]
      }
      persistGraph(nextGraph)
      setSelectedEdgeId(edgeId(edgeType, source, target))
      setMessage(null)
    },
    [edgeType, graph, persistGraph]
  )

  const handleEdgeDelete = useCallback(() => {
    if (!graph || !selectedEdgeId) return
    const nextEdges = graph.edges.filter(
      (edge) => edgeId(edge.edgeType, edge.source, edge.target) !== selectedEdgeId
    )
    persistGraph({ ...graph, edges: nextEdges })
    setSelectedEdgeId(null)
  }, [graph, persistGraph, selectedEdgeId])

  useEffect(() => {
    if (!selectedEdgeId) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') return
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      handleEdgeDelete()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleEdgeDelete, selectedEdgeId])

  const handleEdgeTypeChange = useCallback(
    (nextType: SkillGraphEdgeType) => {
      if (!graph || !selectedEdgeId) return
      const current = graph.edges.find(
        (edge) => edgeId(edge.edgeType, edge.source, edge.target) === selectedEdgeId
      )
      if (!current) return

      const error = getEdgeAdditionError({
        graph: { ...graph, edges: graph.edges.filter((edge) => edge !== current) },
        edgeType: nextType,
        sourceId: current.source,
        targetId: current.target
      })
      if (error) {
        setMessage(error)
        return
      }

      const nextEdges = graph.edges
        .filter((edge) => edge !== current)
        .concat({ edgeType: nextType, source: current.source, target: current.target })
      const nextGraph = { ...graph, edges: nextEdges }
      persistGraph(nextGraph)
      setSelectedEdgeId(edgeId(nextType, current.source, current.target))
      setMessage(null)
    },
    [graph, persistGraph, selectedEdgeId]
  )

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      if (!graph) return
      persistGraph(updateGraphLayoutPosition(graph, node.id, node.position))
    },
    [graph, persistGraph]
  )

  const handleResetLayout = useCallback(() => {
    if (!graph) return
    persistGraph(resetGraphLayout(graph))
  }, [graph, persistGraph])

  const handleAddNode = useCallback(() => {
    if (!graph) return

    const trimmedId = newNodeId.trim()
    const trimmedLabel = newNodeLabel.trim()

    if (!trimmedId || !trimmedLabel) {
      setMessage('노드 ID와 라벨을 입력하세요.')
      return
    }

    if (!/^[A-Za-z0-9._-]+$/.test(trimmedId)) {
      setMessage('노드 ID는 영문자, 숫자, ., _, - 만 사용할 수 있습니다.')
      return
    }

    const existingNodeIds = new Set(graph.nodes.map((node) => node.id))
    if (existingNodeIds.has(trimmedId)) {
      setMessage(`노드 ID "${trimmedId}"가 이미 존재합니다.`)
      return
    }

    const newOrder = graph.nodes.length > 0 
      ? Math.max(...graph.nodes.map(n => n.order ?? 0)) + 1 
      : 0

    const newNode: SkillGraphNodeV1 = {
      id: trimmedId,
      nodeCategory: newNodeCategory,
      label: trimmedLabel,
      start: newNodeStart || undefined,
      order: newOrder
    }

    const nextGraph: SkillGraphV1 = {
      ...graph,
      nodes: [...graph.nodes, newNode]
    }

    persistGraph(nextGraph)
    setNewNodeId('')
    setNewNodeLabel('')
    setNewNodeCategory('core')
    setNewNodeStart(false)
    setShowAddNodeForm(false)
    setSelectedNodeId(trimmedId)
    setMessage(null)
    
    setTimeout(() => {
      focusNode(trimmedId)
    }, 100)
  }, [graph, newNodeId, newNodeLabel, newNodeCategory, newNodeStart, persistGraph, focusNode])

  const selectedEdge = useMemo(() => {
    if (!graph || !selectedEdgeId) return null
    return graph.edges.find(
      (edge) => edgeId(edge.edgeType, edge.source, edge.target) === selectedEdgeId
    ) ?? null
  }, [graph, selectedEdgeId])

  const connectableTargets = useMemo(() => {
    if (!graph || !selectedNodeId) return []
    return listConnectableTargets({ graph, sourceId: selectedNodeId, edgeType })
  }, [edgeType, graph, selectedNodeId])

  const hasConnectableTargets = useMemo(() => {
    return connectableTargets.some((candidate) => candidate.isConnectable)
  }, [connectableTargets])

  const filteredNodes = useMemo(() => {
    if (!graph) return []
    return filterSkillGraphNodes(graph.nodes, { query, category: categoryFilter })
  }, [categoryFilter, graph, query])

  return (
    <section>
      <h1>Author Preview</h1>
      <p className="muted">모든 교과목 노드를 표시하고 드래그/연결로 Draft를 편집할 수 있습니다.</p>

      {!userId ? <p className="error">로그인이 필요합니다.</p> : null}
      {curriculumLoading ? <p className="muted">교과목 데이터를 불러오는 중입니다.</p> : null}
      {curriculumError ? <p className="error">{curriculumError}</p> : null}

      <div className="node-actions">
        <Link to={ROUTES.authorImport} className="button button-ghost">
          Import
        </Link>
        <Link to={ROUTES.authorValidate} className="button button-ghost">
          Validation
        </Link>
        <Link to={ROUTES.authorPublish} className="button button-primary">
          Publish
        </Link>
      </div>

      {message ? <p className="error">{message}</p> : null}

      {graph ? (
        <div className="author-editor-grid">
          <div className="author-editor-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id)
                setSelectedEdgeId(null)
                focusNode(node.id)
              }}
              onEdgeClick={(_, edge) => {
                setSelectedEdgeId(edge.id)
                setSelectedNodeId(null)
              }}
              onPaneClick={() => {
                setSelectedNodeId(null)
                setSelectedEdgeId(null)
              }}
              onConnect={handleConnect}
              onNodeDragStop={handleNodeDragStop}
              nodesDraggable
              nodesConnectable
              edgesUpdatable={false}
              deleteKeyCode={null}
              fitView
              onInit={(instance) => {
                instanceRef.current = instance
                setInstanceReady((prev) => prev || true)
              }}
            >
              <Background gap={18} size={1} color="#e2e8f0" />
              <Controls />
              <MiniMap nodeStrokeWidth={2} pannable zoomable />
            </ReactFlow>
          </div>

          <aside className="author-editor-panel">
            <div className="author-editor-toolbar">
              <label className="form-field">
                엣지 타입
                <select
                  value={edgeType}
                  onChange={(event) => setEdgeType(event.target.value as SkillGraphEdgeType)}
                >
                  {EDGE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <div className="author-editor-meta">
                <button type="button" className="button button-ghost" onClick={handleResetLayout}>
                  Reset Layout
                </button>
              </div>
            </div>

            <h3>Graph</h3>
            <dl className="detail-dl">
              <dt>graphId</dt>
              <dd className="mono">{graph.graphId}</dd>
              <dt>title</dt>
              <dd>{graph.title}</dd>
              <dt>nodes</dt>
              <dd>{graph.nodes.length}</dd>
              <dt>edges</dt>
              <dd>{graph.edges.length}</dd>
            </dl>

            <h3>선택한 노드</h3>
            {selectedNodeId ? (
              <dl className="detail-dl">
                <dt>id</dt>
                <dd className="mono">{selectedNodeId}</dd>
                <dt>type</dt>
                <dd>{curriculumTypeById.get(selectedNodeId) ?? 'custom'}</dd>
              </dl>
            ) : (
              <p className="muted">노드를 클릭하세요.</p>
            )}

            <h3>Connectable Targets</h3>
            {selectedNodeId ? (
              <>
                {!hasConnectableTargets ? (
                  <p className="muted">연결 가능한 대상이 없습니다.</p>
                ) : null}
                {connectableTargets.length > 0 ? (
                  <div className="author-node-list">
                    {connectableTargets.map((candidate) => {
                      const isBlocked = !candidate.isConnectable
                      const reason = candidate.reason
                      return (
                        <div
                          key={candidate.node.id}
                          className={`author-node-item${isBlocked ? ' is-disabled' : ''}`}
                        >
                          <button
                            type="button"
                            className={`link-button${isBlocked ? ' is-disabled' : ''}`}
                            aria-disabled={isBlocked}
                            onClick={() => {
                              if (isBlocked) {
                                if (reason) {
                                  setMessage(reason)
                                }
                                return
                              }
                              handleConnect({
                                source: selectedNodeId,
                                target: candidate.node.id,
                                sourceHandle: null,
                                targetHandle: null
                              })
                              focusNode(candidate.node.id)
                            }}
                          >
                            {candidate.node.label}
                          </button>
                          <span className="muted">{candidate.node.id}</span>
                          {reason ? (
                            <span className="badge badge-warn">{reason}</span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted">source 노드를 선택하세요.</p>
            )}

            <h3>선택한 엣지</h3>
            {selectedEdge ? (
              <>
                <dl className="detail-dl">
                  <dt>type</dt>
                  <dd className="mono">{selectedEdge.edgeType}</dd>
                  <dt>source</dt>
                  <dd className="mono">{selectedEdge.source}</dd>
                  <dt>target</dt>
                  <dd className="mono">{selectedEdge.target}</dd>
                </dl>
                <label className="form-field">
                  타입 변경
                  <select
                    value={selectedEdge.edgeType}
                    onChange={(event) =>
                      handleEdgeTypeChange(event.target.value as SkillGraphEdgeType)
                    }
                  >
                    {EDGE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="button button-ghost" onClick={handleEdgeDelete}>
                  엣지 삭제
                </button>
              </>
            ) : (
              <p className="muted">엣지를 클릭하세요.</p>
            )}

            <h3>모든 노드</h3>
            <label className="form-field">
              검색
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="title / id"
              />
            </label>
            <label className="form-field">
              카테고리
              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value as 'all' | SkillGraphNodeCategory)
                }
              >
                <option value="all">all</option>
                <option value="core">core</option>
                <option value="challenge">challenge</option>
                <option value="formal">formal</option>
              </select>
            </label>
            <div className="author-node-list">
              {filteredNodes.map((node) => (
                <div key={node.id} className="author-node-item">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setSelectedNodeId(node.id)
                      setSelectedEdgeId(null)
                      focusNode(node.id)
                    }}
                  >
                    {node.label}
                  </button>
                  <span className="muted">{node.id}</span>
                </div>
              ))}
            </div>

            <h3>Startable Nodes ({startableNodes.length})</h3>
            <div className="author-node-list">
              {startableNodes.map((node) => (
                <div key={node.id} className="author-node-item">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setSelectedNodeId(node.id)
                      setSelectedEdgeId(null)
                      focusNode(node.id)
                    }}
                  >
                    {node.label}
                  </button>
                  <span className="muted">
                    {node.id}
                  </span>
                </div>
              ))}
            </div>

            <h3>노드 추가</h3>
            {showAddNodeForm ? (
              <div className="author-add-node-form">
                <label className="form-field">
                  노드 ID
                  <input
                    value={newNodeId}
                    onChange={(event) => setNewNodeId(event.target.value)}
                    placeholder="예: MY-NODE-001"
                    pattern="[A-Za-z0-9._-]+"
                  />
                  <small className="muted">영문자, 숫자, ., _, - 만 사용 가능</small>
                </label>
                <label className="form-field">
                  라벨
                  <input
                    value={newNodeLabel}
                    onChange={(event) => setNewNodeLabel(event.target.value)}
                    placeholder="노드 표시 이름"
                  />
                </label>
                <label className="form-field">
                  카테고리
                  <select
                    value={newNodeCategory}
                    onChange={(event) =>
                      setNewNodeCategory(event.target.value as SkillGraphNodeCategory)
                    }
                  >
                    <option value="core">core</option>
                    <option value="challenge">challenge</option>
                    <option value="formal">formal</option>
                  </select>
                </label>
                <label className="form-field">
                  <input
                    type="checkbox"
                    checked={newNodeStart}
                    onChange={(event) => setNewNodeStart(event.target.checked)}
                  />
                  시작 노드로 설정
                </label>
                <div className="node-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={handleAddNode}
                    disabled={!newNodeId.trim() || !newNodeLabel.trim()}
                  >
                    추가
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      setShowAddNodeForm(false)
                      setNewNodeId('')
                      setNewNodeLabel('')
                      setNewNodeCategory('core')
                      setNewNodeStart(false)
                      setMessage(null)
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary"
                onClick={() => setShowAddNodeForm(true)}
              >
                노드 추가
              </button>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  )
}
