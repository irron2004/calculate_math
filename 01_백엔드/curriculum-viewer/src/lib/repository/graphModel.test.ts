import { describe, expect, it } from 'vitest'
import validFixture from '../skillGraph/fixtures/skill_graph_valid.v1.json'
import { parseSkillGraphV1 } from '../skillGraph/schema'
import {
  createPublishedSnapshotFromDraft,
  getSkillGraphDraftKey,
  getSkillGraphPublishedKey,
  selectLatestPublishedSnapshot,
  selectStudentGraphSnapshot,
  SKILL_GRAPH_ACTIVE_GRAPH_ID_KEY,
  SKILL_GRAPH_PUBLISHED_LATEST_KEY
} from './graphModel'

describe('graphModel (pure rules)', () => {
  it('defines stable key rules for draft/published/activeGraphId', () => {
    expect(getSkillGraphDraftKey('u1', 'g1')).toBe('curriculum-viewer:author:skill-graph:draft:v1:u1:g1')
    expect(getSkillGraphPublishedKey('g1')).toBe('curriculum-viewer:skill-graph:published:v1:g1')
    expect(SKILL_GRAPH_PUBLISHED_LATEST_KEY).toBe('curriculum-viewer:skill-graph:published_latest:v1')
    expect(SKILL_GRAPH_ACTIVE_GRAPH_ID_KEY).toBe('curriculum-viewer:skill-graph:activeGraphId:v1')
  })

  it('returns null when there is no published snapshot', () => {
    expect(selectLatestPublishedSnapshot({ version: 1, graphId: 'G', snapshotsById: {} })).toBeNull()
  })

  it('selects the latest published by publishedAt', () => {
    const baseGraph = parseSkillGraphV1(validFixture)
    const store = {
      version: 1 as const,
      graphId: baseGraph.graphId,
      snapshotsById: {
        a: {
          publishedId: 'a',
          schemaVersion: 'skill-graph-v1' as const,
          graphId: baseGraph.graphId,
          publishedAt: '2026-01-15T00:00:01.000Z',
          graph: { ...baseGraph, title: 'newest by time' }
        },
        b: {
          publishedId: 'b',
          schemaVersion: 'skill-graph-v1' as const,
          graphId: baseGraph.graphId,
          publishedAt: '2026-01-15T00:00:00.000Z',
          graph: baseGraph
        }
      }
    }

    const selected = selectLatestPublishedSnapshot(store)
    expect(selected?.publishedId).toBe('a')
    expect(selected?.graph.title).toBe('newest by time')
  })

  it('uses publishedId as a deterministic tie-breaker when publishedAt is equal', () => {
    const baseGraph = parseSkillGraphV1(validFixture)
    const store = {
      version: 1 as const,
      graphId: baseGraph.graphId,
      snapshotsById: {
        a: {
          publishedId: 'a',
          schemaVersion: 'skill-graph-v1' as const,
          graphId: baseGraph.graphId,
          publishedAt: '2026-01-15T00:00:00.000Z',
          graph: baseGraph
        },
        b: {
          publishedId: 'b',
          schemaVersion: 'skill-graph-v1' as const,
          graphId: baseGraph.graphId,
          publishedAt: '2026-01-15T00:00:00.000Z',
          graph: { ...baseGraph, title: 'newer by id' }
        }
      }
    }

    const selected = selectLatestPublishedSnapshot(store)
    expect(selected?.publishedId).toBe('b')
    expect(selected?.graph.title).toBe('newer by id')
  })

  it('returns null when published is missing (fallback)', () => {
    expect(selectStudentGraphSnapshot({ activeGraphId: null, publishedStore: null })).toBeNull()
    expect(selectStudentGraphSnapshot({ activeGraphId: 'G', publishedStore: null })).toBeNull()
    expect(
      selectStudentGraphSnapshot({
        activeGraphId: 'G',
        publishedStore: { version: 1, graphId: 'G', snapshotsById: {} }
      })
    ).toBeNull()
  })

  it('selects student snapshot only when activeGraphId matches store', () => {
    const baseGraph = parseSkillGraphV1(validFixture)
    const store = {
      version: 1 as const,
      graphId: baseGraph.graphId,
      snapshotsById: {
        x: { publishedId: 'x', schemaVersion: 'skill-graph-v1' as const, graphId: baseGraph.graphId, publishedAt: '2026-01-15T00:00:00.000Z', graph: baseGraph }
      }
    }

    expect(selectStudentGraphSnapshot({ activeGraphId: 'OTHER', publishedStore: store })).toBeNull()
    expect(selectStudentGraphSnapshot({ activeGraphId: baseGraph.graphId, publishedStore: store })?.publishedId).toBe('x')
  })

  it('creates an immutable published snapshot (draft edits do not leak)', () => {
    const baseGraph = parseSkillGraphV1(validFixture)
    const draft = { ...baseGraph, title: 'draft title' }
    const originalNodeLabel = draft.nodes[0]?.label ?? ''

    const snapshot = createPublishedSnapshotFromDraft({ graph: draft, publishedId: 'p1', now: '2026-01-15T00:00:00.000Z' })
    expect(snapshot).not.toBeNull()
    if (!snapshot) return

    draft.title = 'mutated after publish'
    if (draft.nodes[0]) draft.nodes[0].label = 'mutated label'

    expect(snapshot.graph.title).toBe('draft title')
    expect(snapshot.graph.nodes[0]?.label).toBe(originalNodeLabel)
  })
})
