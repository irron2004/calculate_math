import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type ReactFlowInstance
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  buildCurriculumGraphLayout,
  type CurriculumGraphEdge,
  type CurriculumGraphNode,
  type GraphLayoutDirection
} from '../lib/curriculum/graphLayout'
import type { CurriculumNode } from '../lib/curriculum/types'
import type { NodeProgressV1, NodeStatus } from '../lib/studentLearning/types'
import LearningNodeLabel from './LearningNodeLabel'

type GraphNodeData = {
  label: ReactNode
}

type GraphNode = Node<GraphNodeData>
type GraphEdge = Edge

type Props = {
  nodes: ReadonlyArray<CurriculumNode> | null
  focusNodeId: string | null
  onNodeClick: (nodeId: string) => void
  direction?: GraphLayoutDirection
  fitViewPadding?: number
  showControls?: boolean
  showMiniMap?: boolean
  progressByNodeId?: Record<string, NodeProgressV1> | null
}

const NODE_WIDTH = 260
const NODE_HEIGHT = 112
const DEFAULT_FITVIEW_PADDING = 0.15

const NODE_COLORS: Record<string, { bg: string; border: string }> = {
  subject: { bg: 'rgba(251, 191, 36, 0.12)', border: '#f59e0b' },
  domain: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6' },
  standard: { bg: 'rgba(148, 163, 184, 0.12)', border: '#94a3b8' },
  grade: { bg: 'rgba(226, 232, 240, 0.6)', border: '#cbd5e1' }
}

const LEARNING_STATUS_COLORS: Record<NodeStatus, { bg: string; border: string }> = {
  CLEARED: { bg: 'rgba(22, 163, 74, 0.12)', border: '#16a34a' },
  AVAILABLE: { bg: 'rgba(37, 99, 235, 0.1)', border: '#2563eb' },
  IN_PROGRESS: { bg: 'rgba(217, 119, 6, 0.1)', border: '#d97706' },
  LOCKED: { bg: 'rgba(100, 116, 139, 0.12)', border: '#64748b' }
}

function findFirstVisibleDescendant(params: {
  startId: string
  nodeById: Map<string, CurriculumNode>
  visibleNodeIds: Set<string>
}): string | null {
  const startNode = params.nodeById.get(params.startId)
  if (!startNode) return null
  const queue = Array.isArray(startNode.children_ids) ? [...startNode.children_ids] : []
  const seen = new Set(queue)

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId) continue
    const node = params.nodeById.get(currentId)
    if (!node) continue
    if (params.visibleNodeIds.has(node.id)) return node.id

    const children = Array.isArray(node.children_ids) ? node.children_ids : []
    for (const childId of children) {
      if (!seen.has(childId)) {
        seen.add(childId)
        queue.push(childId)
      }
    }
  }

  return null
}

function findFirstVisibleAncestor(params: {
  startId: string
  nodeById: Map<string, CurriculumNode>
  visibleNodeIds: Set<string>
}): string | null {
  let cursor = params.nodeById.get(params.startId) ?? null
  const seen = new Set<string>()

  while (cursor && typeof cursor.parent_id === 'string') {
    if (seen.has(cursor.id)) break
    seen.add(cursor.id)

    const parent = params.nodeById.get(cursor.parent_id) ?? null
    if (!parent) return null
    if (params.visibleNodeIds.has(parent.id)) return parent.id
    cursor = parent
  }

  return null
}

function resolveVisibleFocusId(params: {
  focusNodeId: string | null
  nodeById: Map<string, CurriculumNode>
  visibleNodeIds: Set<string>
}): string | null {
  if (!params.focusNodeId) return null
  if (params.visibleNodeIds.has(params.focusNodeId)) return params.focusNodeId
  if (!params.nodeById.has(params.focusNodeId)) return null

  const descendant = findFirstVisibleDescendant({
    startId: params.focusNodeId,
    nodeById: params.nodeById,
    visibleNodeIds: params.visibleNodeIds
  })
  if (descendant) return descendant

  return findFirstVisibleAncestor({
    startId: params.focusNodeId,
    nodeById: params.nodeById,
    visibleNodeIds: params.visibleNodeIds
  })
}

