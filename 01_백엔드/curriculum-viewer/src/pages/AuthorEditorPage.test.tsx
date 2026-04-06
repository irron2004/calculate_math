import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, AUTH_STORAGE_KEY } from '../lib/auth/AuthProvider'
import { CurriculumProvider } from '../lib/curriculum/CurriculumProvider'
import { RepositoryProvider } from '../lib/repository/RepositoryProvider'
import { getSkillGraphDraftKey } from '../lib/repository/graphModel'
import { setAuthorActiveGraphId } from '../lib/skillGraph/authorState'
import type { SkillGraphV1 } from '../lib/skillGraph/schema'
import AuthorEditorPage from './AuthorEditorPage'

let latestReactFlowInstance: { fitView: ReturnType<typeof vi.fn>; getNodes: () => any[] } | null = null
let latestReactFlowProps: any = null

vi.mock('reactflow', async () => {
  const React = await import('react')

  const ReactFlow = (props: any) => {
    latestReactFlowProps = props
    const instanceRef = React.useRef<{ fitView: ReturnType<typeof vi.fn>; getNodes: () => any[] } | null>(null)
    if (!instanceRef.current) {
      instanceRef.current = {
        fitView: vi.fn(),
        getNodes: () => []
      }
    }
    instanceRef.current.getNodes = () => props.nodes ?? []
    latestReactFlowInstance = instanceRef.current
    React.useEffect(() => {
      props.onInit?.(instanceRef.current)
    }, [])
    return <div data-testid="reactflow">{props.children}</div>
  }

  const useNodesState = (initial: any) => {
    const [nodes, setNodes] = React.useState(initial)
    return [nodes, setNodes, vi.fn()]
  }

  const useEdgesState = (initial: any) => {
    const [edges, setEdges] = React.useState(initial)
    return [edges, setEdges, vi.fn()]
  }

  return {
    __esModule: true,
    default: ReactFlow,
    Background: () => <div data-testid="bg" />,
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />,
    useNodesState,
    useEdgesState
  }
})

const graphId = 'author-graph'

const buildStoredUser = (username = 'demo') => ({
  id: username,
  username,
  name: 'Demo User',
  grade: '1',
  email: `${username}@example.com`,
  role: 'admin' as const,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null
})

const curriculumLoader = async () => ({
  meta: { version: 1, curriculum_id: graphId },
  nodes: [
    { id: 'A', type: 'standard' as const, title: 'Alpha', children_ids: [] },
    { id: 'B', type: 'standard' as const, title: 'Beta', children_ids: [] },
    { id: 'C', type: 'standard' as const, title: 'Gamma', children_ids: [] },
    { id: 'D', type: 'standard' as const, title: 'Delta', children_ids: [] }
  ]
})

const draftGraph: SkillGraphV1 = {
  schemaVersion: 'skill-graph-v1',
  graphId,
  title: 'Author graph',
  nodes: [
    { id: 'A', nodeCategory: 'core', label: 'Alpha', start: true },
    { id: 'B', nodeCategory: 'core', label: 'Beta' },
    { id: 'C', nodeCategory: 'challenge', label: 'Gamma' },
    { id: 'D', nodeCategory: 'formal', label: 'Delta' }
  ],
  edges: [
    { edgeType: 'requires', source: 'A', target: 'B' },
    { edgeType: 'requires', source: 'B', target: 'C' }
  ],
  meta: {
    layout: {
      positions: {
        A: { x: 0, y: 0 },
        B: { x: 120, y: 0 },
        C: { x: 240, y: 0 },
        D: { x: 0, y: 120 }
      }
    }
  }
}

function seedDraft(graph: SkillGraphV1) {
  const now = '2026-01-15T00:00:00.000Z'
  window.sessionStorage.setItem(
    getSkillGraphDraftKey('demo', graph.graphId),
    JSON.stringify({
      version: 1,
      schemaVersion: 'skill-graph-v1',
      graphId: graph.graphId,
      createdAt: now,
      updatedAt: now,
      draft: graph
    })
  )
}

