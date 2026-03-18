export type Curriculum2022Node = {
  id: string
  nodeType: string
  label: string
  gradeBand?: string
  parentId?: string
  domainCode?: string
  text?: string
  note?: string
  reason?: string
}

export type Curriculum2022Edge = {
  id?: string
  edgeType: string
  source: string
  target: string
}

export type Curriculum2022Graph = {
  meta?: Record<string, unknown>
  nodes: Curriculum2022Node[]
  edges: Curriculum2022Edge[]
}

const apiBaseFromEnv = import.meta.env.VITE_API_URL
const API_BASE = import.meta.env.DEV ? '/api' : (apiBaseFromEnv || '/api')
const PRODUCTION_BACKEND_API_BASE = 'https://calculatemath-production.up.railway.app/api'

export const CURRICULUM_2022_API_PATH = `${API_BASE}/graph/published`
export const CURRICULUM_2022_PATH = '/data/curriculum_math_2022.json'

const CURRICULUM_NODE_TYPES = new Set([
  'schoolLevel',
  'gradeBand',
  'domain',
  'textbookUnit',
  'achievement'
])

function normalizeApiBase(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function buildApiSources(): Array<{ label: string; path: string }> {
  const dedup = new Set<string>()
  const sources: Array<{ label: string; path: string }> = []

  const append = (label: string, path: string) => {
    if (dedup.has(path)) return
    dedup.add(path)
    sources.push({ label, path })
  }

  if (apiBaseFromEnv) {
    append('API(env)', `${normalizeApiBase(apiBaseFromEnv)}/graph/published`)
  }

  append('API(same-origin)', '/api/graph/published')

  if (!import.meta.env.DEV) {
    append('API(default-production)', `${PRODUCTION_BACKEND_API_BASE}/graph/published`)
  }

  return sources
}

function looksLikeCurriculumGraph(graph: Curriculum2022Graph): boolean {
  return graph.nodes.some((node) => CURRICULUM_NODE_TYPES.has(node.nodeType))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseNode(raw: unknown): Curriculum2022Node | null {
  if (!isRecord(raw)) return null

  const id = asNonEmptyString(raw.id)
  const nodeType = asNonEmptyString(raw.nodeType)
  const label = asNonEmptyString(raw.label)
  if (!id || !nodeType || !label) return null
  const meta = isRecord(raw.meta) ? raw.meta : null
  const gradeBand = asNonEmptyString(raw.gradeBand) ?? asNonEmptyString(meta?.gradeBand) ?? undefined
  const parentId = asNonEmptyString(raw.parentId) ?? asNonEmptyString(meta?.parentId) ?? undefined
  const domainCode = asNonEmptyString(raw.domainCode) ?? asNonEmptyString(meta?.domainCode) ?? undefined
  const text = asNonEmptyString(raw.text) ?? undefined
  const note = asNonEmptyString(raw.note) ?? asNonEmptyString(meta?.note) ?? undefined
  const reason = asNonEmptyString(raw.reason) ?? asNonEmptyString(meta?.reason) ?? undefined

  return {
    id,
    nodeType,
    label,
    ...(gradeBand ? { gradeBand } : {}),
    ...(parentId ? { parentId } : {}),
    ...(domainCode ? { domainCode } : {}),
    ...(text ? { text } : {}),
    ...(note ? { note } : {}),
    ...(reason ? { reason } : {})
  }
}

function parseEdge(raw: unknown): Curriculum2022Edge | null {
  if (!isRecord(raw)) return null

  const edgeType = asNonEmptyString(raw.edgeType)
  const source = asNonEmptyString(raw.source)
  const target = asNonEmptyString(raw.target)
  if (!edgeType || !source || !target) return null

  const id = raw.id === undefined ? undefined : asNonEmptyString(raw.id) ?? undefined

  return { id, edgeType, source, target }
}

export function parseCurriculum2022Graph(raw: unknown): Curriculum2022Graph | null {
  if (!isRecord(raw)) return null
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null

  const nodes = raw.nodes.map(parseNode).filter((node): node is Curriculum2022Node => Boolean(node))
  if (nodes.length === 0) return null

  const nodeIdSet = new Set(nodes.map((node) => node.id))
  const edges = raw.edges
    .map(parseEdge)
    .filter((edge): edge is Curriculum2022Edge => Boolean(edge))
    .filter((edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target))

  const meta = isRecord(raw.meta) ? raw.meta : undefined

  return { meta, nodes, edges }
}

export async function loadCurriculum2022Graph(signal?: AbortSignal): Promise<Curriculum2022Graph> {
  const sources: Array<{ label: string; path: string }> = [
    ...buildApiSources(),
    { label: 'fallback JSON', path: CURRICULUM_2022_PATH }
  ]

  let lastError: Error | null = null

  for (const source of sources) {
    let response: Response
    try {
      response = await fetch(source.path, { signal })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      lastError = new Error(`Failed to load 2022 curriculum graph from ${source.label} (${message})`)
      continue
    }

    if (!response.ok) {
      lastError = new Error(`Failed to load 2022 curriculum graph from ${source.label} (HTTP ${response.status})`)
      continue
    }

    let json: unknown
    try {
      json = (await response.json()) as unknown
    } catch {
      lastError = new Error(`Failed to parse 2022 curriculum graph JSON from ${source.label}`)
      continue
    }

    const parsed = parseCurriculum2022Graph(json)
    if (!parsed) {
      lastError = new Error(`Invalid 2022 curriculum graph schema from ${source.label}`)
      continue
    }

    if (source.label !== 'fallback JSON' && !looksLikeCurriculumGraph(parsed)) {
      lastError = new Error(`API graph from ${source.label} is not curriculum-shaped; trying fallback data`)
      continue
    }

    const meta = {
      ...(parsed.meta ?? {}),
      source: source.label,
      sourcePath: source.path
    }

    return {
      ...parsed,
      meta
    }
  }

  throw lastError ?? new Error('Failed to load 2022 curriculum graph')
}