function getNodeStyle(params: {
  nodeType: string
  isSelected: boolean
  learningStatus?: NodeStatus | null
}): CSSProperties {
  // 학습 상태가 있으면 학습 상태 색상 우선 적용
  const colors = params.learningStatus
    ? LEARNING_STATUS_COLORS[params.learningStatus]
    : (NODE_COLORS[params.nodeType] ?? NODE_COLORS.standard)
  const isLocked = params.learningStatus === 'LOCKED'
  const opacity = isLocked ? (params.isSelected ? 0.85 : 0.6) : 1
  return {
    borderRadius: 12,
    border: params.isSelected ? `2px solid ${colors.border}` : `1px solid ${colors.border}`,
    background: colors.bg,
    color: '#0f172a',
    padding: 10,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    boxShadow: params.isSelected ? `0 0 0 3px ${colors.border}33` : 'none',
    opacity
  }
}

function getEdgeStyle(edgeType: CurriculumGraphEdge['edgeType']): CSSProperties {
  if (edgeType === 'progression') {
    return {
      stroke: '#0284c7',
      strokeWidth: 2,
      strokeDasharray: '6 4',
      opacity: 0.7
    }
  }
  return {
    stroke: '#94a3b8',
    strokeWidth: 2,
    opacity: 0.8
  }
}

function buildNodeLabel(node: CurriculumGraphNode, status?: NodeStatus | null) {
  if (status) {
    return <LearningNodeLabel title={node.title} nodeId={node.id} status={status} />
  }

  return (
    <div className="graph-node-label">
      <div className="graph-node-title">{node.title}</div>
      <div className="muted" style={{ fontSize: 11 }}>
        {node.type}
      </div>
      <div className="graph-node-id mono">{node.id}</div>
    </div>
  )
}

export default function CurriculumGraphView({
  nodes,
  focusNodeId,
  onNodeClick,
  direction = 'TB',
  fitViewPadding = DEFAULT_FITVIEW_PADDING,
  showControls = true,
  showMiniMap = true,
  progressByNodeId = null
}: Props) {
  const instanceRef = useRef<ReactFlowInstance | null>(null)

  const layout = useMemo(() => {
    if (!nodes) return { nodes: [], edges: [] }
    return buildCurriculumGraphLayout({ nodes, direction })
  }, [nodes, direction])

  const nodeById = useMemo(() => {
    return new Map((nodes ?? []).map((node) => [node.id, node]))
  }, [nodes])

  const visibleNodeIds = useMemo(() => new Set(layout.nodes.map((node) => node.id)), [layout.nodes])
  const resolvedFocusId = useMemo(
    () =>
      resolveVisibleFocusId({
        focusNodeId,
        nodeById,
        visibleNodeIds
      }),
    [focusNodeId, nodeById, visibleNodeIds]
  )

  const graphNodes = useMemo<GraphNode[]>(() => {
    return layout.nodes.map((node) => {
      const learningStatus = progressByNodeId?.[node.id]?.status ?? null
      return {
        id: node.id,
        position: node.position,
        data: { label: buildNodeLabel(node, learningStatus) },
        style: getNodeStyle({
          nodeType: node.type,
          isSelected: node.id === resolvedFocusId,
          learningStatus
        })
      }
    })
  }, [layout.nodes, resolvedFocusId, progressByNodeId])

  const graphEdges = useMemo<GraphEdge[]>(() => {
    return layout.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      style: getEdgeStyle(edge.edgeType)
    }))
  }, [layout.edges])

  useEffect(() => {
    if (!resolvedFocusId) return
    const instance = instanceRef.current
    if (!instance || typeof instance.fitView !== 'function') return
    const target = graphNodes.filter((node) => node.id === resolvedFocusId)
    if (target.length === 0) return
    instance.fitView({ nodes: target, padding: 0.4, duration: 250 })
  }, [resolvedFocusId, graphNodes])

  return (
    <ReactFlow
      nodes={graphNodes}
      edges={graphEdges}
      fitView
      fitViewOptions={{ padding: fitViewPadding }}
      nodesConnectable={false}
      nodesDraggable={false}
      deleteKeyCode={null}
      onNodeClick={(_, node) => onNodeClick(node.id)}
      onInit={(instance) => {
        instanceRef.current = instance
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Background gap={18} size={1} color="#e2e8f0" />
      {showControls ? <Controls /> : null}
      {showMiniMap ? <MiniMap nodeStrokeWidth={2} pannable zoomable /> : null}
    </ReactFlow>
  )
}
