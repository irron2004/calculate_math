import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CurriculumProvider } from '../lib/curriculum/CurriculumProvider'
import NodeDetail from './NodeDetail'

function LocationEcho() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

const curriculumLoader = async () => ({
  meta: { version: 1 },
  nodes: [
    { id: 'S', type: 'subject' as const, title: 'Math', children_ids: ['G1'] },
    { id: 'G1', type: 'grade' as const, title: 'Grade 1', parent_id: 'S', children_ids: ['D1'] },
    { id: 'D1', type: 'domain' as const, title: 'Numbers', parent_id: 'G1', children_ids: ['ST1'] },
    { id: 'ST1', type: 'standard' as const, title: 'Add', parent_id: 'D1', children_ids: [] }
  ]
})

describe('NodeDetail', () => {
  it('renders empty state when the node is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <CurriculumProvider autoLoad loader={curriculumLoader}>
          <Routes>
            <Route path="/map" element={<NodeDetail nodeId="missing" />} />
          </Routes>
        </CurriculumProvider>
      </MemoryRouter>
    )

    expect(await screen.findByText('선택된 노드를 찾지 못했습니다.')).toBeInTheDocument()
  })

  it('shows node metadata and updates focus query on relation click', async () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <CurriculumProvider autoLoad loader={curriculumLoader}>
          <Routes>
            <Route
              path="/map"
              element={
                <div>
                  <NodeDetail nodeId="D1" />
                  <LocationEcho />
                </div>
              }
            />
          </Routes>
        </CurriculumProvider>
      </MemoryRouter>
    )

    const detail = await screen.findByRole('heading', { name: '노드 상세' })
    const panel = detail.closest('div') ?? document.body

    expect(within(panel).getByText('Numbers', { selector: 'dd' })).toBeInTheDocument()
    expect(within(panel).getByText('D1', { selector: 'dd' })).toBeInTheDocument()
    expect(within(panel).getByText('domain', { selector: 'dd' })).toBeInTheDocument()

    const user = userEvent.setup()

    const parentButtons = within(panel).getAllByRole('button', { name: /Grade 1/ })
    await user.click(parentButtons[0])

    expect(await screen.findByTestId('location')).toHaveTextContent('/map?focus=G1')

    await user.click(within(panel).getByRole('button', { name: /Add/ }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/map?focus=ST1')
  })
})
