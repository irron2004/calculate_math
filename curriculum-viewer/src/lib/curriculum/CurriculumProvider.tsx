import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { buildCurriculumIndex, type CurriculumIndex } from './indexing'
import { formatSchemaIssue, validateCurriculumData } from './dataValidation.js'
import type { CurriculumSchemaIssue } from './dataValidation.js'
import type { CurriculumIssue } from './validateTypes'
import type { CurriculumData, CurriculumNode } from './types'

type CurriculumContextValue = {
  data: CurriculumData | null
  index: CurriculumIndex | null
  loading: boolean
  error: string | null
  issues: CurriculumIssue[]
  schemaIssues: CurriculumSchemaIssue[]
}

const CurriculumContext = createContext<CurriculumContextValue | null>(null)

export type CurriculumLoader = (options: { signal: AbortSignal }) => Promise<unknown>

const apiBaseFromEnv = import.meta.env.VITE_API_URL
const API_BASE = import.meta.env.DEV ? '/api' : (apiBaseFromEnv || '/api')
const CURRICULUM_API_PATH = `${API_BASE}/graph/published`
const CURRICULUM_JSON_PATH = '/data/curriculum_math_v1.json'
const SUBJECT_ID = 'MATH-2022'

type GraphApiNode = {
  id: string
  nodeType: string
  label: string
  text?: string
  meta: Record<string, unknown>
}

type GraphApiEdge = {
  edgeType: string
  source: string
  target: string
}

