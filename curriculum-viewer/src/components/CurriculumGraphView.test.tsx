import { render, screen } from '@testing-library/react'
import CurriculumGraphView from './CurriculumGraphView'
import type { NodeProgressV1 } from '../lib/studentLearning/types'

let latestReactFlowProps: any = null

vi.mock('reactflow', () => {
  const ReactFlow = (props: any) => {
    latestReactFlowProps = props
    return (
      <div data-testid="reactflow">
        {(props.nodes ?? []).map((node: any) => (
          <div key={node.id} data-node-id={node.id}>
            {node.data?.label}
          </div>
        ))}
      </div>
    )
  }

  return {
    __esModule: true,
    default: ReactFlow,
    Background: () => <div data-testid="bg" />,
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />
  }
})

describe('CurriculumGraphView learning overlays', () => {
  const curriculumNodes = [
    { id: 'S', type: 'subject' as const, title: 'Subject', children_ids: ['D1'] },
    { id: 'D1', type: 'domain' as const, title: 'Domain 1', parent_id: 'S', children_ids: [] }
  ]

  const progressByNodeId: Record<string, NodeProgressV1> = {
    S: {
      nodeId: 'S',
      status: 'AVAILABLE',
      bestAccuracy: null,
      lastAttemptAt: null,
      clearedAt: null
    },
    D1: {
      nodeId: 'D1',
      status: 'LOCKED',
      bestAccuracy: null,
      lastAttemptAt: null,
      clearedAt: null,
      lockedReasons: { missingPrereqNodeIds: ['S'] }
    }
  }

  beforeEach(() => {
    latestReactFlowProps = null
  })

  it('renders status badges in node labels when progress is provided', () => {
    render(
      <CurriculumGraphView
        nodes={curriculumNodes}
        focusNodeId={null}
        onNodeClick={() => {}}
        progressByNodeId={progressByNodeId}
        showControls={false}
        showMiniMap={false}
      />
    )

    expect(screen.getByText('도전 가능')).toBeInTheDocument()
    expect(screen.getByText('잠금')).toBeInTheDocument()
    expect(screen.getByText('Subject')).toBeInTheDocument()
    expect(screen.getByText('Domain 1')).toBeInTheDocument()
  })

  it('dims locked nodes to indicate unavailable status', () => {
    render(
      <CurriculumGraphView
        nodes={curriculumNodes}
        focusNodeId={null}
        onNodeClick={() => {}}
        progressByNodeId={progressByNodeId}
        showControls={false}
        showMiniMap={false}
      />
    )

    const lockedNode = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'D1')
    expect(lockedNode?.style?.opacity).toBe(0.6)
  })
})
