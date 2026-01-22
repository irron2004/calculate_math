import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { buildCurriculumIndex, type CurriculumIndex } from './indexing'
import { formatSchemaIssue, validateCurriculumData } from './dataValidation.js'
import type { CurriculumSchemaIssue } from './dataValidation.js'
import type { CurriculumIssue } from './validateTypes'
import type { CurriculumData } from './types'

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

export const defaultCurriculumLoader: CurriculumLoader = async ({ signal }) => {
  const response = await fetch('/data/curriculum_math_v1.json', { signal })

  if (!response.ok) {
    throw new Error(`Failed to load curriculum data (HTTP ${response.status})`)
  }

  return await response.json()
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