type GraphApiPayload = {
  meta?: Record<string, unknown>
  nodes: GraphApiNode[]
  edges: GraphApiEdge[]
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseGradeFromText(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const match = value.match(/\d+/)
  if (!match) return undefined
  const parsed = Number(match[0])
  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

function parseGradeBand(node: GraphApiNode): string | undefined {
  const explicit = asNonEmptyString(node.meta.gradeBand)
  if (explicit) return explicit
  const fromLabel = node.label.match(/\d+\s*-\s*\d+/)
  return fromLabel ? fromLabel[0].replace(/\s+/g, '') : undefined
}

function parseGraphApiPayload(raw: unknown): GraphApiPayload | null {
  if (!isRecord(raw)) return null
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null

  const nodes: GraphApiNode[] = []
  for (const item of raw.nodes) {
    if (!isRecord(item)) continue
    const id = asNonEmptyString(item.id)
    const nodeType = asNonEmptyString(item.nodeType)
    const label = asNonEmptyString(item.label)
    if (!id || !nodeType || !label) continue
    nodes.push({
      id,
      nodeType,
      label,
      text: asNonEmptyString(item.text) ?? undefined,
      meta: isRecord(item.meta) ? item.meta : {}
    })
  }

  if (nodes.length === 0) return null

  const nodeIdSet = new Set(nodes.map((node) => node.id))
  const edges: GraphApiEdge[] = []
  for (const item of raw.edges) {
    if (!isRecord(item)) continue
    const edgeType = asNonEmptyString(item.edgeType)
    const source = asNonEmptyString(item.source)
    const target = asNonEmptyString(item.target)
    if (!edgeType || !source || !target) continue
    if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) continue
    edges.push({ edgeType, source, target })
  }

  return {
    meta: isRecord(raw.meta) ? raw.meta : undefined,
    nodes,
    edges
  }
}

function transformGraphApiPayload(payload: GraphApiPayload): CurriculumData {
  const byId = new Map(payload.nodes.map((node) => [node.id, node] as const))
  const containsParents = new Map<string, string[]>()

  for (const edge of payload.edges) {
    if (edge.edgeType !== 'contains') continue
    const list = containsParents.get(edge.target)
    if (list) {
      list.push(edge.source)
    } else {
      containsParents.set(edge.target, [edge.source])
    }
  }

  const findAncestor = (
    startId: string,
    predicate: (node: GraphApiNode) => boolean
  ): GraphApiNode | null => {
    const queue = [...(containsParents.get(startId) ?? [])]
    const seen = new Set(queue)
    while (queue.length > 0) {
      const currentId = queue.shift()
      if (!currentId) continue
      const current = byId.get(currentId)
      if (!current) continue
      if (predicate(current)) return current
      const parents = containsParents.get(currentId) ?? []
      for (const parentId of parents) {
        if (seen.has(parentId)) continue
        seen.add(parentId)
        queue.push(parentId)
      }
    }
    return null
  }

  const nodeMap = new Map<string, CurriculumNode>()
  const ensureNode = (node: CurriculumNode) => {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node)
    }
  }

  const root = payload.nodes.find((node) => node.nodeType === 'root') ?? null
  const subjectNode: CurriculumNode = {
    id: root?.id ?? SUBJECT_ID,
    type: 'subject',
    title: root?.label ?? '교과 수학',
    subject: 'math',
    children_ids: []
  }
  ensureNode(subjectNode)

  const gradeByBandNodeId = new Map<string, string>()
  const gradeByBandValue = new Map<string, string>()

  const ensureDefaultGrade = (): CurriculumNode => {
    const existing = nodeMap.get('__GRADE__ALL')
    if (existing) return existing
    const grade: CurriculumNode = {
      id: '__GRADE__ALL',
      type: 'grade',
      title: '전체 학년군',
      subject: 'math',
      grade_band: 'ALL',
      grade: 1,
      parent_id: subjectNode.id,
      children_ids: []
    }
    ensureNode(grade)
    return grade
  }

  for (const node of payload.nodes.filter((item) => item.nodeType === 'gradeBand')) {
    const gradeBand = parseGradeBand(node) ?? node.label
    const gradeFromMeta = asFiniteNumber(node.meta.grade)
    const grade = gradeFromMeta ?? parseGradeFromText(gradeBand) ?? parseGradeFromText(node.label)
    const gradeNode: CurriculumNode = {
      id: node.id,
      type: 'grade',
      title: node.label,
      subject: 'math',
      grade_band: gradeBand,
      ...(typeof grade === 'number' ? { grade } : {}),
      parent_id: subjectNode.id,
      children_ids: []
    }
    ensureNode(gradeNode)
    gradeByBandNodeId.set(node.id, gradeNode.id)
    gradeByBandValue.set(gradeBand, gradeNode.id)
  }

  if (gradeByBandNodeId.size === 0) {
    ensureDefaultGrade()
  }

  const domainById = new Map<string, CurriculumNode>()
  const domainsByCode = new Map<string, CurriculumNode[]>()

  const resolveGradeParent = (nodeId: string, meta: Record<string, unknown>): CurriculumNode => {
    const gradeBandAncestor = findAncestor(nodeId, (candidate) => candidate.nodeType === 'gradeBand')
    if (gradeBandAncestor) {
      const gradeId = gradeByBandNodeId.get(gradeBandAncestor.id)
      if (gradeId) {
        const grade = nodeMap.get(gradeId)
        if (grade) return grade
      }
    }

    const metaBand = asNonEmptyString(meta.gradeBand)
    if (metaBand) {
      const gradeId = gradeByBandValue.get(metaBand)
      if (gradeId) {
        const grade = nodeMap.get(gradeId)
        if (grade) return grade
      }
    }

    return ensureDefaultGrade()
  }

  for (const node of payload.nodes.filter((item) => item.nodeType === 'domain')) {
    const parentGrade = resolveGradeParent(node.id, node.meta)
    const domainCode = asNonEmptyString(node.meta.domainCode) ?? undefined
    const domainNode: CurriculumNode = {
      id: node.id,
      type: 'domain',
      title: node.label,
      subject: 'math',
      ...(typeof parentGrade.grade === 'number' ? { grade: parentGrade.grade } : {}),
      ...(parentGrade.grade_band ? { grade_band: parentGrade.grade_band } : {}),
      domain: node.label,
      ...(domainCode ? { domain_code: domainCode } : {}),
      parent_id: parentGrade.id,
      children_ids: []
    }
    ensureNode(domainNode)
    domainById.set(domainNode.id, domainNode)
    if (domainCode) {
      const list = domainsByCode.get(domainCode)
      if (list) list.push(domainNode)
      else domainsByCode.set(domainCode, [domainNode])
    }
  }

  const fallbackDomainByGradeId = new Map<string, CurriculumNode>()

  const ensureFallbackDomain = (grade: CurriculumNode): CurriculumNode => {
    const existing = fallbackDomainByGradeId.get(grade.id)
    if (existing) return existing
    const id = `__DOMAIN__${grade.id}__MISC`
    const fallback: CurriculumNode = {
      id,
      type: 'domain',
      title: '기타',
      subject: 'math',
      ...(typeof grade.grade === 'number' ? { grade: grade.grade } : {}),
      ...(grade.grade_band ? { grade_band: grade.grade_band } : {}),
      domain: '기타',
      domain_code: 'MISC',
      parent_id: grade.id,
      children_ids: []
    }
    ensureNode(fallback)
    fallbackDomainByGradeId.set(grade.id, fallback)
    return fallback
  }

  const standardCandidates = payload.nodes.filter(
    (node) =>
      node.nodeType !== 'root' &&
      node.nodeType !== 'schoolLevel' &&
      node.nodeType !== 'gradeBand' &&
      node.nodeType !== 'domain'
  )

  for (const node of standardCandidates) {
    if (nodeMap.has(node.id)) continue

    const explicitDomain = findAncestor(node.id, (candidate) => candidate.nodeType === 'domain')
    let parentDomain = explicitDomain ? domainById.get(explicitDomain.id) ?? null : null

    const gradeParent = resolveGradeParent(node.id, node.meta)
    if (!parentDomain) {
      const domainCode = asNonEmptyString(node.meta.domainCode)
      if (domainCode) {
        const sameCodeDomains = domainsByCode.get(domainCode) ?? []
        parentDomain =
          sameCodeDomains.find((candidate) => candidate.parent_id === gradeParent.id) ??
          sameCodeDomains[0] ??
          null
      }
    }
    if (!parentDomain) {
      parentDomain = ensureFallbackDomain(gradeParent)
    }

    const standardNode: CurriculumNode = {
      id: node.id,
      type: 'standard',
      title: node.label,
      ...(node.text ? { text: node.text } : {}),
      subject: 'math',
      ...(typeof parentDomain.grade === 'number' ? { grade: parentDomain.grade } : {}),
      ...(parentDomain.grade_band ? { grade_band: parentDomain.grade_band } : {}),
      ...(parentDomain.domain ? { domain: parentDomain.domain } : {}),
      ...(parentDomain.domain_code ? { domain_code: parentDomain.domain_code } : {}),
      parent_id: parentDomain.id,
      children_ids: []
    }
    ensureNode(standardNode)
  }

  const withChildren = new Map<string, CurriculumNode>()
  for (const node of nodeMap.values()) {
    withChildren.set(node.id, { ...node, children_ids: [] })
  }

  for (const node of withChildren.values()) {
    if (node.type === 'subject') {
      node.parent_id = undefined
      continue
    }
    if (!node.parent_id) continue
    const parent = withChildren.get(node.parent_id)
    if (!parent) continue
    parent.children_ids.push(node.id)
  }

  const sortedNodes = Array.from(withChildren.values()).map((node) => ({
    ...node,
    children_ids: [...node.children_ids].sort((a, b) => a.localeCompare(b))
  }))

  return {
    meta: {
      ...(payload.meta ?? {}),
      source: 'api-graph-published',
      transformedAt: new Date().toISOString()
    },
    nodes: sortedNodes
  }
}

