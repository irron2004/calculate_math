import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactNode, useState } from 'react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import type { DetailPanelContext } from '../components/AppLayout'
import { AuthProvider } from '../lib/auth/AuthProvider'
import { CurriculumProvider } from '../lib/curriculum/CurriculumProvider'
import GraphPage from './GraphPage'

let latestReactFlowProps: any = null

vi.mock('reactflow', () => {
  const ReactFlow = (props: any) => {
    latestReactFlowProps = props
    return (
      <div data-testid="reactflow">
        {(props.nodes ?? []).map((node: any) => (
          <button key={node.id} type="button" onClick={() => props.onNodeClick?.(null, node)}>
            {node.id}
          </button>
        ))}
        {props.children}
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

function TestLayout() {
  const [detail, setDetail] = useState<ReactNode>(null)
  const outletContext: DetailPanelContext = { setDetail }

  return (
    <div>
      <Outlet context={outletContext} />
      <aside aria-label="Detail panel">
        {detail}
      </aside>
    </div>
  )
}

describe('GraphPage (/map) curriculum graph viewer', () => {
  beforeEach(() => {
    latestReactFlowProps = null
  })

  const curriculumLoader = async () => ({
    meta: { version: 1 },
    nodes: [
      { id: 'S', type: 'subject' as const, title: 'Math', children_ids: ['G1', 'G2'] },
      { id: 'G1', type: 'grade' as const, title: 'Grade 1', parent_id: 'S', children_ids: ['D1'] },
      { id: 'G2', type: 'grade' as const, title: 'Grade 2', parent_id: 'S', children_ids: ['D2'] },
      { id: 'D1', type: 'domain' as const, title: 'Numbers', parent_id: 'G1', children_ids: ['ST1'], domain_code: 'NA', grade: 1 },
      { id: 'D2', type: 'domain' as const, title: 'Numbers', parent_id: 'G2', children_ids: ['ST2'], domain_code: 'NA', grade: 2 },
      { id: 'ST1', type: 'standard' as const, title: 'Add', parent_id: 'D1', children_ids: [] },
      { id: 'ST2', type: 'standard' as const, title: 'Subtract', parent_id: 'D2', children_ids: [] }
    ]
  })

  it('renders curriculum graph nodes/edges and disables edits', async () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <AuthProvider>
          <CurriculumProvider autoLoad loader={curriculumLoader}>
            <Routes>
              <Route element={<TestLayout />}>
                <Route path="/map" element={<GraphPage />} />
              </Route>
            </Routes>
          </CurriculumProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: '지도' })).toBeInTheDocument()

    expect(latestReactFlowProps).not.toBeNull()
    expect(latestReactFlowProps.fitView).toBe(true)
    expect(latestReactFlowProps.nodesDraggable).toBe(false)
    expect(latestReactFlowProps.nodesConnectable).toBe(false)
    expect(latestReactFlowProps.deleteKeyCode).toBeNull()

    const nodeIds = (latestReactFlowProps.nodes ?? []).map((n: any) => n.id)
    expect(nodeIds).toEqual(expect.arrayContaining(['S', 'D1', 'D2', 'ST1', 'ST2']))
    expect(nodeIds).not.toEqual(expect.arrayContaining(['G1', 'G2']))

    const edgeKeys = (latestReactFlowProps.edges ?? []).map((edge: any) => `${edge.source}->${edge.target}`)
    expect(edgeKeys).toEqual(expect.arrayContaining(['S->D1', 'S->D2', 'D1->ST1', 'D2->ST2', 'D1->D2']))
  })

  it('shows an empty detail panel message when nothing is selected', async () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <AuthProvider>
          <CurriculumProvider autoLoad loader={curriculumLoader}>
            <Routes>
              <Route element={<TestLayout />}>
                <Route path="/map" element={<GraphPage />} />
              </Route>
            </Routes>
          </CurriculumProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: '노드 상세' })).toBeInTheDocument()
    expect(screen.getByText('지도의 노드를 클릭하세요.')).toBeInTheDocument()
  })

  it('updates the detail panel when a node is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <AuthProvider>
          <CurriculumProvider autoLoad loader={curriculumLoader}>
            <Routes>
              <Route element={<TestLayout />}>
                <Route path="/map" element={<GraphPage />} />
              </Route>
            </Routes>
          </CurriculumProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: '지도' })).toBeInTheDocument()

    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'D1' }))

    const detail = await screen.findByRole('complementary', { name: /detail panel/i })

    expect(within(detail).getByText('Numbers', { selector: 'dd' })).toBeInTheDocument()
    expect(within(detail).getByText('D1', { selector: 'dd' })).toBeInTheDocument()
  })
})
