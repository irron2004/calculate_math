import { useEffect, useMemo, useRef } from 'react'
import ReactFlow, { Background, Controls, type Edge, type Node, type ReactFlowInstance } from 'reactflow'
import 'reactflow/dist/style.css'
import type { SkillGraphEdgeType, SkillGraphV1 } from '../lib/skillGraph/schema'

type GraphNodeData = { label: React.ReactNode }

const NODE_WIDTH = 300
const NODE_HEIGHT = 90
const GRID_GAP_X = 60
const GRID_GAP_Y = 40

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

export default function SkillGraphPreview(params: {
  graph: SkillGraphV1
  focusNodeId?: string | null
}) {
  const instanceRef = useRef<ReactFlowInstance | null>(null)

  const positions = useMemo(() => {
    const meta = params.graph.meta
    if (!meta || typeof meta !== 'object') return {}
    const layout = (meta as Record<string, unknown>).layout
    if (!layout || typeof layout !== 'object') return {}
    const raw = (layout as Record<string, unknown>).positions
    if (!raw || typeof raw !== 'object') return {}

    const result: Record<string, { x: number; y: number }> = {}
    for (const [nodeId, value] of Object.entries(raw)) {
      if (!value || typeof value !== 'object') continue
      const x = typeof (value as { x?: number }).x === 'number' ? (value as { x: number }).x : null
      const y = typeof (value as { y?: number }).y === 'number' ? (value as { y: number }).y : null
      if (x === null || y === null) continue
      result[nodeId] = { x, y }
    }
    return result
  }, [params.graph.meta])

  const view = useMemo(() => {
    const nodes: Array<Node<GraphNodeData>> = params.graph.nodes.map((node, index) => {
      const isFocused = params.focusNodeId === node.id
      const position =
        positions[node.id] ?? {
          x: (index % 2) * (NODE_WIDTH + GRID_GAP_X),
          y: Math.floor(index / 2) * (NODE_HEIGHT + GRID_GAP_Y)
        }
      return {
        id: node.id,
        position,
        data: {
          label: (
            <div>
              <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                {node.nodeCategory}
                {node.start ? ' · start' : ''}
              </div>
              <div style={{ fontWeight: 600 }}>{node.label}</div>
              <div className="mono" style={{ fontSize: 12, opacity: 0.75 }}>
                {node.id}
              </div>
            </div>
          )
        },
        style: {
          borderRadius: 12,
          border: isFocused ? '2px solid #0f172a' : '1px solid #e2e8f0',
          background: '#ffffff',
          padding: 10,
          width: NODE_WIDTH
        }
      }
    })

    const edges: Edge[] = params.graph.edges.map((edge) => {
      const color = getEdgeColor(edge.edgeType)
      return {
        id: `${edge.edgeType}:${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        label: edge.edgeType,
        style: { stroke: color, strokeWidth: 2, opacity: 0.95 },
        labelStyle: { fill: color, fontSize: 12 }
      }
    })

    return { nodes, edges }
  }, [params.focusNodeId, params.graph.edges, params.graph.nodes])

  useEffect(() => {
    if (!params.focusNodeId) return
    const instance = instanceRef.current
    if (!instance) return
    const nodes = instance.getNodes().filter((node) => node.id === params.focusNodeId)
    if (nodes.length === 0) return
    instance.fitView({ nodes, padding: 0.5, duration: 250 })
  }, [params.focusNodeId])

  return (
    <div style={{ height: 520, border: '1px solid #e2e8f0', borderRadius: 12, background: '#ffffff', overflow: 'hidden' }}>
      <ReactFlow
        nodes={view.nodes}
        edges={view.edges}
        fitView
        nodesConnectable={false}
        nodesDraggable={false}
        deleteKeyCode={null}
        onInit={(instance) => {
          instanceRef.current = instance
        }}
      >
        <Background gap={18} size={1} color="#e2e8f0" />
        <Controls />
      </ReactFlow>
    </div>
  )
}
