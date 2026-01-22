import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { AUTH_STORAGE_KEY, AUTH_USER_DB_STORAGE_KEY } from './lib/auth/AuthProvider'

describe('App routing', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  const expectPersistentLayout = () => {
    const nav = screen.getByRole('navigation', { name: /primary/i })
    expect(nav).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: '대시보드' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
    expect(within(nav).getByRole('link', { name: '지도' })).toHaveAttribute(
      'href',
      '/map'
    )
    expect(within(nav).getByRole('link', { name: '리포트' })).toHaveAttribute(
      'href',
      '/report'
    )
    expect(within(nav).getByRole('link', { name: '프리뷰' })).toHaveAttribute(
      'href',
      '/preview'
    )

    expect(
      screen.getByRole('complementary', { name: /detail panel/i })
    ).toBeInTheDocument()
  }

  const setStoredUser = (username = 'demo') => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username }))
  }

  it.each([
    '/dashboard',
    '/graph',
    '/map',
    '/tree',
    '/report',
    '/preview',
    '/health',
    '/learn/demo-node',
    '/eval/s1'
  ])(
    'redirects unauthenticated %s to /login',
    async (pathname) => {
      window.history.pushState({}, '', pathname)
      render(<App />)

      expect(
        await screen.findByRole('heading', { name: '로그인' })
      ).toBeInTheDocument()
      await waitFor(() => expect(window.location.pathname).toBe('/login'))
    }
  )

  it('redirects / to /login when unauthenticated', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '로그인' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it('redirects / to /dashboard when authenticated', async () => {
    setStoredUser('demo')
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '대시보드' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
    expectPersistentLayout()
  })

  it('logs in from /login and navigates to /dashboard', async () => {
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
      await screen.findByRole('heading', { name: '대시보드' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
    expectPersistentLayout()
    expect(screen.getByText(/demo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
  })

  it('restores session from localStorage and allows /dashboard', async () => {
    setStoredUser('persisted')
    window.history.pushState({}, '', '/dashboard')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '대시보드' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
    expectPersistentLayout()
    expect(screen.getByText('persisted')).toBeInTheDocument()
  })

  it('logs out and redirects to /login', async () => {
    setStoredUser('demo')
    window.history.pushState({}, '', '/dashboard')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '대시보드' })
    ).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(
      await screen.findByRole('heading', { name: '로그인' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('highlights current menu tab on /map', () => {
    setStoredUser('demo')
    window.history.pushState({}, '', '/map')
    render(<App />)
    expect(screen.getByRole('heading', { name: '지도' })).toBeInTheDocument()
    expectPersistentLayout()
    expect(screen.getByRole('link', { name: '지도' })).toHaveAttribute('aria-current', 'page')
  })

  it('renders Report page at /report (authenticated)', () => {
    setStoredUser('demo')
    window.history.pushState({}, '', '/report')
    render(<App />)
    expect(
      screen.getByRole('heading', { name: '학습 리포트', level: 1 })
    ).toBeInTheDocument()
    expectPersistentLayout()
  })

  it.each([
    ['/graph', '지도'],
    ['/tree', '트리'],
    ['/health', '데이터 검증']
  ])('renders %s when authenticated', async (pathname, heading) => {
    setStoredUser('demo')
    window.history.pushState({}, '', pathname)
    render(<App />)

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expectPersistentLayout()
  })

  it('renders LearnPage at /learn/:nodeId when authenticated', async () => {
    setStoredUser('demo')
    window.history.pushState({}, '', '/learn/demo-node')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '학습' })).toBeInTheDocument()
    expectPersistentLayout()
  })

  it('renders EvalPage at /eval/:sessionId when authenticated', async () => {
    setStoredUser('demo')
    window.history.pushState({}, '', '/eval/s1')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '평가' })).toBeInTheDocument()
    expectPersistentLayout()
  })

  it('blocks /author/import when not in author mode (authenticated)', async () => {
    setStoredUser('admin')
    window.history.pushState({}, '', '/author/import')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '관리자 전용 기능' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /primary/i })).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '관리자 모드로 전환' }))

    expect(await screen.findByRole('heading', { name: 'Skill-Graph Import' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /author/i })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /primary/i })).not.toBeInTheDocument()
  })

  it('switches from student to author mode in one click', async () => {
    setStoredUser('admin')
    window.history.pushState({}, '', '/dashboard')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '대시보드' })).toBeInTheDocument()
    expectPersistentLayout()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '관리자 모드' }))

    expect(await screen.findByRole('heading', { name: 'Skill-Graph Import' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /author/i })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /primary/i })).not.toBeInTheDocument()
  })

  it('renders /author/editor skeleton without authentication (smoke)', async () => {
    window.history.pushState({}, '', '/author/editor')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '관리자 전용 기능' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인하기' })).toBeInTheDocument()
  })

  it('renders /author/validate stub when switched to author mode', async () => {
    setStoredUser('admin')
    window.history.pushState({}, '', '/author/validate')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '관리자 전용 기능' })).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '관리자 모드로 전환' }))

    expect(await screen.findByRole('heading', { name: 'Author Validate' })).toBeInTheDocument()
  })

  it('renders /author entry page (smoke)', async () => {
    setStoredUser('admin')
    window.history.pushState({}, '', '/author')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '관리자 전용 기능' })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '관리자 모드로 전환' }))

    expect(await screen.findByRole('heading', { name: '관리자 모드' })).toBeInTheDocument()
    const authorNav = screen.getByRole('navigation', { name: /author/i })
    expect(authorNav).toBeInTheDocument()
    expect(within(authorNav).getByRole('link', { name: 'Import' })).toHaveAttribute('href', '/author/import')
  })
})
