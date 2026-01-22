import { describe, expect, it } from 'vitest'
import validFixture from '../skillGraph/fixtures/skill_graph_valid.v1.json'
import { parseSkillGraphV1 } from '../skillGraph/schema'
import {
  createGraphRepository,
  SKILL_GRAPH_ACTIVE_GRAPH_ID_KEY,
  SKILL_GRAPH_PUBLISHED_KEY_PREFIX,
  SKILL_GRAPH_DRAFT_KEY_PREFIX,
  SKILL_GRAPH_PUBLISHED_LATEST_KEY
} from './graphRepository'

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

describe('GraphRepository (LocalStorage)', () => {
  it('saves and loads drafts per user + graphId', () => {
    const storage = new MemoryStorage()
    const repo = createGraphRepository(storage)
    const baseGraph = parseSkillGraphV1(validFixture)

    repo.importGraph({ userId: 'u1', graph: baseGraph, now: '2026-01-15T00:00:00.000Z' })
    expect(repo.loadDraft({ userId: 'u1', graphId: baseGraph.graphId })?.draft.title).toBe(baseGraph.title)
    expect(repo.loadDraft({ userId: 'u2', graphId: baseGraph.graphId })).toBeNull()
  })

  it('keeps draft and published stores separate', () => {
    const storage = new MemoryStorage()
    const repo = createGraphRepository(storage)
    const baseGraph = parseSkillGraphV1(validFixture)

    repo.saveDraft({ userId: 'u1', graph: baseGraph, now: '2026-01-15T00:00:00.000Z' })
    repo.publishDraft({ userId: 'u1', graphId: baseGraph.graphId, now: '2026-01-15T00:00:01.000Z' })

    const draftKey = `${SKILL_GRAPH_DRAFT_KEY_PREFIX}u1:${baseGraph.graphId}`
    const publishedKey = `${SKILL_GRAPH_PUBLISHED_KEY_PREFIX}${baseGraph.graphId}`
    expect(storage.getItem(draftKey)).not.toBeNull()
    expect(storage.getItem(publishedKey)).not.toBeNull()
  })

  it('selects the latest published by publishedAt then publishedId', () => {
    const storage = new MemoryStorage()
    const repo = createGraphRepository(storage)
    const baseGraph = parseSkillGraphV1(validFixture)

    repo.savePublishedStore({
      version: 1,
      graphId: baseGraph.graphId,
      snapshotsById: {
        a: { publishedId: 'a', schemaVersion: 'skill-graph-v1', graphId: baseGraph.graphId, publishedAt: '2026-01-15T00:00:00.000Z', graph: baseGraph },
        b: { publishedId: 'b', schemaVersion: 'skill-graph-v1', graphId: baseGraph.graphId, publishedAt: '2026-01-15T00:00:00.000Z', graph: { ...baseGraph, title: 'newer by id' } },
        c: { publishedId: 'c', schemaVersion: 'skill-graph-v1', graphId: baseGraph.graphId, publishedAt: '2026-01-15T00:00:01.000Z', graph: { ...baseGraph, title: 'newest by time' } }
      }
    })

    const store = repo.loadPublishedStore({ graphId: baseGraph.graphId })
    expect(store).not.toBeNull()
    const latest = store ? repo.selectLatestPublished(store) : null
    expect(latest?.publishedId).toBe('c')
    expect(latest?.graph.title).toBe('newest by time')
  })

  it('publishes an immutable snapshot that does not change after draft updates', () => {
    const storage = new MemoryStorage()
    const repo = createGraphRepository(storage)
    const baseGraph = parseSkillGraphV1(validFixture)

    repo.saveDraft({ userId: 'u1', graph: baseGraph, now: '2026-01-15T00:00:00.000Z' })
    const published = repo.publishDraft({ userId: 'u1', graphId: baseGraph.graphId, now: '2026-01-15T00:00:01.000Z' })
    expect(published).not.toBeNull()

    repo.saveDraft({ userId: 'u1', graph: { ...baseGraph, title: 'changed draft title' }, now: '2026-01-15T00:00:02.000Z' })
    const store = repo.loadPublishedStore({ graphId: baseGraph.graphId })
    expect(store).not.toBeNull()
    const latest = store ? repo.selectLatestPublished(store) : null
    expect(latest?.graph.title).toBe(baseGraph.title)
  })

  it('exports draft by default and published_latest when requested', () => {
    const storage = new MemoryStorage()
    const repo = createGraphRepository(storage)
    const baseGraph = parseSkillGraphV1(validFixture)

    repo.saveDraft({ userId: 'u1', graph: baseGraph, now: '2026-01-15T00:00:00.000Z' })
    repo.publishDraft({ userId: 'u1', graphId: baseGraph.graphId, now: '2026-01-15T00:00:01.000Z' })
    repo.saveDraft({ userId: 'u1', graph: { ...baseGraph, title: 'draft' }, now: '2026-01-15T00:00:02.000Z' })

    expect(repo.exportGraph({ userId: 'u1', graphId: baseGraph.graphId })?.title).toBe('draft')
    expect(repo.exportGraph({ userId: 'u1', graphId: baseGraph.graphId, target: 'published_latest' })?.title).toBe(baseGraph.title)
  })

  it('loads student graph using activeGraphId; returns null if missing', () => {
    const storage = new MemoryStorage()
    const repo = createGraphRepository(storage)
    const baseGraph = parseSkillGraphV1(validFixture)

    expect(repo.loadStudentGraph()).toBeNull()
    repo.saveDraft({ userId: 'u1', graph: baseGraph, now: '2026-01-15T00:00:00.000Z' })
    repo.publishDraft({ userId: 'u1', graphId: baseGraph.graphId, now: '2026-01-15T00:00:01.000Z', setActive: true })
    expect(storage.getItem(SKILL_GRAPH_ACTIVE_GRAPH_ID_KEY)).toBe(baseGraph.graphId)
    expect(repo.loadStudentGraph()?.graphId).toBe(baseGraph.graphId)
  })

  it('overwrites the latest published snapshot in single-key mode', () => {
    const storage = new MemoryStorage()
    const repo = createGraphRepository(storage)
    const baseGraph = parseSkillGraphV1(validFixture)

    expect(repo.loadLatestSingle()).toBeNull()

    repo.publishLatestSingle({ graph: baseGraph, now: '2026-01-15T00:00:00.000Z' })
    expect(repo.loadLatestSingle()?.graph.title).toBe(baseGraph.title)

    repo.publishLatestSingle({ graph: { ...baseGraph, title: 'v2' }, now: '2026-01-15T00:00:01.000Z' })
    expect(repo.loadLatestSingle()?.graph.title).toBe('v2')
    expect(storage.key(0)).toBe(SKILL_GRAPH_PUBLISHED_LATEST_KEY)
  })

  it('clears corrupted draft storage on read', () => {
    const storage = new MemoryStorage()
    const repo = createGraphRepository(storage)
    const baseGraph = parseSkillGraphV1(validFixture)

    const key = `${SKILL_GRAPH_DRAFT_KEY_PREFIX}u1:${baseGraph.graphId}`
    storage.setItem(key, '{not json')
    expect(repo.loadDraft({ userId: 'u1', graphId: baseGraph.graphId })).toBeNull()
    expect(storage.getItem(key)).toBeNull()
  })
})
