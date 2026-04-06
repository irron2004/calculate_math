import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import validFixture from '../lib/skillGraph/fixtures/skill_graph_valid.v1.json'
import AuthorMiniFlowPage from './AuthorMiniFlowPage'

function renderPage() {
  render(
    <MemoryRouter>
      <AuthorMiniFlowPage />
    </MemoryRouter>
  )
}

describe('AuthorMiniFlowPage', () => {
  it('blocks invalid JSON and shows parse error', async () => {
    renderPage()

    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Graph JSON (text)'), { target: { value: '{' } })
    await user.click(screen.getByRole('button', { name: 'Import + Validate' }))

    expect(await screen.findByText(/JSON parse error/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Published Preview' })).toBeInTheDocument()
  })

  it('publishes validated graph and shows JSON preview', async () => {
    renderPage()

    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Graph JSON (text)'), {
      target: { value: JSON.stringify(validFixture) }
    })
    await user.click(screen.getByRole('button', { name: 'Import + Validate' }))
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    const preview = await screen.findByTestId('published-preview')
    expect(preview).toHaveTextContent(validFixture.graphId)
  })

  it('renders file input for import', () => {
    renderPage()
    expect(screen.getByLabelText('Graph JSON (file)')).toBeInTheDocument()
  })
})
