import type { ResearchManifestV1, ResearchPatchV1, ResearchTrack } from './schema'
import { parseResearchManifestV1Safe, parseResearchPatchV1Safe } from './schema'

export const RESEARCH_MANIFEST_PATH = '/data/research/manifest.json'

type LoadOptions = {
  signal?: AbortSignal
}

async function fetchJson(path: string, label: string, options?: LoadOptions): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, { signal: options?.signal })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to load ${label} (${message})`)
  }

  if (!response.ok) {
    throw new Error(`Failed to load ${label} (HTTP ${response.status})`)
  }

  try {
    return (await response.json()) as unknown
  } catch {
    throw new Error(`Failed to parse ${label} JSON`)
  }
}

export async function loadResearchManifest(options?: LoadOptions): Promise<ResearchManifestV1> {
  const json = await fetchJson(RESEARCH_MANIFEST_PATH, 'research manifest', options)
  const parsed = parseResearchManifestV1Safe(json)
  if (!parsed.ok) {
    throw new Error('Invalid research manifest schema')
  }
  return parsed.value
}

export async function loadResearchPatch(path: string, options?: LoadOptions): Promise<ResearchPatchV1> {
  const json = await fetchJson(path, 'research patch', options)
  const parsed = parseResearchPatchV1Safe(json)
  if (!parsed.ok) {
    throw new Error('Invalid research patch schema')
  }
  return parsed.value
}

export async function loadResearchPatchForTrack(track: ResearchTrack, options?: LoadOptions): Promise<ResearchPatchV1> {
  const manifest = await loadResearchManifest(options)
  const path = manifest.patchByTrack[track]
  if (!path) {
    throw new Error(`Research patch not found for track: ${track}`)
  }
  return await loadResearchPatch(path, options)
}
