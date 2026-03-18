import {
  CURRICULUM_2022_API_PATH,
  CURRICULUM_2022_PATH,
  loadCurriculum2022Graph
} from './graph'

describe('loadCurriculum2022Graph', () => {
  it('fetches backend API first when available', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        meta: { curriculumId: 'KR-MATH-2022' },
        nodes: [{ id: 'A', nodeType: 'textbookUnit', label: 'Alpha' }],
        edges: []
      })
    })) as unknown as typeof fetch

    try {
      const result = await loadCurriculum2022Graph()
      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toHaveLength(0)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      expect(globalThis.fetch).toHaveBeenCalledWith(CURRICULUM_2022_API_PATH, {
        signal: undefined
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('falls back to static json when API is unavailable', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi
      .fn(async () => ({ ok: false, status: 404 }))
      .mockImplementationOnce(async () => ({ ok: false, status: 404 }))
      .mockImplementationOnce(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          meta: { curriculumId: 'KR-MATH-2022' },
          nodes: [{ id: 'A', nodeType: 'textbookUnit', label: 'Alpha' }],
          edges: []
        })
      })) as unknown as typeof fetch

    try {
      const result = await loadCurriculum2022Graph()
      expect(result.nodes).toHaveLength(1)
      expect(globalThis.fetch).toHaveBeenNthCalledWith(1, CURRICULUM_2022_API_PATH, {
        signal: undefined
      })
      expect(globalThis.fetch).toHaveBeenNthCalledWith(2, CURRICULUM_2022_PATH, {
        signal: undefined
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('reports HTTP status when both API and fallback fail', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch

    try {
      await expect(loadCurriculum2022Graph()).rejects.toThrowError(
        'Failed to load 2022 curriculum graph from fallback JSON (HTTP 404)'
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('reports schema errors when both API and fallback payloads are invalid', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ meta: { curriculumId: 'KR-MATH-2022' } })
    })) as unknown as typeof fetch

    try {
      await expect(loadCurriculum2022Graph()).rejects.toThrowError(
        'Invalid 2022 curriculum graph schema from fallback JSON'
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('reads optional fields from meta when API returns normalized node shape', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        nodes: [
          {
            id: 'TU1',
            nodeType: 'textbookUnit',
            label: 'Unit 1',
            meta: {
              gradeBand: '3-4',
              parentId: 'ROOT',
              domainCode: 'GM',
              note: 'meta note',
              reason: 'meta reason'
            }
          }
        ],
        edges: []
      })
    })) as unknown as typeof fetch

    try {
      const result = await loadCurriculum2022Graph()
      expect(result.nodes[0]).toMatchObject({
        gradeBand: '3-4',
        parentId: 'ROOT',
        domainCode: 'GM',
        note: 'meta note',
        reason: 'meta reason'
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
