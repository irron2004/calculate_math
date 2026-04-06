import { describe, expect, it } from 'vitest'
import validFixture from '../skillGraph/fixtures/skill_graph_valid.v1.json'
import { parseSkillGraphV1 } from '../skillGraph/schema'
import { createInMemoryGraphRepository } from './inMemoryGraphRepository'

describe('InMemoryGraphRepository', () => {
  it('round-trips draft save/load per user + graphId', () => {
    const repo = createInMemoryGraphRepository()
    const graph = parseSkillGraphV1(validFixture)

    expect(repo.loadDraft({ userId: 'u1', graphId: graph.graphId })).toBeNull()
    repo.saveDraft({ userId: 'u1', graph, now: '2026-01-15T00:00:00.000Z' })
    expect(repo.loadDraft({ userId: 'u1', graphId: graph.graphId })?.draft.title).toBe(graph.title)
    expect(repo.loadDraft({ userId: 'u2', graphId: graph.graphId })).toBeNull()
  })

  it('publishes immutable snapshots and loads student graph via activeGraphId', () => {
    const repo = createInMemoryGraphRepository()
    const base = parseSkillGraphV1(validFixture)

    repo.saveDraft({ userId: 'u1', graph: base, now: '2026-01-15T00:00:00.000Z' })
    const snapshot = repo.publishDraft({ userId: 'u1', graphId: base.graphId, now: '2026-01-15T00:00:01.000Z', setActive: true })
    expect(snapshot).not.toBeNull()

    repo.saveDraft({ userId: 'u1', graph: { ...base, title: 'draft changed' }, now: '2026-01-15T00:00:02.000Z' })
    const student = repo.loadStudentGraph()
    expect(student?.graph.title).toBe(base.title)
  })

  it('selects latest published by publishedAt then publishedId', () => {
    const repo = createInMemoryGraphRepository()
    const base = parseSkillGraphV1(validFixture)

    repo.savePublishedStore({
      version: 1,
      graphId: base.graphId,
      snapshotsById: {
        a: { publishedId: 'a', schemaVersion: 'skill-graph-v1', graphId: base.graphId, publishedAt: '2026-01-15T00:00:00.000Z', graph: base },
        b: { publishedId: 'b', schemaVersion: 'skill-graph-v1', graphId: base.graphId, publishedAt: '2026-01-15T00:00:00.000Z', graph: { ...base, title: 'tie broken by id' } },
        c: { publishedId: 'c', schemaVersion: 'skill-graph-v1', graphId: base.graphId, publishedAt: '2026-01-15T00:00:01.000Z', graph: { ...base, title: 'newest by time' } }
      }
    })

    const store = repo.loadPublishedStore({ graphId: base.graphId })
    expect(store).not.toBeNull()
    const latest = store ? repo.selectLatestPublished(store) : null
    expect(latest?.publishedId).toBe('c')
    expect(latest?.graph.title).toBe('newest by time')
  })

  it('supports single-key latest published overwrite in memory', () => {
    const repo = createInMemoryGraphRepository()
    const base = parseSkillGraphV1(validFixture)

    expect(repo.loadLatestSingle()).toBeNull()
    repo.publishLatestSingle({ graph: base, now: '2026-01-15T00:00:00.000Z' })
    repo.publishLatestSingle({ graph: { ...base, title: 'v2' }, now: '2026-01-15T00:00:01.000Z' })
    expect(repo.loadLatestSingle()?.graph.title).toBe('v2')
  })
})

