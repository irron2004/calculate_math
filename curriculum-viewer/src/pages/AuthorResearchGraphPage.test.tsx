import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthorResearchGraphPage from './AuthorResearchGraphPage'

let latestReactFlowProps: any = null

vi.mock('reactflow', () => {
  const ReactFlow = (props: any) => {
    latestReactFlowProps = props
    return <div data-testid="reactflow">{props.children}</div>
  }

  return {
    __esModule: true,
    default: ReactFlow,
    Background: () => <div data-testid="bg" />,
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />
  }
})

describe('/author/research-graph', () => {
  beforeEach(() => {
    latestReactFlowProps = null
    window.localStorage.clear()
  })

  function mockFetch() {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/data/curriculum_math_2022.json') {
        return {
          ok: true,
          json: async () => ({
            meta: { curriculumId: 'KR-MATH-2022' },
            nodes: [
              { id: 'ROOT', nodeType: 'root', label: 'Root' },
              { id: 'TU1', nodeType: 'textbookUnit', label: 'Unit 1' },
              { id: 'TU2', nodeType: 'textbookUnit', label: 'Unit 2' }
            ],
            edges: [
              { id: 'contains:ROOT->TU1', edgeType: 'contains', source: 'ROOT', target: 'TU1' },
              { id: 'prereq:TU1->TU2', edgeType: 'prereq', source: 'TU1', target: 'TU2' }
            ]
          })
        }
      }

      if (url === '/data/research/manifest.json') {
        return {
          ok: true,
          json: async () => ({
            schemaVersion: 'research-manifest-v1',
            patchByTrack: {
              T1: '/data/research/patch_T1.json',
              T2: '/data/research/patch_T2.json',
              T3: '/data/research/patch_T3.json'
            }
          })
        }
      }

      if (url === '/data/research/patch_T3.json') {
        return {
          ok: true,
          json: async () => ({
            add_nodes: [],
            add_edges: [{ source: 'TU2', target: 'TU1', edgeType: 'prereq' }],
            remove_edges: []
          })
        }
      }

      if (url === '/data/research/patch_T1.json' || url === '/data/research/patch_T2.json') {
        return {
          ok: true,
          json: async () => ({
            add_nodes: [],
            add_edges: [],
            remove_edges: []
          })
        }
      }

      return { ok: false, status: 404 }
    }) as unknown as typeof fetch

    return () => {
      globalThis.fetch = originalFetch
    }
  }

  it('renders the page header and graph canvas', async () => {
    const restoreFetch = mockFetch()

    try {
      render(
        <MemoryRouter initialEntries={['/author/research-graph']}>
          <Routes>
            <Route path="/author/research-graph" element={<AuthorResearchGraphPage />} />
          </Routes>
        </MemoryRouter>
      )

      expect(await screen.findByRole('heading', { name: 'Research Graph Editor' })).toBeInTheDocument()
      expect(screen.getByLabelText('Research graph canvas')).toBeInTheDocument()

      await waitFor(() => expect(latestReactFlowProps).not.toBeNull())
      const nodeIds = (latestReactFlowProps.nodes ?? []).map((node: any) => node.id)
      expect(nodeIds).toEqual(expect.arrayContaining(['TU1', 'TU2']))

      const prereqEdge = (latestReactFlowProps.edges ?? []).find((edge: any) => edge.edgeType === 'prereq' || edge.label === 'prereq')
      expect(prereqEdge?.style?.stroke).toBeTruthy()
    } finally {
      restoreFetch()
    }
  })

  it('creates a proposed node via the form with generated id', async () => {
    const restoreFetch = mockFetch()

    try {
      render(
        <MemoryRouter initialEntries={['/author/research-graph']}>
          <Routes>
            <Route path="/author/research-graph" element={<AuthorResearchGraphPage />} />
          </Routes>
        </MemoryRouter>
      )

      await screen.findByTestId('reactflow')

      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: 'Proposed 노드 추가' }))
      await user.type(screen.getByLabelText('label'), '입체도형의 구성 요소와 전개도')
      await user.type(screen.getByLabelText('note (optional)'), 'bridge node')
      await user.click(screen.getByRole('button', { name: '생성' }))

      await waitFor(() => {
        const nodeIds = (latestReactFlowProps.nodes ?? []).map((node: any) => node.id)
        expect(nodeIds.some((id: string) => id.startsWith('P_TU_'))).toBe(true)
      })
    } finally {
      restoreFetch()
    }
  })

  it('blocks proposed node creation when slug is invalid', async () => {
    const restoreFetch = mockFetch()

    try {
      render(
        <MemoryRouter initialEntries={['/author/research-graph']}>
          <Routes>
            <Route path="/author/research-graph" element={<AuthorResearchGraphPage />} />
          </Routes>
        </MemoryRouter>
      )

      await screen.findByTestId('reactflow')

      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: 'Proposed 노드 추가' }))
      await user.type(screen.getByLabelText('label'), '***')
      await user.click(screen.getByRole('button', { name: '생성' }))

      expect(await screen.findByText(/유효한 slug를 생성할 수 없습니다/i)).toBeInTheDocument()

      const nodeIds = (latestReactFlowProps.nodes ?? []).map((node: any) => node.id)
      expect(nodeIds.some((id: string) => id.startsWith('P_TU_'))).toBe(false)
    } finally {
      restoreFetch()
    }
  })
})
