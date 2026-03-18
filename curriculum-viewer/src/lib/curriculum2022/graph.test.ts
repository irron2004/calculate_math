import {
  CURRICULUM_2022_API_PATH,
  CURRICULUM_2022_PATH,
  loadCurriculum2022Graph,
  loadPublishedApiGraph
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

  it('falls back to static json when API payload is not curriculum-shaped', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi
      .fn(async () => ({ ok: false, status: 404 }))
      .mockImplementationOnce(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          nodes: [
            { id: 'ROOT-MATH', nodeType: 'root', label: 'Math' },
            { id: 'S-1', nodeType: 'skill', label: 'skill 1' },
            { id: 'S-2', nodeType: 'skill', label: 'skill 2' }
          ],
          edges: [{ edgeType: 'prereq', source: 'S-1', target: 'S-2' }]
        })
      }))
      .mockImplementationOnce(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          meta: { curriculumId: 'KR-MATH-2022' },
          nodes: [{ id: 'TU-1', nodeType: 'textbookUnit', label: 'Unit 1' }],
          edges: []
        })
      })) as unknown as typeof fetch

    try {
      const result = await loadCurriculum2022Graph()
      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].nodeType).toBe('textbookUnit')
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

describe('loadPublishedApiGraph', () => {
  it('accepts Neo4j-style skill graph payloads without forcing curriculum fallback', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        nodes: [
          { id: 'ROOT-MATH', nodeType: 'root', label: 'Math' },
          { id: 'S-1', nodeType: 'skill', label: 'addition' },
          { id: 'S-2', nodeType: 'skill', label: 'carry addition' }
        ],
        edges: [{ edgeType: 'prereq', source: 'S-1', target: 'S-2' }]
      })
    })) as unknown as typeof fetch

    try {
      const result = await loadPublishedApiGraph()
      expect(result.nodes.map((node) => node.nodeType)).toEqual(['root', 'skill', 'skill'])
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      expect(globalThis.fetch).toHaveBeenCalledWith(CURRICULUM_2022_API_PATH, { signal: undefined })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
