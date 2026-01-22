import { beforeEach, describe, expect, it } from 'vitest'
import validFixture from '../skillGraph/fixtures/skill_graph_valid.v1.json'
import { parseSkillGraphV1 } from '../skillGraph/schema'
import { createSessionGraphRepository } from './sessionGraphRepository'

describe('createSessionGraphRepository', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('persists drafts across repository instances (session refresh)', () => {
    const graph = parseSkillGraphV1(validFixture)
    const first = createSessionGraphRepository()
    first.saveDraft({ userId: 'author_dev', graph, now: '2026-01-15T00:00:00.000Z' })

    const second = createSessionGraphRepository()
    const loaded = second.loadDraft({ userId: 'author_dev', graphId: graph.graphId })
    expect(loaded?.draft.title).toBe(graph.title)
  })
})
