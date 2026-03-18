import { render, screen, waitFor } from '@testing-library/react'
import { CurriculumProvider, defaultCurriculumLoader, useCurriculum } from './CurriculumProvider'

function Status() {
  const { loading, error, data, issues, schemaIssues } = useCurriculum()
  const issueCodes = issues.map((issue) => issue.code).join(',')

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="error">{error ?? ''}</div>
      <div data-testid="hasData">{data ? 'yes' : 'no'}</div>
      <div data-testid="issues">{issueCodes}</div>
      <div data-testid="schemaIssues">{schemaIssues.length}</div>
    </div>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('CurriculumProvider', () => {
  it('surfaces network errors from the loader', async () => {
    const request = deferred<never>()
    const loader = vi.fn(async () => request.promise)

    render(
      <CurriculumProvider autoLoad loader={loader}>
        <Status />
      </CurriculumProvider>
    )

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('true')
    )

    request.reject(new Error('Network down'))

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('Network down')
    )
    expect(screen.getByTestId('hasData')).toHaveTextContent('no')
  })

  it('reports HTTP status when the default loader receives a 404', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch

    try {
      render(
        <CurriculumProvider autoLoad loader={defaultCurriculumLoader}>
          <Status />
        </CurriculumProvider>
      )

      await waitFor(() =>
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Failed to load curriculum data from fallback JSON (HTTP 404)'
        )
      )
      expect(globalThis.fetch).toHaveBeenNthCalledWith(1, '/api/graph/published', expect.any(Object))
      expect(globalThis.fetch).toHaveBeenNthCalledWith(2, '/data/curriculum_math_v1.json', expect.any(Object))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('maps graph API payload to curriculum tree shape', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        nodes: [
          { id: 'ROOT', nodeType: 'root', label: '수학' },
          { id: 'GB-12', nodeType: 'gradeBand', label: '1-2' },
          {
            id: 'D-NA',
            nodeType: 'domain',
            label: '수와 연산',
            meta: { domainCode: 'NA', gradeBand: '1-2' }
          },
          {
            id: 'TU-1',
            nodeType: 'textbookUnit',
            label: '두 자리 수',
            text: '설명 텍스트',
            meta: { domainCode: 'NA', gradeBand: '1-2' }
          }
        ],
        edges: [
          { edgeType: 'contains', source: 'ROOT', target: 'GB-12' },
          { edgeType: 'contains', source: 'GB-12', target: 'D-NA' },
          { edgeType: 'contains', source: 'D-NA', target: 'TU-1' }
        ]
      })
    })) as unknown as typeof fetch

    try {
      render(
        <CurriculumProvider autoLoad loader={defaultCurriculumLoader}>
          <Status />
        </CurriculumProvider>
      )

      await waitFor(() => expect(screen.getByTestId('hasData')).toHaveTextContent('yes'))
      expect(screen.getByTestId('error')).toHaveTextContent('')
      expect(screen.getByTestId('schemaIssues')).toHaveTextContent('0')
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/graph/published', expect.any(Object))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('exposes structural issues from loaded data', async () => {
    const loader = vi.fn(async () => ({
      meta: { version: 1 },
      nodes: [
        {
          id: 'g1',
          type: 'grade',
          title: 'Grade 1',
          children_ids: []
        }
      ]
    }))

    render(
      <CurriculumProvider autoLoad loader={loader}>
        <Status />
      </CurriculumProvider>
    )

    await waitFor(() =>
      expect(screen.getByTestId('issues')).toHaveTextContent('missing_parent')
    )
    expect(screen.getByTestId('schemaIssues')).toHaveTextContent('0')
    expect(screen.getByTestId('hasData')).toHaveTextContent('yes')
  })

  it('shows a blocking schema error screen when payload is invalid', async () => {
    const loader = vi.fn(async () => ({
      nodes: [
        {
          id: 'bad-node',
          type: 'subject',
          title: 'Missing children_ids'
        }
      ]
    }))

    render(
      <CurriculumProvider autoLoad loader={loader}>
        <Status />
      </CurriculumProvider>
    )

    expect(await screen.findByRole('heading', { name: 'Curriculum data error' })).toBeInTheDocument()
    expect(screen.getByText(/children_ids must be string\[\]/)).toBeInTheDocument()
    expect(screen.queryByTestId('issues')).toBeNull()
  })
})
