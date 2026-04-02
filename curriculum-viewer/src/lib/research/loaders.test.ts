import { loadResearchManifest, RESEARCH_MANIFEST_PATH } from './loaders'

describe('loadResearchManifest', () => {
  it('loads and parses /data/research/manifest.json', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        schemaVersion: 'research-manifest-v1',
        patchByTrack: {
          T1: '/data/research/patch_T1.json',
          T2: '/data/research/patch_T2.json',
          T3: '/data/research/patch_T3.json'
        }
      })
    })) as unknown as typeof fetch

    try {
      const manifest = await loadResearchManifest()
      expect(manifest.patchByTrack.T1).toBe('/data/research/patch_T1.json')
      expect(globalThis.fetch).toHaveBeenCalledWith(RESEARCH_MANIFEST_PATH, { signal: undefined })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('falls back to embedded manifest on HTTP error', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch

    try {
      const manifest = await loadResearchManifest()
      // Falls back to EMBEDDED_RESEARCH_MANIFEST — never rejects
      expect(manifest).toBeDefined()
      expect(manifest.schemaVersion).toBe('research-manifest-v1')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('falls back to embedded manifest on JSON parse error', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON')
      }
    })) as unknown as typeof fetch

    try {
      const manifest = await loadResearchManifest()
      // Falls back to EMBEDDED_RESEARCH_MANIFEST — never rejects
      expect(manifest).toBeDefined()
      expect(manifest.schemaVersion).toBe('research-manifest-v1')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
