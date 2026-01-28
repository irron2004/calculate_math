import { CURRICULUM_2022_PATH, loadCurriculum2022Graph } from './graph'

describe('loadCurriculum2022Graph', () => {
  it('fetches /data/curriculum_math_2022.json', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
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
      expect(globalThis.fetch).toHaveBeenCalledWith(CURRICULUM_2022_PATH, { signal: undefined })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('reports HTTP status for missing data', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch

    try {
      await expect(loadCurriculum2022Graph()).rejects.toThrowError('Failed to load 2022 curriculum graph (HTTP 404)')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('reports schema errors when nodes/edges are missing', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ meta: { curriculumId: 'KR-MATH-2022' } })
    })) as unknown as typeof fetch

    try {
      await expect(loadCurriculum2022Graph()).rejects.toThrowError('Invalid curriculum_math_2022.json schema')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
