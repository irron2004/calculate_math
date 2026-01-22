export type NumericProblem = {
  id: string
  type: 'numeric'
  prompt: string
  answer: string
  explanation?: string
  tags?: string[]
}

export type Problem = NumericProblem

export type ProblemBank = {
  version: number
  problemsByNodeId: Record<string, Problem[]>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const filtered = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return filtered.length > 0 ? filtered.map((s) => s.trim()) : undefined
}

function parseNumericProblem(value: unknown): NumericProblem | null {
  if (!isRecord(value)) return null
  if (value.type !== 'numeric') return null

  const id = asString(value.id)?.trim()
  const prompt = asString(value.prompt)?.trim()
  const answer = asString(value.answer)?.trim()
  const explanation = asString(value.explanation)?.trim() || undefined
  const tags = parseStringArray(value.tags)

  if (!id || !prompt || !answer) return null

  return { id, type: 'numeric', prompt, answer, explanation, tags }
}

function parseProblem(value: unknown): Problem | null {
  return parseNumericProblem(value)
}

export function parseProblemBank(raw: unknown): ProblemBank | null {
  if (!isRecord(raw)) return null

  const version = typeof raw.version === 'number' ? raw.version : null
  const problemsByNodeId = raw.problemsByNodeId
  if (!version || !isRecord(problemsByNodeId)) return null

  const parsed: Record<string, Problem[]> = {}
  for (const [nodeId, list] of Object.entries(problemsByNodeId)) {
    if (!Array.isArray(list)) continue

    const problems = list
      .map((item) => parseProblem(item))
      .filter((problem): problem is Problem => Boolean(problem))

    if (problems.length > 0) {
      parsed[nodeId] = problems
    }
  }

  return { version, problemsByNodeId: parsed }
}

export async function loadProblemBank(
  signal?: AbortSignal
): Promise<ProblemBank> {
  const response = await fetch('/data/problems_v1.json', { signal })
  if (!response.ok) {
    throw new Error(`Failed to load problems data (HTTP ${response.status})`)
  }

  const json = (await response.json()) as unknown
  const parsed = parseProblemBank(json)
  if (!parsed) {
    throw new Error('Invalid problems_v1.json schema')
  }

  return parsed
}

