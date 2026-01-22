import type { GraphRepository } from './graphRepository'
import { createGraphRepository } from './graphRepository'
import { createInMemoryGraphRepository } from './inMemoryGraphRepository'
import { getBrowserSessionStorage } from './storage'

export function createSessionGraphRepository(): GraphRepository {
  const storage = getBrowserSessionStorage()
  return storage ? createGraphRepository(storage) : createInMemoryGraphRepository()
}
