import { describe, expect, it } from 'vitest'
import type { CurriculumData } from '../curriculum/types'
import type { SkillGraphV1 } from './schema'
import { buildSkillGraphFromCurriculum, mergeCurriculumIntoGraph } from './curriculumSync'

function sampleCurriculum(): CurriculumData {
  return {
    meta: { curriculum_id: 'KR-MATH-2022', schema_version: 'curriculum_math_v1', locale: 'ko-KR' },
    nodes: [
      {
        id: 'A',
        type: 'subject',
        title: 'Subject A',
        children_ids: ['B']
      },
      {
        id: 'B',
        type: 'grade',
        title: 'Grade B',
        children_ids: []
      }
    ]
  }
}

function baseGraph(): SkillGraphV1 {
  return {
    schemaVersion: 'skill-graph-v1',
    graphId: 'g1',
    title: 't',
    nodes: [{ id: 'X', nodeCategory: 'core', label: 'X' }],
    edges: []
  }
}

describe('curriculumSync', () => {
  it('builds a skill graph from curriculum data', () => {
    const graph = buildSkillGraphFromCurriculum(sampleCurriculum())

    expect(graph.graphId).toBe('KR-MATH-2022')
    expect(graph.nodes.map((node) => node.id)).toEqual(['A', 'B'])
    expect(graph.edges).toEqual([{ edgeType: 'contains', source: 'A', target: 'B' }])
  })

  it('merges curriculum nodes and edges into an existing graph', () => {
    const graph = baseGraph()
    const result = mergeCurriculumIntoGraph({ graph, curriculum: sampleCurriculum() })

    expect(result.changed).toBe(true)
    expect(result.graph.nodes.map((node) => node.id)).toEqual(['X', 'A', 'B'])
    expect(result.graph.edges).toEqual([{ edgeType: 'contains', source: 'A', target: 'B' }])
  })

  it('is idempotent when curriculum nodes already exist', () => {
    const existing = buildSkillGraphFromCurriculum(sampleCurriculum())
    const result = mergeCurriculumIntoGraph({ graph: existing, curriculum: sampleCurriculum() })

    expect(result.changed).toBe(false)
    expect(result.graph.nodes.map((node) => node.id)).toEqual(['A', 'B'])
  })
})
