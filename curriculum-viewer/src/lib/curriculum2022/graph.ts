export type Curriculum2022Node = {
  id: string
  nodeType: string
  label: string
  gradeBand?: string
  parentId?: string
  domainCode?: string
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

export const CURRICULUM_2022_PATH = '/data/curriculum_math_2022.json'

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
  const gradeBand = asNonEmptyString(raw.gradeBand) ?? undefined
  const parentId = asNonEmptyString(raw.parentId) ?? undefined
  const domainCode = asNonEmptyString(raw.domainCode) ?? undefined
  const note = asNonEmptyString(raw.note) ?? undefined
  const reason = asNonEmptyString(raw.reason) ?? undefined

  return {
    id,
    nodeType,
    label,
    ...(gradeBand ? { gradeBand } : {}),
    ...(parentId ? { parentId } : {}),
    ...(domainCode ? { domainCode } : {}),
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
  let response: Response
  try {
    response = await fetch(CURRICULUM_2022_PATH, { signal })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to load 2022 curriculum graph (${message})`)
  }

  if (!response.ok) {
    throw new Error(`Failed to load 2022 curriculum graph (HTTP ${response.status})`)
  }

  let json: unknown
  try {
    json = (await response.json()) as unknown
  } catch {
    throw new Error('Failed to parse 2022 curriculum graph JSON')
  }

  const parsed = parseCurriculum2022Graph(json)
  if (!parsed) {
    throw new Error('Invalid curriculum_math_2022.json schema')
  }

  return parsed
}
