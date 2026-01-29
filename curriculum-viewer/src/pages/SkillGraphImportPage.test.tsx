import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import validFixture from '../lib/skillGraph/fixtures/skill_graph_valid.v1.json'
import { AuthProvider } from '../lib/auth/AuthProvider'
import { AUTH_STORAGE_KEY } from '../lib/auth/AuthProvider'
import { RepositoryProvider } from '../lib/repository/RepositoryProvider'
import SkillGraphImportPage from './SkillGraphImportPage'

vi.mock('reactflow', () => {
  return {
    __esModule: true,
    default: () => <div data-testid="reactflow" />,
    Background: () => <div data-testid="bg" />,
    Controls: () => <div data-testid="controls" />
  }
})

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

function renderPage() {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
  render(
    <MemoryRouter>
      <AuthProvider>
        <RepositoryProvider>
          <SkillGraphImportPage />
        </RepositoryProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('SkillGraphImportPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('blocks invalid JSON and shows parse error', async () => {
    renderPage()

    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Graph JSON'), { target: { value: '{' } })
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText(/JSON parse error/)).toBeInTheDocument()
    expect(screen.queryByText('Import OK')).not.toBeInTheDocument()
  })

  it('blocks schema violations and shows issue paths', async () => {
    renderPage()

    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Graph JSON'), {
      target: { value: JSON.stringify({ schemaVersion: 'skill-graph-v1' }) }
    })
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText(/schema validation failed/i)).toBeInTheDocument()
    expect(await screen.findByText(/nodes/i)).toBeInTheDocument()
  })

  it('accepts valid fixture and shows summary', async () => {
    renderPage()

    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Graph JSON'), {
      target: { value: JSON.stringify(validFixture) }
    })
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText('Import OK')).toBeInTheDocument()
    expect(screen.getByText(validFixture.graphId)).toBeInTheDocument()
  })
})
