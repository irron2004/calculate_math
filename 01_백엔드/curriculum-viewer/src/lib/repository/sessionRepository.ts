import { getBrowserStorage } from './storage'
import { readAttemptSessionStoreV1, writeAttemptSessionStoreV1 } from '../studentLearning/storage'
import type { AttemptSessionStoreV1 } from '../studentLearning/types'

export type SessionRepository = {
  readStore: (userId: string) => AttemptSessionStoreV1
  writeStore: (userId: string, store: AttemptSessionStoreV1) => void
}

export function createSessionRepository(storage: Storage): SessionRepository {
  return {
    readStore: (userId) => readAttemptSessionStoreV1(storage, userId),
    writeStore: (userId, store) => writeAttemptSessionStoreV1(storage, userId, store)
  }
}

export function createBrowserSessionRepository(): SessionRepository | null {
  const storage = getBrowserStorage()
  if (!storage) return null
  return createSessionRepository(storage)
}

