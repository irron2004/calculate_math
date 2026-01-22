import { createEmptyAttemptSessionStoreV1, upsertDraftAttemptSession } from './attemptSession'
import {
  getAttemptSessionsStorageKey,
  parseAttemptSessionStoreV1,
  readAttemptSessionStoreV1,
  writeAttemptSessionStoreV1
} from './storage'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }

  clear(): void {
    this.data.clear()
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.data.keys()).sort()[index] ?? null
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

class ThrowingStorage extends MemoryStorage {
  setItem(): void {
    throw new Error('QuotaExceededError')
  }
}

describe('AttemptSession storage adapter', () => {
  it('uses the v1 key prefix with userId', () => {
    expect(getAttemptSessionsStorageKey('u1')).toBe('curriculum-viewer:student:attemptSessions:v1:u1')
  })

  it('returns empty store when key is missing', () => {
    const storage = new MemoryStorage()
    expect(readAttemptSessionStoreV1(storage, 'u1')).toEqual(createEmptyAttemptSessionStoreV1())
  })

  it('round-trips store via localStorage', () => {
    const storage = new MemoryStorage()
    const { store } = upsertDraftAttemptSession({
      store: createEmptyAttemptSessionStoreV1(),
      nodeId: 'A',
      sessionId: 's1',
      now: '2026-01-15T00:00:00.000Z'
    })

    writeAttemptSessionStoreV1(storage, 'u1', store)
    const read = readAttemptSessionStoreV1(storage, 'u1')

    expect(read).toEqual(store)
  })

  it('does not throw when storage.setItem fails', () => {
    const storage = new ThrowingStorage()
    expect(() => writeAttemptSessionStoreV1(storage, 'u1', createEmptyAttemptSessionStoreV1())).not.toThrow()
  })

  it('resets storage to empty store on corrupted JSON', () => {
    const storage = new MemoryStorage()
    const key = getAttemptSessionsStorageKey('u1')
    storage.setItem(key, '{not json')

    expect(readAttemptSessionStoreV1(storage, 'u1')).toEqual(createEmptyAttemptSessionStoreV1())
    expect(storage.getItem(key)).toBeNull()
  })

  it('resets storage to empty store on version mismatch', () => {
    const storage = new MemoryStorage()
    const key = getAttemptSessionsStorageKey('u1')
    storage.setItem(
      key,
      JSON.stringify({
        version: 2,
        sessionsById: {},
        draftSessionIdByNodeId: {}
      })
    )

    expect(readAttemptSessionStoreV1(storage, 'u1')).toEqual(createEmptyAttemptSessionStoreV1())
    expect(storage.getItem(key)).toBeNull()
  })

  it('rejects store when a submitted session is missing grading', () => {
    const raw = JSON.stringify({
      version: 1,
      sessionsById: {
        s1: {
          nodeId: 'A',
          sessionId: 's1',
          status: 'SUBMITTED',
          responses: {},
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-01-15T00:00:00.000Z'
        }
      },
      draftSessionIdByNodeId: {}
    })

    expect(parseAttemptSessionStoreV1(raw)).toEqual({
      version: 1,
      sessionsById: {},
      draftSessionIdByNodeId: {}
    })
  })
})
