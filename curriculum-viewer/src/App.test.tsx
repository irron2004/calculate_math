import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { AUTH_STORAGE_KEY, AUTH_USER_DB_STORAGE_KEY } from './lib/auth/AuthProvider'

describe('App routing', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  const expectPersistentLayout = () => {
    expect(
      screen.getByRole('navigation', { name: /primary/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '트리' })).toHaveAttribute(
      'href',
      '/tree'
    )
    expect(screen.getByRole('link', { name: '그래프' })).toHaveAttribute(
      'href',
      '/graph'
    )
    expect(screen.getByRole('link', { name: '리포트' })).toHaveAttribute(
      'href',
      '/health'
    )

    expect(
      screen.getByRole('complementary', { name: /detail panel/i })
    ).toBeInTheDocument()
  }

  const setStoredUser = (username = 'demo') => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username }))
  }

  it('redirects unauthenticated /tree to /login', async () => {
    window.history.pushState({}, '', '/tree')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '로그인' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it('redirects / to /login when unauthenticated', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '로그인' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it('redirects / to /tree when authenticated', async () => {
    setStoredUser('demo')
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '트리' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/tree'))
    expectPersistentLayout()
  })

  it('logs in from /login and navigates to /tree', async () => {
    window.localStorage.setItem(
      AUTH_USER_DB_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        usersById: {
          demo: {
            id: 'demo',
            password: 'pw',
            name: 'demo',
            grade: '3',
            email: 'demo@example.com',
            createdAt: '2026-01-01T00:00:00.000Z'
          }
        }
      })
    )

    window.history.pushState({}, '', '/login')
    render(<App />)

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('아이디'), 'demo')
    await user.type(screen.getByLabelText('비밀번호'), 'pw')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      await screen.findByRole('heading', { name: '트리' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/tree'))
    expectPersistentLayout()
    expect(screen.getByText(/demo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
  })

  it('restores session from localStorage and allows /tree', async () => {
    setStoredUser('persisted')
    window.history.pushState({}, '', '/tree')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '트리' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/tree'))
    expectPersistentLayout()
    expect(screen.getByText('persisted')).toBeInTheDocument()
  })

  it('logs out and redirects to /login', async () => {
    setStoredUser('demo')
    window.history.pushState({}, '', '/tree')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '트리' })
    ).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(
      await screen.findByRole('heading', { name: '로그인' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('renders Graph page at /graph', () => {
    window.history.pushState({}, '', '/graph')
    render(<App />)
    expect(screen.getByRole('heading', { name: '그래프' })).toBeInTheDocument()
    expectPersistentLayout()
  })

  it('renders Report page at /health', () => {
    window.history.pushState({}, '', '/health')
    render(<App />)
    expect(
      screen.getByRole('heading', { name: '리포트', level: 1 })
    ).toBeInTheDocument()
    expectPersistentLayout()
  })
})
