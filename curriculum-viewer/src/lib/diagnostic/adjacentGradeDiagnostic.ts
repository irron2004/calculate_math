import type { Problem } from '../learn/problems'

export type AdjacentGradeDiagnosticGroup = 'pre' | 'post' | 'fill'

export type AdjacentGradeDiagnosticItem = {
  group: AdjacentGradeDiagnosticGroup
  groupGrade: number
  nodeId: string
  problemId: string
}

export type AdjacentGradeDiagnosticPlan = {
  mode: 'adjacent-grade-na-v1'
  grade: number
  domainCode: string
  desiredCount: number
  preGrade: number | null
  postGrade: number | null
  counts: {
    pre: number
    post: number
    fill: number
  }
  preNodeIds: string[]
  postNodeIds: string[]
  fillNodeIds: string[]
  items: AdjacentGradeDiagnosticItem[]
  pickedProblemIds: string[]
}

export type BuildAdjacentGradeDiagnosticParams = {
  grade: number
  problemsByNodeId: Record<string, readonly Problem[]>
  desiredCount?: number
  domainCode?: string
}

export type BuildAdjacentGradeDiagnosticResult =
  | { ok: true; plan: AdjacentGradeDiagnosticPlan }
  | { ok: false; error: string }

type ParsedCurriculumV1StandardNodeId = {
  grade: number
  domainCode: string
}

const CURRICULUM_V1_STANDARD_NODE_ID_REGEX = /^MATH-2022-G-(\d+)-([A-Z]{2})-(\d+)$/

