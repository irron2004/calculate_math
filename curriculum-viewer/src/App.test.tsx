import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

describe('App routing', () => {
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

  it('redirects / to /tree', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '트리' })
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/tree'))
    expectPersistentLayout()
  })

  it('renders Tree page at /tree', () => {
    window.history.pushState({}, '', '/tree')
    render(<App />)
    expect(screen.getByRole('heading', { name: '트리' })).toBeInTheDocument()
    expectPersistentLayout()
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
    expect(screen.getByRole('heading', { name: '리포트' })).toBeInTheDocument()
    expectPersistentLayout()
  })
})
