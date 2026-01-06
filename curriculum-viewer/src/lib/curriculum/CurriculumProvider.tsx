import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { buildCurriculumIndex, type CurriculumIndex } from './indexing'
import type { CurriculumData } from './types'

type CurriculumContextValue = {
  data: CurriculumData | null
  index: CurriculumIndex | null
  loading: boolean
  error: string | null
}

const CurriculumContext = createContext<CurriculumContextValue | null>(null)

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function CurriculumProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CurriculumData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return
    }

    const controller = new AbortController()

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/data/curriculum_math_v1.json', {
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Failed to load curriculum data (HTTP ${response.status})`)
        }

        const json = (await response.json()) as CurriculumData
        setData(json)
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }

        setError(formatError(err))
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
  }, [])

  const index = useMemo(() => {
    return data ? buildCurriculumIndex(data.nodes) : null
  }, [data])

  const value = useMemo<CurriculumContextValue>(() => {
    return { data, index, loading, error }
  }, [data, error, index, loading])

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

