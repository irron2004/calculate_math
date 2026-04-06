import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import type { DetailPanelContext } from '../components/AppLayout'
import { CurriculumProvider } from '../lib/curriculum/CurriculumProvider'
import ExplorerPage from './ExplorerPage'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function TestLayout() {
  const outletContext: DetailPanelContext = {
    setDetail: vi.fn()
  }

  return <Outlet context={outletContext} />
}

describe('ExplorerPage data loading states', () => {
  it('shows a user-facing error message when curriculum data load fails', async () => {
    const request = deferred<never>()

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <CurriculumProvider autoLoad loader={async () => request.promise}>
          <Routes>
            <Route element={<TestLayout />}>
              <Route path="/dashboard" element={<ExplorerPage />} />
            </Route>
          </Routes>
        </CurriculumProvider>
      </MemoryRouter>
    )

    expect(await screen.findByText('Loading…')).toBeInTheDocument()

    request.reject(new Error('Network down'))

    const error = await screen.findByText('Network down')
    expect(error).toHaveClass('error')
  })
})
