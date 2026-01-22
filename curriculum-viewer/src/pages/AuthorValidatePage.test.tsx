import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AuthProvider, AUTH_STORAGE_KEY } from '../lib/auth/AuthProvider'
import { RepositoryProvider } from '../lib/repository/RepositoryProvider'
import { getSkillGraphDraftKey } from '../lib/repository/graphModel'
import { setAuthorActiveGraphId } from '../lib/skillGraph/authorState'
import AuthorValidatePage from './AuthorValidatePage'

let latestReactFlowInstance: { fitView: ReturnType<typeof vi.fn>; getNodes: () => any[] } | null = null

vi.mock('reactflow', () => {
  const ReactFlow = (props: any) => {
    const instance = {
      fitView: vi.fn(),
      getNodes: () => props.nodes ?? []
    }
    latestReactFlowInstance = instance
    props.onInit?.(instance)
    return <div data-testid="reactflow" />
  }

  return {
    __esModule: true,
    default: ReactFlow,
    Background: () => <div data-testid="bg" />,
    Controls: () => <div data-testid="controls" />
  }
})

function renderPage() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <RepositoryProvider>
          <AuthorValidatePage />
        </RepositoryProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('AuthorValidatePage', () => {
  beforeEach(() => {
    latestReactFlowInstance = null
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('jumps focus when clicking a validation issue', async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username: 'demo' }))

    const graphId = 'g-cycle'
    setAuthorActiveGraphId(graphId)

    window.sessionStorage.setItem(
      getSkillGraphDraftKey('demo', graphId),
      JSON.stringify({
        version: 1,
        schemaVersion: 'skill-graph-v1',
        graphId,
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
        draft: {
          schemaVersion: 'skill-graph-v1',
          graphId,
          title: 'Cycle graph',
          nodes: [
            { id: 'A', nodeCategory: 'core', label: 'A' },
            { id: 'B', nodeCategory: 'core', label: 'B' },
            { id: 'C', nodeCategory: 'core', label: 'C' }
          ],
          edges: [
            { edgeType: 'requires', source: 'A', target: 'B' },
            { edgeType: 'requires', source: 'B', target: 'C' },
            { edgeType: 'requires', source: 'C', target: 'A' }
          ]
        }
      })
    )

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Author Validate' })).toBeInTheDocument()
    const issueButton = await screen.findByRole('button', { name: /\[error] requires_cycle/i })

    const user = userEvent.setup()
    await user.click(issueButton)

    await waitFor(() => expect(latestReactFlowInstance?.fitView).toHaveBeenCalled())
  })
})
