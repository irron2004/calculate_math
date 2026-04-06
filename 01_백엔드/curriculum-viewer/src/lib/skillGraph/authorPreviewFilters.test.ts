import { describe, expect, it } from 'vitest'
import type { SkillGraphNodeV1 } from './schema'
import { filterSkillGraphNodes } from './authorPreviewFilters'

const baseNodes: SkillGraphNodeV1[] = [
  { id: 'CORE-1', nodeCategory: 'core', label: 'Algebra Basics' },
  { id: 'CHAL-2', nodeCategory: 'challenge', label: 'Algebra Challenge' },
  { id: 'FORM-3', nodeCategory: 'formal', label: 'Proof Intro' }
]

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value

  Object.freeze(value)
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}

describe('filterSkillGraphNodes', () => {
  it('matches query against label or id', () => {
    expect(filterSkillGraphNodes(baseNodes, { query: 'algebra', category: 'all' })).toEqual([
      baseNodes[0],
      baseNodes[1]
    ])

    expect(filterSkillGraphNodes(baseNodes, { query: 'form-3', category: 'all' })).toEqual([
      baseNodes[2]
    ])
  })

  it('applies category filter as intersection', () => {
    expect(filterSkillGraphNodes(baseNodes, { query: 'algebra', category: 'core' })).toEqual([
      baseNodes[0]
    ])

    expect(filterSkillGraphNodes(baseNodes, { query: 'algebra', category: 'formal' })).toEqual([])
  })

  it('returns all nodes when query is empty and category is all', () => {
    expect(filterSkillGraphNodes(baseNodes, { query: '  ', category: 'all' })).toEqual(baseNodes)
  })

  it('does not mutate input nodes', () => {
    const frozen = deepFreeze(baseNodes)
    expect(() => filterSkillGraphNodes(frozen, { query: 'algebra', category: 'all' })).not.toThrow()
  })
})
