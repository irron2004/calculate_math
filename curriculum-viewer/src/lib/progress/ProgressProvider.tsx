import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useCurriculum } from '../curriculum/CurriculumProvider'
import { loadProblemBank, type Problem } from '../learn/problems'
import { getDomainStats, getNodeStatusMap, getProgressStats, getRecommendation } from './core'
import { LAST_RESULT_PREFIX, readLastResultsByNodeId } from './storage'
import type { DomainStat, NodeStatus, ProgressStats, Recommendation } from './types'

type ProgressContextValue = {
  statusByNodeId: Map<string, NodeStatus>
  progressStats: ProgressStats | null
  domainStats: DomainStat[]
  recommendation: Recommendation
  loading: boolean
  error: string | null
  refresh: () => void
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function ProgressProvider({
  children,
  threshold = 1,
  autoLoad = true,
  storage = typeof window !== 'undefined' ? window.localStorage : undefined
}: {
  children: React.ReactNode
  threshold?: number
  autoLoad?: boolean
  storage?: Storage
}) {
  const { data: curriculumData, loading: curriculumLoading, error: curriculumError } = useCurriculum()

  const [problemBankLoading, setProblemBankLoading] = useState(false)
  const [problemBankError, setProblemBankError] = useState<string | null>(null)
  const [problemsByNodeId, setProblemsByNodeId] = useState<Record<string, Problem[]>>({})

  const [storageRevision, setStorageRevision] = useState(0)
  const refresh = () => setStorageRevision((prev) => prev + 1)

  useEffect(() => {
    if (!autoLoad) return

    const controller = new AbortController()

    async function run() {
      setProblemBankLoading(true)
      setProblemBankError(null)

      try {
        const bank = await loadProblemBank(controller.signal)
        setProblemsByNodeId(bank.problemsByNodeId)
      } catch (err) {
        if (controller.signal.aborted) return
        setProblemBankError(formatError(err))
      } finally {
        if (!controller.signal.aborted) {
          setProblemBankLoading(false)
        }
      }
    }

    run()

    return () => {
      controller.abort()
    }
  }, [autoLoad])

  useEffect(() => {
    if (!storage) return

    const listener = (event: StorageEvent) => {
      if (typeof event.key !== 'string') return
      if (!event.key.startsWith(LAST_RESULT_PREFIX)) return
      refresh()
    }

    window.addEventListener('storage', listener)
    return () => {
      window.removeEventListener('storage', listener)
    }
  }, [storage])

  const lastResultsByNodeId = useMemo(() => {
    if (!storage) return {}
    return readLastResultsByNodeId(storage)
  }, [storage, storageRevision])

  const snapshot = useMemo(() => {
    if (!curriculumData) {
      return {
        statusByNodeId: new Map<string, NodeStatus>(),
        progressStats: null,
        domainStats: [] as DomainStat[],
        recommendation: null as Recommendation
      }
    }

    return {
      statusByNodeId: getNodeStatusMap({
        curriculumNodes: curriculumData.nodes,
        problemsByNodeId,
        lastResultsByNodeId,
        threshold
      }),
      progressStats: getProgressStats({
        curriculumNodes: curriculumData.nodes,
        problemsByNodeId,
        lastResultsByNodeId,
        threshold
      }),
      domainStats: getDomainStats({
        curriculumNodes: curriculumData.nodes,
        problemsByNodeId,
        lastResultsByNodeId,
        threshold
      }),
      recommendation: getRecommendation({
        curriculumNodes: curriculumData.nodes,
        problemsByNodeId,
        lastResultsByNodeId,
        threshold
      })
    }
  }, [curriculumData, lastResultsByNodeId, problemsByNodeId, threshold])

  const loading = curriculumLoading || problemBankLoading
  const error = curriculumError ?? problemBankError

  const value = useMemo<ProgressContextValue>(() => {
    return {
      ...snapshot,
      loading,
      error,
      refresh
    }
  }, [error, loading, snapshot])

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext)
  if (!value) {
    throw new Error('useProgress must be used within ProgressProvider')
  }
  return value
}
