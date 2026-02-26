export const NODE_GUIDES_2022_PATH = '/data/research/node_guides_2022_v1.json'

type LoadOptions = {
  signal?: AbortSignal
}

export type NodeGuideEntryV1 = {
  summaryGoal: string
  learningObjectives?: string[]
  problemGenerationGuideText: string
  updatedAt?: string
  tags?: string[]
}

export type NodeGuidesFileV1 = {
  meta: {
    schemaVersion: number
    curriculumVersion: string
    fallbacks: {
      summaryGoal: string
      problemGenerationGuideText: string
    }
  }
  nodes: Record<string, NodeGuideEntryV1>
}

export type NodeGuideLookup = {
  guideByNodeId: Map<string, NodeGuideEntryV1>
  fallbackSummaryGoal: string
  fallbackGuideText: string
}

export type NodeGuideResolved = {
  summaryGoalText: string
  guideText: string
  hasGuide: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const next: string[] = []
  for (const item of value) {
    const parsed = readString(item)
    if (!parsed) continue
    next.push(parsed)
  }
  return next
}

function parseNodeGuideEntry(input: unknown): NodeGuideEntryV1 | null {
  if (!isRecord(input)) return null
  const summaryGoal = readString(input.summaryGoal)
  const problemGenerationGuideText = readString(input.problemGenerationGuideText)
  if (!summaryGoal || !problemGenerationGuideText) return null

  const learningObjectives = readStringArray(input.learningObjectives)
  const updatedAt = readString(input.updatedAt) ?? undefined
  const tags = readStringArray(input.tags) ?? undefined

  return {
    summaryGoal,
    problemGenerationGuideText,
    ...(learningObjectives && learningObjectives.length > 0 ? { learningObjectives } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(tags && tags.length > 0 ? { tags } : {})
  }
}

export function parseNodeGuidesFileV1(input: unknown): NodeGuidesFileV1 | null {
  if (!isRecord(input)) return null
  if (!isRecord(input.meta) || !isRecord(input.nodes)) return null

  const schemaVersion = input.meta.schemaVersion
  const curriculumVersion = readString(input.meta.curriculumVersion)
  const fallbackSummaryGoal = isRecord(input.meta.fallbacks)
    ? readString(input.meta.fallbacks.summaryGoal)
    : null
  const fallbackGuideText = isRecord(input.meta.fallbacks)
    ? readString(input.meta.fallbacks.problemGenerationGuideText)
    : null

  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion)) return null
  if (!curriculumVersion || !fallbackSummaryGoal || !fallbackGuideText) return null

  const nodes: Record<string, NodeGuideEntryV1> = {}
  for (const [nodeId, rawEntry] of Object.entries(input.nodes)) {
    if (!readString(nodeId)) continue
    const parsed = parseNodeGuideEntry(rawEntry)
    if (!parsed) continue
    nodes[nodeId] = parsed
  }

  return {
    meta: {
      schemaVersion,
      curriculumVersion,
      fallbacks: {
        summaryGoal: fallbackSummaryGoal,
        problemGenerationGuideText: fallbackGuideText
      }
    },
    nodes
  }
}

export function buildNodeGuideLookup(file: NodeGuidesFileV1): NodeGuideLookup {
  return {
    guideByNodeId: new Map(Object.entries(file.nodes)),
    fallbackSummaryGoal: file.meta.fallbacks.summaryGoal,
    fallbackGuideText: file.meta.fallbacks.problemGenerationGuideText
  }
}

let cachedGuidesPromise: Promise<NodeGuidesFileV1> | null = null

export async function loadNodeGuidesFileV1(options?: LoadOptions): Promise<NodeGuidesFileV1> {
  const response = await fetch(NODE_GUIDES_2022_PATH, { signal: options?.signal })
  if (!response.ok) {
    throw new Error(`Failed to load node guides (HTTP ${response.status})`)
  }
  const json = (await response.json()) as unknown
  const parsed = parseNodeGuidesFileV1(json)
  if (!parsed) {
    throw new Error('Invalid node guides schema')
  }
  return parsed
}

export async function loadNodeGuideLookup(options?: LoadOptions): Promise<NodeGuideLookup> {
  if (!options?.signal && cachedGuidesPromise) {
    return buildNodeGuideLookup(await cachedGuidesPromise)
  }

  const load = async () => buildNodeGuideLookup(await loadNodeGuidesFileV1(options))

  if (options?.signal) {
    return await load()
  }

  cachedGuidesPromise = loadNodeGuidesFileV1()
  try {
    return buildNodeGuideLookup(await cachedGuidesPromise)
  } catch (error) {
    cachedGuidesPromise = null
    throw error
  }
}

export function getNodeGuideOrFallback(nodeId: string, lookup: NodeGuideLookup): NodeGuideResolved {
  const guide = lookup.guideByNodeId.get(nodeId)
  if (!guide) {
    return {
      summaryGoalText: lookup.fallbackSummaryGoal,
      guideText: lookup.fallbackGuideText,
      hasGuide: false
    }
  }
  return {
    summaryGoalText: guide.summaryGoal,
    guideText: guide.problemGenerationGuideText,
    hasGuide: true
  }
}
