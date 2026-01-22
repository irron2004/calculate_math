import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import LearningNodeDetailPanel from './LearningNodeDetailPanel'

function LocationEcho() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

describe('LearningNodeDetailPanel', () => {
  it('shows 도전하기 button when AVAILABLE', () => {
    render(
      <MemoryRouter>
        <LearningNodeDetailPanel
          nodeId="N1"
          meta={{ title: 'Node 1', text: null }}
          progress={{
            nodeId: 'N1',
            status: 'AVAILABLE',
            bestAccuracy: null,
            lastAttemptAt: null,
            clearedAt: null
          }}
          prereqNodeIds={[]}
          prereqLabelByNodeId={{}}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: '도전하기' })).toBeInTheDocument()
  })

  it('shows 계속하기 button when IN_PROGRESS', () => {
    render(
      <MemoryRouter>
        <LearningNodeDetailPanel
          nodeId="N1"
          meta={{ title: 'Node 1', text: null }}
          progress={{
            nodeId: 'N1',
            status: 'IN_PROGRESS',
            bestAccuracy: 0.5,
            lastAttemptAt: '2026-01-01T00:00:00Z',
            clearedAt: null
          }}
          prereqNodeIds={[]}
          prereqLabelByNodeId={{}}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: '계속하기' })).toBeInTheDocument()
  })

  it('shows 다시 풀기 button when CLEARED', () => {
    render(
      <MemoryRouter>
        <LearningNodeDetailPanel
          nodeId="N1"
          meta={{ title: 'Node 1', text: null }}
          progress={{
            nodeId: 'N1',
            status: 'CLEARED',
            bestAccuracy: 1.0,
            lastAttemptAt: '2026-01-01T00:00:00Z',
            clearedAt: '2026-01-01T00:00:00Z'
          }}
          prereqNodeIds={[]}
          prereqLabelByNodeId={{}}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: '다시 풀기' })).toBeInTheDocument()
  })

  it('shows locked reasons and no button when LOCKED', () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <LearningNodeDetailPanel
          nodeId="N2"
          meta={{ title: 'Node 2', text: null }}
          progress={{
            nodeId: 'N2',
            status: 'LOCKED',
            bestAccuracy: null,
            lastAttemptAt: null,
            clearedAt: null,
            lockedReasons: { missingPrereqNodeIds: ['N1'] }
          }}
          prereqNodeIds={['N1']}
          prereqLabelByNodeId={{ N1: 'Node 1' }}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('LOCKED')).toBeInTheDocument()
    expect(screen.getByText(/잠김:/)).toBeInTheDocument()
    expect(screen.getByText('Node 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '도전하기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '계속하기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 풀기' })).not.toBeInTheDocument()
  })

  it('navigates to /learn/:nodeId when clicking 도전하기', async () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <Routes>
          <Route
            path="/map"
            element={
              <LearningNodeDetailPanel
                nodeId="N1"
                meta={{ title: 'Node 1', text: null }}
                progress={{
                  nodeId: 'N1',
                  status: 'AVAILABLE',
                  bestAccuracy: null,
                  lastAttemptAt: null,
                  clearedAt: null
                }}
                prereqNodeIds={[]}
                prereqLabelByNodeId={{}}
              />
            }
          />
          <Route path="/learn/:nodeId" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '도전하기' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/learn/N1')
  })
})