export const defaultCurriculumLoader: CurriculumLoader = async ({ signal }) => {
  const sources: Array<{ label: string; path: string; transformGraph: boolean }> = [
    { label: 'API', path: CURRICULUM_API_PATH, transformGraph: true },
    { label: 'fallback JSON', path: CURRICULUM_JSON_PATH, transformGraph: false }
  ]

  let lastError: Error | null = null

  for (const source of sources) {
    let response: Response
    try {
      response = await fetch(source.path, { signal })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      lastError = new Error(`Failed to load curriculum data from ${source.label} (${message})`)
      continue
    }

    if (!response.ok) {
      lastError = new Error(`Failed to load curriculum data from ${source.label} (HTTP ${response.status})`)
      continue
    }

    let payload: unknown
    try {
      payload = (await response.json()) as unknown
    } catch {
      lastError = new Error(`Failed to parse curriculum data JSON from ${source.label}`)
      continue
    }

    if (!source.transformGraph) {
      return payload
    }

    const parsedGraph = parseGraphApiPayload(payload)
    if (!parsedGraph) {
      lastError = new Error(`Invalid graph API response schema from ${source.label}`)
      continue
    }

    return transformGraphApiPayload(parsedGraph)
  }

  throw lastError ?? new Error('Failed to load curriculum data')
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function formatSchemaSummary(issues: CurriculumSchemaIssue[]): string {
  if (issues.length === 0) return 'Schema validation failed'
  const suffix = issues.length === 1 ? 'issue' : 'issues'
  return `Schema validation failed (${issues.length} ${suffix})`
}

function SchemaErrorScreen({ issues }: { issues: CurriculumSchemaIssue[] }) {
  return (
    <div className="error-boundary" role="alert">
      <div className="error-boundary-content">
        <h1>Curriculum data error</h1>
        <p className="error-message">Schema validation failed. Fix the data file and reload.</p>
        <ul className="mono" style={{ textAlign: 'left', margin: '0', paddingLeft: 20 }}>
          {issues.map((issue, index) => (
            <li key={`${issue.code}:${issue.nodeId ?? 'na'}:${issue.field ?? 'na'}:${index}`}>
              {formatSchemaIssue(issue)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function CurriculumProvider({
  children,
  autoLoad = import.meta.env.MODE !== 'test',
  loader = defaultCurriculumLoader
}: {
  children: React.ReactNode
  autoLoad?: boolean
  loader?: CurriculumLoader
}) {
  const [data, setData] = useState<CurriculumData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [issues, setIssues] = useState<CurriculumIssue[]>([])
  const [schemaIssues, setSchemaIssues] = useState<CurriculumSchemaIssue[]>([])

  useEffect(() => {
    if (!autoLoad) {
      return
    }

    const controller = new AbortController()

    async function run() {
      setLoading(true)
      setError(null)
      setIssues([])
      setSchemaIssues([])

      try {
        const payload = await loader({ signal: controller.signal })
        const result = validateCurriculumData(payload)

        if (!result.data || result.schemaIssues.length > 0) {
          setData(null)
          setIssues([])
          setSchemaIssues(result.schemaIssues)
          setError(formatSchemaSummary(result.schemaIssues))
          return
        }

        setData(result.data)
        setIssues(result.issues)
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }

        setError(formatError(err))
        setIssues([])
        setSchemaIssues([])
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      controller.abort()
    }
  }, [autoLoad, loader])

  const index = useMemo(() => {
    return data ? buildCurriculumIndex(data.nodes) : null
  }, [data])

  const value = useMemo<CurriculumContextValue>(() => {
    return { data, index, loading, error, issues, schemaIssues }
  }, [data, error, index, issues, loading, schemaIssues])

  if (schemaIssues.length > 0) {
    return <SchemaErrorScreen issues={schemaIssues} />
  }

  return (
    <CurriculumContext.Provider value={value}>
      {children}
    </CurriculumContext.Provider>
  )
}

export function useCurriculum(): CurriculumContextValue {
  const value = useContext(CurriculumContext)
  if (!value) {
    throw new Error('useCurriculum must be used within CurriculumProvider')
  }
  return value
}
