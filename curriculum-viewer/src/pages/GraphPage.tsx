import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import dagre from 'dagre'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type Edge,
  type Node,
  type ReactFlowInstance
} from 'reactflow'
import 'reactflow/dist/style.css'
import NodeDetail from '../components/NodeDetail'
import type { DetailPanelContext } from '../components/AppLayout'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import {
  buildContainsEdgeRefsSkippingGradeNodes,
  getGraphVisibleNodes
} from '../lib/curriculum/graphView'
import { buildProgressionEdges } from '../lib/curriculum/progression'
import type { CurriculumNode, CurriculumNodeType } from '../lib/curriculum/types'
import { useFocusNodeId } from '../lib/routing/useFocusNodeId'

type GraphNodeData = {
  label: React.ReactNode
  nodeType: CurriculumNodeType
}

type GraphEdgeData = {
  edgeType: 'contains' | 'progression'
}

type GraphNode = Node<GraphNodeData>

type GraphEdge = Edge<GraphEdgeData>

function getNodeDims(nodeType: CurriculumNodeType): { width: number; height: number } {
  switch (nodeType) {
    case 'subject':
      return { width: 260, height: 64 }
    case 'grade':
      return { width: 220, height: 56 }
    case 'domain':
      return { width: 220, height: 56 }
    case 'standard':
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

  switch (node.type) {
    case 'subject':
      return { ...base, background: '#0f172a', borderColor: '#0f172a', color: '#ffffff' }
    case 'grade':
      return { ...base, background: '#e0f2fe', borderColor: '#7dd3fc' }
    case 'domain':
      return { ...base, background: '#ede9fe', borderColor: '#c4b5fd' }
    case 'standard':
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

export default function GraphPage() {
  const { setDetail } = useOutletContext<DetailPanelContext>()
  const { data, index, loading, error } = useCurriculum()
  const { focusNodeId, setFocusNodeId } = useFocusNodeId()
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)

  const selectedNodeId = useMemo(() => {
    if (!focusNodeId) return null
    if (!index?.nodeById.has(focusNodeId)) return null
    return focusNodeId
  }, [focusNodeId, index])

  useEffect(() => {
    if (selectedNodeId) {
      setDetail(<NodeDetail nodeId={selectedNodeId} />)
      return
    }

    setDetail(
      <div>
        <h2>상세</h2>
        <p>노드를 클릭하면 상세가 표시됩니다.</p>
        <p>
          <span className="legend-inline contains" aria-hidden="true" /> contains
          · <span className="legend-inline progression" aria-hidden="true" /> progression
        </p>
      </div>
    )
  }, [selectedNodeId, setDetail])

  const graphNodes = useMemo((): GraphNode[] => {
    if (!data) return []

    return getGraphVisibleNodes(data.nodes)
      .map((node) => {
        const dims = getNodeDims(node.type)
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
          nodeType: node.type,
          label: (
            <div className="graph-node-label">
              <div className="graph-node-title">{node.title}</div>
              <div className="graph-node-id">{node.id}</div>
            </div>
          )
        },
        style
      }
    })
  }, [data, selectedNodeId])

  const containsEdges = useMemo((): GraphEdge[] => {
    if (!data || !index) return []

    const refs = buildContainsEdgeRefsSkippingGradeNodes(data.nodes, index.nodeById)

    return refs.map((edge) => ({
      id: `contains:${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      data: { edgeType: 'contains' },
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: '#94a3b8' }
    }))
  }, [data, index])

  const progressionEdges = useMemo((): GraphEdge[] => {
    if (!data) return []

    return buildProgressionEdges(data.nodes).map((edge) => {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        data: { edgeType: 'progression' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: {
          stroke: '#0284c7',
          strokeDasharray: '6 4'
        }
      }
    })
  }, [data])

  const graphEdges = useMemo(() => {
    return [...containsEdges, ...progressionEdges]
  }, [containsEdges, progressionEdges])

  const layoutedNodes = useMemo(() => {
    if (graphNodes.length === 0) {
      return []
    }

    return layoutWithDagre(graphNodes, containsEdges, 'TB')
  }, [containsEdges, graphNodes])

  useEffect(() => {
    if (!rfInstance || !selectedNodeId) {
      return
    }

    const target = layoutedNodes.find((node) => node.id === selectedNodeId)
    if (!target) {
      return
    }

    const dims = getNodeDims(target.data.nodeType)
    const centerX = target.position.x + dims.width / 2
    const centerY = target.position.y + dims.height / 2
    rfInstance.setCenter(centerX, centerY, { zoom: 1.2, duration: 450 })
  }, [layoutedNodes, rfInstance, selectedNodeId])

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: GraphNode) => {
      setFocusNodeId(node.id)
    },
    [setFocusNodeId]
  )

  return (
    <section>
      <h1>그래프</h1>

      <div className="graph-toolbar">
        <div className="graph-legend">
          <span className="legend-item">
            <span className="legend-line contains" aria-hidden="true" /> contains
          </span>
          <span className="legend-item">
            <span className="legend-line progression" aria-hidden="true" /> progression
          </span>
        </div>

        {selectedNodeId ? (
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setFocusNodeId(null, { replace: true })}
          >
            선택 해제
          </button>
        ) : null}

        <div className="graph-meta">
          {data ? (
            <span>
              nodes: {graphNodes.length} · edges: {graphEdges.length}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? <p>Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {data ? (
        <div className="graph-canvas">
          <ReactFlow
            nodes={layoutedNodes}
            edges={graphEdges}
            onNodeClick={onNodeClick}
            onInit={setRfInstance}
            fitView
          >
            <Background gap={16} color="#e2e8f0" />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                const t = (node.data as GraphNodeData | undefined)?.nodeType
                if (t === 'subject') return '#0f172a'
                if (t === 'domain') return '#a78bfa'
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