function readDraftEdges() {
  const raw = window.sessionStorage.getItem(getSkillGraphDraftKey('demo', graphId))
  if (!raw) return []
  return (JSON.parse(raw) as { draft: SkillGraphV1 }).draft.edges
}

function selectEdge(edgeType: string, source: string, target: string) {
  latestReactFlowProps?.onEdgeClick?.(null, {
    id: `${edgeType}:${source}->${target}`
  })
}

function renderPage() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <RepositoryProvider>
          <CurriculumProvider autoLoad loader={curriculumLoader}>
            <AuthorEditorPage />
          </CurriculumProvider>
        </RepositoryProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

let originalRaf: typeof window.requestAnimationFrame | undefined

describe('AuthorEditorPage', () => {
  beforeEach(() => {
    latestReactFlowInstance = null
    latestReactFlowProps = null
    window.localStorage.clear()
    window.sessionStorage.clear()
    originalRaf = window.requestAnimationFrame
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0)
      return 0
    }) as typeof window.requestAnimationFrame
  })

  afterEach(() => {
    if (originalRaf) {
      window.requestAnimationFrame = originalRaf
    } else {
      delete (window as { requestAnimationFrame?: typeof window.requestAnimationFrame }).requestAnimationFrame
    }
  })

  it('shows startable nodes list with count', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft(draftGraph)

    renderPage()

    const heading = await screen.findByRole('heading', { name: 'Startable Nodes (2)' })
    const list = heading.nextElementSibling as HTMLElement
    expect(list).toBeTruthy()

    const scoped = within(list)
    expect(scoped.getByRole('button', { name: 'Alpha' })).toBeInTheDocument()
    expect(scoped.getByRole('button', { name: 'Delta' })).toBeInTheDocument()
    expect(scoped.queryByRole('button', { name: 'Beta' })).toBeNull()
  })

  it('focuses the canvas when a node is clicked from the list', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft(draftGraph)

    renderPage()

    expect(await screen.findByTestId('reactflow')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Beta' }))

    await waitFor(() => expect(latestReactFlowInstance?.fitView).toHaveBeenCalled())
  })

  it('shows edge edit controls when an edge is selected', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft(draftGraph)

    renderPage()

    await screen.findByTestId('reactflow')
    await waitFor(() => expect(latestReactFlowProps?.onEdgeClick).toBeTruthy())

    selectEdge('requires', 'A', 'B')

    const deleteButton = await screen.findByRole('button', { name: '엣지 삭제' })
    expect(deleteButton).toBeInTheDocument()

    const select = (await screen.findByLabelText('타입 변경')) as HTMLSelectElement
    expect(select.value).toBe('requires')
  })

  it('adds an edge with the selected edgeType when connecting nodes', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft(draftGraph)

    renderPage()

    await screen.findByTestId('reactflow')

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('엣지 타입'), 'prepares_for')

    await waitFor(() => expect(latestReactFlowProps?.onConnect).toBeTruthy())
    latestReactFlowProps.onConnect({
      source: 'B',
      target: 'D',
      sourceHandle: null,
      targetHandle: null
    })

    await waitFor(() => {
      const edges = readDraftEdges()
      expect(edges).toEqual(
        expect.arrayContaining([{ edgeType: 'prepares_for', source: 'B', target: 'D' }])
      )
    })
  })

  it('blocks invalid drag connections and keeps the draft unchanged', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft(draftGraph)

    renderPage()

    await screen.findByTestId('reactflow')

    await waitFor(() => expect(latestReactFlowProps?.onConnect).toBeTruthy())
    latestReactFlowProps.onConnect({
      source: 'B',
      target: 'A',
      sourceHandle: null,
      targetHandle: null
    })

    expect(
      await screen.findByText('start 노드에는 requires 연결을 추가할 수 없습니다.', {
        selector: '.error'
      })
    ).toBeInTheDocument()

    const edges = readDraftEdges()
    expect(edges).toHaveLength(2)
  })

  it('deletes a selected edge via the button', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft(draftGraph)

    renderPage()

    await screen.findByTestId('reactflow')
    await waitFor(() => expect(latestReactFlowProps?.onEdgeClick).toBeTruthy())

    selectEdge('requires', 'A', 'B')

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '엣지 삭제' }))

    await waitFor(() => {
      const edges = readDraftEdges()
      expect(edges).toEqual(
        expect.not.arrayContaining([{ edgeType: 'requires', source: 'A', target: 'B' }])
      )
    })
  })

  it('deletes a selected edge via the Delete key', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft(draftGraph)

    renderPage()

    await screen.findByTestId('reactflow')
    await waitFor(() => expect(latestReactFlowProps?.onEdgeClick).toBeTruthy())

    selectEdge('requires', 'B', 'C')

    await screen.findByRole('button', { name: '엣지 삭제' })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    await waitFor(() => {
      const edges = readDraftEdges()
      expect(edges).toEqual(
        expect.not.arrayContaining([{ edgeType: 'requires', source: 'B', target: 'C' }])
      )
    })
  })

  it('updates edge type and saves the draft', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft(draftGraph)

    renderPage()

    await screen.findByTestId('reactflow')
    await waitFor(() => expect(latestReactFlowProps?.onEdgeClick).toBeTruthy())

    selectEdge('requires', 'B', 'C')

    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText('타입 변경'), 'related')

    await waitFor(() => {
      const edges = readDraftEdges()
      expect(edges).toEqual(
        expect.arrayContaining([{ edgeType: 'related', source: 'B', target: 'C' }])
      )
    })
  })

  it('blocks edge type changes that would duplicate an existing edge', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft({
      ...draftGraph,
      edges: [
        ...draftGraph.edges,
        { edgeType: 'prepares_for', source: 'A', target: 'B' }
      ]
    })

    renderPage()

    await screen.findByTestId('reactflow')
    await waitFor(() => expect(latestReactFlowProps?.onEdgeClick).toBeTruthy())

    selectEdge('requires', 'A', 'B')

    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText('타입 변경'), 'prepares_for')

    expect(
      await screen.findByText('이미 동일한 연결이 존재합니다.', { selector: '.error' })
    ).toBeInTheDocument()

    const edges = readDraftEdges()
    expect(edges).toEqual(
      expect.arrayContaining([
        { edgeType: 'requires', source: 'A', target: 'B' },
        { edgeType: 'prepares_for', source: 'A', target: 'B' }
      ])
    )
  })

  it('creates an edge and saves the draft when clicking a connectable target', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft(draftGraph)

    renderPage()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Beta' }))

    const heading = await screen.findByRole('heading', { name: 'Connectable Targets' })
    const list = heading.nextElementSibling as HTMLElement
    expect(list).toBeTruthy()

    const scoped = within(list)
    await user.click(scoped.getByRole('button', { name: 'Delta' }))

    await waitFor(() => {
      const edges = readDraftEdges()
      expect(edges).toEqual(
        expect.arrayContaining([{ edgeType: 'requires', source: 'B', target: 'D' }])
      )
    })
  })

  it('shows a reason and does not change the graph when clicking a blocked target', async () => {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    setAuthorActiveGraphId(graphId)
    seedDraft(draftGraph)

    renderPage()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Beta' }))

    const heading = await screen.findByRole('heading', { name: 'Connectable Targets' })
    const list = heading.nextElementSibling as HTMLElement
    expect(list).toBeTruthy()

    const scoped = within(list)
    await user.click(scoped.getByRole('button', { name: 'Alpha' }))

    expect(
      await screen.findByText('start 노드에는 requires 연결을 추가할 수 없습니다.', {
        selector: '.error'
      })
    ).toBeInTheDocument()

    const edges = readDraftEdges()
    expect(edges).toHaveLength(2)
  })
})
