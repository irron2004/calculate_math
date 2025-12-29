import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import dagre from 'dagre'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type Edge,
  type Node
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { DetailPanelContext } from '../components/AppLayout'

type GradeBandFilter = 'all' | '1-2' | '3-4' | '5-6'

type CurriculumNodeType =
  | 'root'
  | 'schoolLevel'
  | 'gradeBand'
  | 'domain'
  | 'achievement'
  | 'textbookUnit'

type CurriculumNode = {
  id: string
  nodeType: CurriculumNodeType
  label: string
  parentId?: string
  gradeBand?: string
  domainCode?: string
  officialCode?: string
  skillLevel?: number
  order?: number
  tags?: string[]
  text?: string
  note?: string
}

type CurriculumEdgeType = 'contains' | 'alignsTo' | 'prereq'

type CurriculumEdge = {
  id: string
  edgeType: CurriculumEdgeType
  source: string
  target: string
  weight?: number
  note?: string
}

type CurriculumGraph = {
  meta: Record<string, unknown>
  nodes: CurriculumNode[]
  edges: CurriculumEdge[]
}

type EdgeFlags = {
  contains: boolean
  alignsTo: boolean
  prereq: boolean
}

type GraphNodeData = {
  label: React.ReactNode
  nodeType: CurriculumNodeType
}

type GraphEdgeData = {
  edgeType: CurriculumEdgeType
  note?: string
}

type GraphNode = Node<GraphNodeData>

type GraphEdge = Edge<GraphEdgeData>

const DEFAULT_GRADE_BAND: GradeBandFilter = '3-4'

const DEFAULT_EDGE_FLAGS: EdgeFlags = {
  contains: true,
  alignsTo: false,
  prereq: false
}

function getNodeDims(nodeType: CurriculumNodeType): { width: number; height: number } {
  switch (nodeType) {
    case 'root':
      return { width: 260, height: 64 }
    case 'schoolLevel':
      return { width: 220, height: 56 }
    case 'gradeBand':
      return { width: 240, height: 56 }
    case 'domain':
      return { width: 220, height: 56 }
    case 'textbookUnit':
      return { width: 280, height: 64 }
    case 'achievement':
      return { width: 320, height: 72 }
    default:
      return { width: 240, height: 56 }
  }
}

function getNodeStyle(node: CurriculumNode): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    color: '#0f172a',
    padding: 10,
    fontSize: 12,
    lineHeight: 1.2
  }

  switch (node.nodeType) {
    case 'root':
      return { ...base, background: '#0f172a', borderColor: '#0f172a', color: '#ffffff' }
    case 'schoolLevel':
      return { ...base, background: '#e0f2fe', borderColor: '#7dd3fc' }
    case 'gradeBand':
      return { ...base, background: '#ecfccb', borderColor: '#bef264' }
    case 'domain':
      return { ...base, background: '#ede9fe', borderColor: '#c4b5fd' }
    case 'textbookUnit':
      return { ...base, background: '#fff7ed', borderColor: '#fed7aa' }
    case 'achievement':
      return { ...base, background: '#ffffff' }
    default:
      return base
  }
}

function layoutWithDagre(
  nodes: GraphNode[],
  edges: GraphEdge[],
  direction: 'TB' | 'LR' = 'TB'
): GraphNode[] {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 30,
    ranksep: 60,
    marginx: 20,
    marginy: 20
  })

  for (const node of nodes) {
    const dims = getNodeDims(node.data.nodeType)
    dagreGraph.setNode(node.id, dims)
  }

  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target)
  }

  dagre.layout(dagreGraph)

  return nodes.map((node) => {
    const dims = getNodeDims(node.data.nodeType)
    const laidOut = dagreGraph.node(node.id) as { x: number; y: number } | undefined

    if (!laidOut) {
      return node
    }

    return {
      ...node,
      position: {
        x: laidOut.x - dims.width / 2,
        y: laidOut.y - dims.height / 2
      }
    }
  })
}

