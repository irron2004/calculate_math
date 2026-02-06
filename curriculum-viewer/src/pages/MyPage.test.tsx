import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthProvider, AUTH_STORAGE_KEY } from '../lib/auth/AuthProvider'
import MyPage from './MyPage'

const buildStoredUser = (username = 'demo') => ({
  id: username,
  username,
  name: 'Demo User',
  grade: '1',
  email: `${username}@example.com`,
  role: 'student' as const,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null
})

const sampleStickers = [
  {
    id: 'sticker-1',
    studentId: 'demo',
    count: 2,
    reason: '숙제를 성실히 제출했어요.',
    reasonType: 'homework_excellent' as const,
    homeworkId: 'hw-1',
    grantedBy: null,
    grantedAt: '2026-01-20T10:00:00.000Z'
  },
  {
    id: 'sticker-2',
    studentId: 'demo',
    count: 1,
    reason: '보너스 스티커를 받았어요!',
    reasonType: 'bonus' as const,
    homeworkId: null,
    grantedBy: 'admin-1',
    grantedAt: '2026-02-01T09:00:00.000Z'
  }
]

function mockFetch({
  summary = { totalCount: 5 },
  stickers = sampleStickers,
  assignments = []
}: {
  summary?: { totalCount: number }
  stickers?: typeof sampleStickers
  assignments?: unknown[]
} = {}) {
  const originalFetch = globalThis.fetch
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.startsWith('/api/homework/assignments')) {
      return {
        ok: true,
        json: async () => ({ assignments })
      }
    }

    if (url === '/api/students/demo/sticker-summary') {
      return {
        ok: true,
        json: async () => summary
      }
    }

    if (url === '/api/students/demo/stickers') {
      return {
        ok: true,
        json: async () => ({ stickers })
      }
    }

    return { ok: false, status: 404, json: async () => ({}) }
  })

  globalThis.fetch = fetchMock as unknown as typeof fetch

  return {
    fetchMock,
    restore: () => {
      globalThis.fetch = originalFetch
    }
  }
}

describe('MyPage stickers', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('renders sticker summary and history in demo mode', async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    const { restore } = mockFetch()

    try {
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <AuthProvider>
            <Routes>
              <Route path="/mypage" element={<MyPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(await screen.findByRole('heading', { name: '숙제' })).toBeInTheDocument()
      expect(await screen.findByText('칭찬 스티커')).toBeInTheDocument()
      expect(await screen.findByText('5개')).toBeInTheDocument()
      expect(await screen.findByText('숙제를 성실히 제출했어요.')).toBeInTheDocument()
      expect(screen.getByText('+2개')).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('shows reason tooltip when hovering the sticker icon', async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('demo')))
    const { restore } = mockFetch()

    try {
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <AuthProvider>
            <Routes>
              <Route path="/mypage" element={<MyPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      )

      await screen.findByText('칭찬 스티커')
      expect(screen.queryByRole('tooltip')).toBeNull()

      const user = userEvent.setup()
      const icons = await screen.findAllByRole('img', { name: '칭찬 스티커' })
      await user.hover(icons[0])

      expect(await screen.findByRole('tooltip')).toHaveTextContent('보너스 스티커를 받았어요!')
    } finally {
      restore()
    }
  })

  it('does not show sticker UI when not in demo mode', async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(buildStoredUser('student-1')))
    const { fetchMock, restore } = mockFetch()

    try {
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <AuthProvider>
            <Routes>
              <Route path="/mypage" element={<MyPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(await screen.findByRole('heading', { name: '숙제' })).toBeInTheDocument()
      expect(screen.queryByText('칭찬 스티커')).toBeNull()

      await waitFor(() => {
        const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]))
        expect(calledUrls.some((url) => url.includes('/sticker'))).toBe(false)
      })
    } finally {
      restore()
    }
  })
})