function compareString(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function isValidGrade(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 6
}

function normalizeDomainCode(value: string | undefined): string {
  const normalized = (value ?? 'NA').trim().toUpperCase()
  return normalized.length > 0 ? normalized : 'NA'
}

export function parseCurriculumV1StandardNodeId(nodeId: string): ParsedCurriculumV1StandardNodeId | null {
  const match = CURRICULUM_V1_STANDARD_NODE_ID_REGEX.exec(nodeId.trim())
  if (!match) return null

  const grade = Number(match[1])
  if (!Number.isFinite(grade) || !Number.isInteger(grade)) return null

  return { grade, domainCode: match[2] }
}

type PickResult = { ok: true; items: AdjacentGradeDiagnosticItem[] } | { ok: false; error: string }

function pickFromNodeIds(params: {
  group: AdjacentGradeDiagnosticGroup
  groupGrade: number
  nodeIds: string[]
  desiredCount: number
  problemsByNodeId: Record<string, readonly Problem[]>
}): PickResult {
  const candidates: AdjacentGradeDiagnosticItem[] = []

  for (const nodeId of params.nodeIds) {
    const problems = params.problemsByNodeId[nodeId] ?? []
    const sortedProblems = problems.slice().sort((a, b) => compareString(a.id, b.id))
    for (const problem of sortedProblems) {
      candidates.push({
        group: params.group,
        groupGrade: params.groupGrade,
        nodeId,
        problemId: problem.id
      })
    }
  }

  candidates.sort((a, b) => compareString(a.nodeId, b.nodeId) || compareString(a.problemId, b.problemId))
  const picked = candidates.slice(0, params.desiredCount)
  if (picked.length < params.desiredCount) {
    return {
      ok: false,
      error: `Not enough problems for grade ${params.groupGrade} (${params.group}). Need ${params.desiredCount}, got ${picked.length}.`
    }
  }

  return { ok: true, items: picked }
}

function collectNodeIdsForGrade(params: {
  problemsByNodeId: Record<string, readonly Problem[]>
  grade: number
  domainCode: string
}): string[] {
  const matched: string[] = []

  for (const nodeId of Object.keys(params.problemsByNodeId)) {
    const parsed = parseCurriculumV1StandardNodeId(nodeId)
    if (!parsed) continue
    if (parsed.grade !== params.grade) continue
    if (parsed.domainCode !== params.domainCode) continue
    matched.push(nodeId)
  }

  matched.sort(compareString)
  return matched
}

export function buildAdjacentGradeDiagnostic(
  params: BuildAdjacentGradeDiagnosticParams
): BuildAdjacentGradeDiagnosticResult {
  if (!isValidGrade(params.grade)) {
    throw new Error(`Invalid grade: ${params.grade} (expected integer 1..6)`) 
  }

  const desiredCount = params.desiredCount ?? 8
  if (!Number.isInteger(desiredCount) || desiredCount <= 0) {
    throw new Error(`Invalid desiredCount: ${desiredCount} (expected positive integer)`) 
  }

  const domainCode = normalizeDomainCode(params.domainCode)

  const preGrade = params.grade > 1 ? params.grade - 1 : null
  const postGrade = params.grade < 6 ? params.grade + 1 : null

  const preTarget = Math.floor(desiredCount / 2)
  const postTarget = desiredCount - preTarget

  let preCount = preTarget
  let postCount = postTarget
  let fillCount = 0
  if (!preGrade) {
    fillCount += preCount
    preCount = 0
  }
  if (!postGrade) {
    fillCount += postCount
    postCount = 0
  }

  const preNodeIds = preGrade
    ? collectNodeIdsForGrade({ problemsByNodeId: params.problemsByNodeId, grade: preGrade, domainCode })
    : []
  const postNodeIds = postGrade
    ? collectNodeIdsForGrade({ problemsByNodeId: params.problemsByNodeId, grade: postGrade, domainCode })
    : []
  const fillNodeIds = fillCount > 0
    ? collectNodeIdsForGrade({ problemsByNodeId: params.problemsByNodeId, grade: params.grade, domainCode })
    : []

  const picked: AdjacentGradeDiagnosticItem[] = []
  const pickErrors: string[] = []

  if (preGrade && preCount > 0) {
    const result = pickFromNodeIds({
      group: 'pre',
      groupGrade: preGrade,
      nodeIds: preNodeIds,
      desiredCount: preCount,
      problemsByNodeId: params.problemsByNodeId
    })
    if (!result.ok) pickErrors.push(result.error)
    else picked.push(...result.items)
  }

  if (fillCount > 0) {
    const result = pickFromNodeIds({
      group: 'fill',
      groupGrade: params.grade,
      nodeIds: fillNodeIds,
      desiredCount: fillCount,
      problemsByNodeId: params.problemsByNodeId
    })
    if (!result.ok) pickErrors.push(result.error)
    else picked.push(...result.items)
  }

  if (postGrade && postCount > 0) {
    const result = pickFromNodeIds({
      group: 'post',
      groupGrade: postGrade,
      nodeIds: postNodeIds,
      desiredCount: postCount,
      problemsByNodeId: params.problemsByNodeId
    })
    if (!result.ok) pickErrors.push(result.error)
    else picked.push(...result.items)
  }

  if (pickErrors.length > 0) {
    return { ok: false, error: pickErrors.join(' ') }
  }

  picked.sort((a, b) => {
    return (
      a.groupGrade - b.groupGrade ||
      compareString(a.nodeId, b.nodeId) ||
      compareString(a.problemId, b.problemId)
    )
  })

  const seen = new Set<string>()
  for (const item of picked) {
    const key = `${item.nodeId}:${item.problemId}`
    if (seen.has(key)) {
      return { ok: false, error: `Duplicate selection detected: ${key}` }
    }
    seen.add(key)
  }

  if (picked.length !== desiredCount) {
    return {
      ok: false,
      error: `Picked ${picked.length} problems but expected ${desiredCount}.`
    }
  }

  const pickedProblemIds = picked.map((item) => item.problemId)
  return {
    ok: true,
    plan: {
      mode: 'adjacent-grade-na-v1',
      grade: params.grade,
      domainCode,
      desiredCount,
      preGrade,
      postGrade,
      counts: { pre: preCount, post: postCount, fill: fillCount },
      preNodeIds,
      postNodeIds,
      fillNodeIds,
      items: picked,
      pickedProblemIds
    }
  }
}