function renderNodeDetail(node: CurriculumNode): React.ReactNode {
  return (
    <div>
      <h2>노드 상세</h2>
      <dl className="detail-dl">
        <dt>ID</dt>
        <dd>{node.id}</dd>
        <dt>Type</dt>
        <dd>{node.nodeType}</dd>
        <dt>Label</dt>
        <dd>{node.label}</dd>
        {node.gradeBand ? (
          <>
            <dt>Grade Band</dt>
            <dd>{node.gradeBand}</dd>
          </>
        ) : null}
        {node.domainCode ? (
          <>
            <dt>Domain</dt>
            <dd>{node.domainCode}</dd>
          </>
        ) : null}
        {node.officialCode ? (
          <>
            <dt>Official Code</dt>
            <dd>{node.officialCode}</dd>
          </>
        ) : null}
        {typeof node.skillLevel === 'number' ? (
          <>
            <dt>Skill Level</dt>
            <dd>{node.skillLevel}</dd>
          </>
        ) : null}
      </dl>
      {node.text ? (
        <>
          <h3>Text</h3>
          <p className="detail-text">{node.text}</p>
        </>
      ) : null}
      {node.note ? (
        <>
          <h3>Note</h3>
          <p className="detail-text">{node.note}</p>
        </>
      ) : null}
    </div>
  )
}

