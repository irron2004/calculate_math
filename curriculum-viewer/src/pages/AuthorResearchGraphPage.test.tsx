import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
              { id: 'TU2', nodeType: 'textbookUnit', label: 'Unit 2' },
              { id: 'TU3', nodeType: 'textbookUnit', label: 'Unit 3' },
              { id: 'TU4', nodeType: 'textbookUnit', label: 'Unit 4' }
            ],
            edges: [
              { id: 'contains:ROOT->TU1', edgeType: 'contains', source: 'ROOT', target: 'TU1' },
              { id: 'prereq:TU1->TU2', edgeType: 'prereq', source: 'TU1', target: 'TU2' },
              { id: 'prereq:TU3->TU4', edgeType: 'prereq', source: 'TU3', target: 'TU4' }
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

  function mockFetchWithPatchAlignsTo() {
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
              { id: 'BRIDGE', nodeType: 'textbookUnit', label: 'Bridge Unit' },
              { id: 'ACH1', nodeType: 'achievement', label: 'Achievement 1', text: 'goal text' }
            ],
            edges: [{ id: 'contains:ROOT->BRIDGE', edgeType: 'contains', source: 'ROOT', target: 'BRIDGE' }]
          })
        }
      }

      if (url === '/data/problems_2022_v1.json') {
        return {
          ok: true,
          json: async () => ({
            version: 1,
            problemsByNodeId: {
              ACH1: [
                {
                  id: 'ach1-1',
                  type: 'numeric',
                  prompt: 'example prompt',
                  answer: '10'
                }
              ]
            }
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

      if (url === '/data/research/patch_T1.json' || url === '/data/research/patch_T2.json' || url === '/data/research/patch_T3.json') {
        return {
          ok: true,
          json: async () => ({
            schemaVersion: 'research-patch-v1',
            add_nodes: [],
            add_edges: [
              {
                source: 'BRIDGE',
                target: 'ACH1',
                edgeType: 'alignsTo',
                confidence: 0.8,
                rationale: 'maps unit goal'
              }
            ],
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

  async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms))
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

      await waitFor(() => {
        const hasAcceptedResearchEdge = (latestReactFlowProps.edges ?? []).some(
          (edge: any) => edge.source === 'TU2' && edge.target === 'TU1'
        )
        expect(hasAcceptedResearchEdge).toBe(true)
      })

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

  it('highlights connected nodes/edges on hover and dims the rest', async () => {
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
      await waitFor(() => expect(latestReactFlowProps).not.toBeNull())

      await waitFor(() => {
        expect(typeof latestReactFlowProps.onNodeMouseEnter).toBe('function')
        expect(typeof latestReactFlowProps.onNodeMouseLeave).toBe('function')
      })

      expect(screen.queryByTestId('research-hover-panel')).toBeNull()

      latestReactFlowProps.onNodeMouseEnter(null, { id: 'TU1' })

      await waitFor(() => {
        expect(screen.getByTestId('research-hover-panel')).toHaveTextContent('Unit 1')

        const tu1 = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'TU1')
        expect(tu1?.style?.outline).toContain('#f97316')

        const tu3 = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'TU3')
        expect(tu3?.style?.opacity).toBeLessThan(1)

        const connected = (latestReactFlowProps.edges ?? []).find(
          (edge: any) => edge.source === 'TU1' && edge.target === 'TU2'
        )
        expect(connected?.style?.opacity).toBeGreaterThan(0.8)

        const disconnected = (latestReactFlowProps.edges ?? []).find(
          (edge: any) => edge.source === 'TU3' && edge.target === 'TU4'
        )
        expect(disconnected?.style?.opacity).toBeLessThan(0.2)
      })

      latestReactFlowProps.onNodeMouseLeave(null, { id: 'TU1' })

      await waitFor(() => {
        const tu3 = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'TU3')
        expect(tu3?.style?.opacity).toBeUndefined()
      })
    } finally {
      restoreFetch()
    }
  })

  it('keeps hover highlight briefly after node leave before clearing state', async () => {
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
      await waitFor(() => expect(latestReactFlowProps).not.toBeNull())

      latestReactFlowProps.onNodeMouseEnter(null, { id: 'TU1' })
      await waitFor(() => expect(screen.getByTestId('research-hover-panel')).toHaveTextContent('Unit 1'))

      latestReactFlowProps.onNodeMouseLeave(null, { id: 'TU1' })

      expect(screen.getByTestId('research-hover-panel')).toHaveTextContent('Unit 1')
      const tu3WhileDebounced = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'TU3')
      expect(tu3WhileDebounced?.style?.opacity).toBeLessThan(1)

      await waitFor(() => expect(screen.queryByTestId('research-hover-panel')).toBeNull())
      await waitFor(() => {
        const tu3AfterClear = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'TU3')
        expect(tu3AfterClear?.style?.opacity).toBeUndefined()
      })
    } finally {
      restoreFetch()
    }
  })

  it('keeps hover state while pointer is in panel and clears after panel leave', async () => {
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
      await waitFor(() => expect(latestReactFlowProps).not.toBeNull())

      latestReactFlowProps.onNodeMouseEnter(null, { id: 'TU1' })
      const panel = await screen.findByTestId('research-hover-panel')

      latestReactFlowProps.onNodeMouseLeave(null, { id: 'TU1' })
      fireEvent.mouseEnter(panel)

      await sleep(180)

      expect(screen.getByTestId('research-hover-panel')).toHaveTextContent('Unit 1')
      const tu3WhilePanelHovered = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'TU3')
      expect(tu3WhilePanelHovered?.style?.opacity).toBeLessThan(1)

      fireEvent.mouseLeave(screen.getByTestId('research-hover-panel'))

      await waitFor(() => expect(screen.queryByTestId('research-hover-panel')).toBeNull())
      await waitFor(() => {
        const tu3AfterPanelLeave = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'TU3')
        expect(tu3AfterPanelLeave?.style?.opacity).toBeUndefined()
      })
    } finally {
      restoreFetch()
    }
  })

  it('cancels pending hover clear when re-entering another node quickly', async () => {
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
      await waitFor(() => expect(latestReactFlowProps).not.toBeNull())

      latestReactFlowProps.onNodeMouseEnter(null, { id: 'TU1' })
      await screen.findByTestId('research-hover-panel')

      latestReactFlowProps.onNodeMouseLeave(null, { id: 'TU1' })
      latestReactFlowProps.onNodeMouseEnter(null, { id: 'TU2' })

      await sleep(180)

      const panel = screen.getByTestId('research-hover-panel')
      expect(panel).toHaveTextContent('Unit 2')

      const tu2 = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'TU2')
      expect(tu2?.style?.outline).toContain('#f97316')

      const tu4 = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'TU4')
      expect(tu4?.style?.opacity).toBeLessThan(1)
    } finally {
      restoreFetch()
    }
  })

  it('shows goals and example prompts using alignsTo edges from patches', async () => {
    const restoreFetch = mockFetchWithPatchAlignsTo()

    try {
      render(
        <MemoryRouter initialEntries={['/author/research-graph']}>
          <Routes>
            <Route path="/author/research-graph" element={<AuthorResearchGraphPage />} />
          </Routes>
        </MemoryRouter>
      )

      await screen.findByTestId('reactflow')
      await waitFor(() => expect(latestReactFlowProps).not.toBeNull())

      latestReactFlowProps.onNodeMouseEnter(null, { id: 'BRIDGE' })

      const panel = await screen.findByTestId('research-hover-panel')
      expect(panel).toHaveTextContent('Bridge Unit')

      await waitFor(() => expect(panel).toHaveTextContent('goal text'))
      await waitFor(() => expect(panel).toHaveTextContent('example prompt'))
    } finally {
      restoreFetch()
    }
  })
})
