import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CurriculumProvider } from '../lib/curriculum/CurriculumProvider'
import { validateCurriculum } from '../lib/curriculum/validate'
import { sortCurriculumIssues } from '../lib/curriculum/validateCore.js'
import HealthPage from './HealthPage'

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

function LocationEcho() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

describe('HealthPage (Author /author/health)', () => {
  beforeEach(() => {
    latestReactFlowProps = null
  })

  it('renders sorted issues and focuses the graph when clicking a row', async () => {
    const nodes = [
      { id: 'S', type: 'subject' as const, title: 'Subject S', children_ids: ['missing-child', 'G1'] },
      { id: 'G1', type: 'grade' as const, title: 'Grade 1', parent_id: 'S', children_ids: [] },
      { id: 'dup', type: 'grade' as const, title: 'Dup A', parent_id: 'S', children_ids: [] },
      { id: 'dup', type: 'domain' as const, title: 'Dup B', parent_id: 'dup', children_ids: [] },
      { id: 'orphan', type: 'domain' as const, title: 'Orphan', parent_id: 'missing-parent', children_ids: [] }
    ]

    render(
      <MemoryRouter initialEntries={['/author/health']}>
        <CurriculumProvider
          autoLoad
          loader={async () => ({
            meta: { version: 1 },
            nodes
          })}
        >
          <Routes>
            <Route
              path="/author/health"
              element={
                <div>
                  <HealthPage />
                  <LocationEcho />
                </div>
              }
            />
          </Routes>
        </CurriculumProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: '데이터 검증' })).toBeInTheDocument()
    expect(await screen.findByTestId('reactflow')).toBeInTheDocument()

    const table = await screen.findByRole('table')

    const expectedOrder = sortCurriculumIssues(validateCurriculum(nodes as any[])).map(
      (issue) => `${issue.severity}|${issue.code}`
    )
    const rows = within(table).getAllByRole('row').slice(1)
    const renderedOrder = rows.map((row) => {
      const cells = within(row).getAllByRole('cell')
      return `${cells[0]?.textContent ?? ''}|${cells[1]?.textContent ?? ''}`
    })
    expect(renderedOrder).toEqual(expectedOrder)

    const user = userEvent.setup()
    await user.click(within(table).getByText('missing_child'))

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/author/health?focus=S')
    })
    const focusedNode = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'S')
    expect(focusedNode?.style?.border).toContain('2px solid')
  })

  it('maps grade issues to visible nodes in the graph', async () => {
    const nodes = [
      { id: 'S', type: 'subject' as const, title: 'Subject S', children_ids: ['G1'] },
      { id: 'G1', type: 'grade' as const, title: 'Grade 1', children_ids: ['D1'] },
      { id: 'D1', type: 'domain' as const, title: 'Domain 1', parent_id: 'G1', children_ids: [] }
    ]

    render(
      <MemoryRouter initialEntries={['/author/health']}>
        <CurriculumProvider
          autoLoad
          loader={async () => ({
            meta: { version: 1 },
            nodes
          })}
        >
          <Routes>
            <Route
              path="/author/health"
              element={
                <div>
                  <HealthPage />
                  <LocationEcho />
                </div>
              }
            />
          </Routes>
        </CurriculumProvider>
      </MemoryRouter>
    )

    const table = await screen.findByRole('table')
    const user = userEvent.setup()
    await user.click(within(table).getByText('missing_parent'))

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/author/health?focus=G1')
      const focusedNode = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'D1')
      expect(focusedNode?.style?.border).toContain('2px solid')
    })
    const gradeNode = (latestReactFlowProps.nodes ?? []).find((node: any) => node.id === 'G1')
    expect(gradeNode).toBeUndefined()
  })

  it('shows a success state when there are no issues', async () => {
    render(
      <MemoryRouter initialEntries={['/author/health']}>
        <CurriculumProvider
          autoLoad
          loader={async () => ({
            meta: { version: 1 },
            nodes: [
              {
                id: 'S',
                type: 'subject',
                title: 'Subject S',
                children_ids: []
              }
            ]
          })}
        >
          <Routes>
            <Route path="/author/health" element={<HealthPage />} />
          </Routes>
        </CurriculumProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: '데이터 검증' })).toBeInTheDocument()
    expect(await screen.findByText('모든 검증을 통과했습니다.')).toBeInTheDocument()
  })
})