export default function GraphPage() {
  const { setDetail } = useOutletContext<DetailPanelContext>()

  const [graph, setGraph] = useState<CurriculumGraph | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [gradeBand, setGradeBand] = useState<GradeBandFilter>(DEFAULT_GRADE_BAND)
  const [edgeFlags, setEdgeFlags] = useState<EdgeFlags>(DEFAULT_EDGE_FLAGS)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    setDetail(
      <div>
        <h2>상세</h2>
        <p>`curriculum_math_v1.json`을 로드해 노드/엣지를 표시합니다.</p>
        <p>노드를 클릭하면 상세가 표시됩니다.</p>
      </div>
    )
  }, [setDetail])

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return
    }

    const controller = new AbortController()

    async function run() {
      setLoading(true)
      setLoadError(null)

      try {
        const response = await fetch('/data/curriculum_math_v1.json', {
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Failed to load curriculum data (HTTP ${response.status})`)
        }

        const json = (await response.json()) as CurriculumGraph
        setGraph(json)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        const message = error instanceof Error ? error.message : String(error)
        setLoadError(message)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      controller.abort()
    }
  }, [])

  const nodeById = useMemo(() => {
    return new Map<string, CurriculumNode>((graph?.nodes ?? []).map((node) => [node.id, node]))
  }, [graph])

  const includedNodeIds = useMemo(() => {
    if (!graph) {
      return new Set<string>()
    }

    if (gradeBand === 'all') {
      return new Set(graph.nodes.map((node) => node.id))
    }

    const rootId = `KR-MATH-2022-E-${gradeBand}`
    const include = new Set<string>()

    function hasAncestor(nodeId: string, ancestorId: string): boolean {
      let cursor: string | undefined = nodeId

      while (cursor) {
        if (cursor === ancestorId) {
          return true
        }

        const current = nodeById.get(cursor)
        cursor = current?.parentId
      }

      return false
    }

    for (const node of graph.nodes) {
      if (hasAncestor(node.id, rootId)) {
        include.add(node.id)
      }
    }

    include.add('KR-MATH-2022')
    include.add('KR-MATH-2022-E')

    return include
  }, [graph, gradeBand, nodeById])

  useEffect(() => {
    if (!selectedNodeId) {
      return
    }

    if (!includedNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(null)
    }
  }, [includedNodeIds, selectedNodeId])

  const graphNodes = useMemo((): GraphNode[] => {
    if (!graph) {
      return []
    }

    return graph.nodes
      .filter((node) => includedNodeIds.has(node.id))
      .map((node) => {
        const dims = getNodeDims(node.nodeType)
        const style = {
          ...getNodeStyle(node),
          width: dims.width,
          height: dims.height,
          borderColor: node.id === selectedNodeId ? '#0f172a' : undefined,
          boxShadow:
            node.id === selectedNodeId ? '0 0 0 2px rgba(15, 23, 42, 0.15)' : undefined
        } as const

        return {
          id: node.id,
          position: { x: 0, y: 0 },
          data: {
            nodeType: node.nodeType,
            label: (
              <div className="graph-node-label">
                <div className="graph-node-title">{node.label}</div>
                <div className="graph-node-id">{node.id}</div>
              </div>
            )
          },
          style
        }
      })
  }, [graph, includedNodeIds, selectedNodeId])

  const graphEdges = useMemo((): GraphEdge[] => {
    if (!graph) {
      return []
    }

    const allowedTypes = new Set<CurriculumEdgeType>(
      (Object.keys(edgeFlags) as CurriculumEdgeType[]).filter(
        (type) => edgeFlags[type]
      )
    )

    return graph.edges
      .filter((edge) => allowedTypes.has(edge.edgeType))
      .filter(
        (edge) => includedNodeIds.has(edge.source) && includedNodeIds.has(edge.target)
      )
      .map((edge) => {
        const base: GraphEdge = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          data: { edgeType: edge.edgeType, note: edge.note },
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 }
        }

        if (edge.edgeType === 'contains') {
          return { ...base, style: { stroke: '#94a3b8' } }
        }

        if (edge.edgeType === 'alignsTo') {
          return {
            ...base,
            style: { stroke: '#3b82f6', strokeDasharray: '4 4' }
          }
        }

        return {
          ...base,
          animated: true,
          style: { stroke: '#f97316', strokeDasharray: '6 4' }
        }
      })
  }, [edgeFlags, graph, includedNodeIds])

  const layoutedNodes = useMemo(() => {
    if (graphNodes.length === 0) {
      return []
    }

    return layoutWithDagre(graphNodes, graphEdges, 'TB')
  }, [graphEdges, graphNodes])

  const edgeKey = `${edgeFlags.contains ? 'c' : ''}${edgeFlags.alignsTo ? 'a' : ''}${edgeFlags.prereq ? 'p' : ''}`
  const reactFlowKey = `${gradeBand}:${edgeKey}:${layoutedNodes.length}:${graphEdges.length}`

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: GraphNode) => {
      const source = nodeById.get(node.id)
      if (!source) {
        return
      }

      setSelectedNodeId(source.id)
      setDetail(renderNodeDetail(source))
    },
    [nodeById, setDetail]
  )

  return (
    <section>
      <h1>그래프</h1>

      <div className="graph-toolbar">
        <label className="graph-control">
          학년군
          <select
            value={gradeBand}
            onChange={(event) => setGradeBand(event.target.value as GradeBandFilter)}
          >
            <option value="3-4">초등 3~4학년군</option>
            <option value="1-2">초등 1~2학년군</option>
            <option value="5-6">초등 5~6학년군</option>
            <option value="all">전체</option>
          </select>
        </label>

        <label className="graph-control">
          <input
            type="checkbox"
            checked={edgeFlags.contains}
            onChange={(event) =>
              setEdgeFlags((prev) => ({ ...prev, contains: event.target.checked }))
            }
          />
          계층(contains)
        </label>

        <label className="graph-control">
          <input
            type="checkbox"
            checked={edgeFlags.alignsTo}
            onChange={(event) =>
              setEdgeFlags((prev) => ({ ...prev, alignsTo: event.target.checked }))
            }
          />
          매핑(alignsTo)
        </label>

        <label className="graph-control">
          <input
            type="checkbox"
            checked={edgeFlags.prereq}
            onChange={(event) =>
              setEdgeFlags((prev) => ({ ...prev, prereq: event.target.checked }))
            }
          />
          선수(prereq)
        </label>

        <div className="graph-meta">
          {graph ? (
            <span>
              nodes: {Array.from(includedNodeIds).length} / {graph.nodes.length} · edges:{' '}
              {graphEdges.length}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? <p>Loading…</p> : null}
      {loadError ? <p className="error">{loadError}</p> : null}

      {graph ? (
        <div className="graph-canvas">
          <ReactFlow
            key={reactFlowKey}
            nodes={layoutedNodes}
            edges={graphEdges}
            onNodeClick={onNodeClick}
            fitView
          >
            <Background gap={16} color="#e2e8f0" />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                const t = (node.data as GraphNodeData | undefined)?.nodeType
                if (t === 'root') return '#0f172a'
                if (t === 'domain') return '#a78bfa'
                if (t === 'gradeBand') return '#84cc16'
                if (t === 'schoolLevel') return '#38bdf8'
                if (t === 'textbookUnit') return '#fb923c'
                return '#cbd5e1'
              }}
            />
            <Controls />
          </ReactFlow>
        </div>
      ) : null}
    </section>
  )
}
