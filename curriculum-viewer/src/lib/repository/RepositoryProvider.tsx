import { createContext, useContext, useMemo } from 'react'
import type { GraphRepository } from './graphRepository'
import type { ProblemRepository } from './problemRepository'
import type { SessionRepository } from './sessionRepository'
import { createBrowserProblemRepository } from './problemRepository'
import { createBrowserSessionRepository } from './sessionRepository'
import { createSessionGraphRepository } from './sessionGraphRepository'

type RepositoryContextValue = {
  graphRepository: GraphRepository
  problemRepository: ProblemRepository | null
  sessionRepository: SessionRepository | null
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null)

export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const graphRepository = useMemo(() => createSessionGraphRepository(), [])
  const problemRepository = useMemo(() => createBrowserProblemRepository(), [])
  const sessionRepository = useMemo(() => createBrowserSessionRepository(), [])

  const value = useMemo<RepositoryContextValue>(() => {
    return { graphRepository, problemRepository, sessionRepository }
  }, [graphRepository, problemRepository, sessionRepository])

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>
}

export function useRepositories(): RepositoryContextValue {
  const value = useContext(RepositoryContext)
  if (!value) {
    throw new Error('useRepositories must be used within RepositoryProvider')
  }
  return value
}
