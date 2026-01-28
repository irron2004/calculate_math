export type PrereqEdge = {
  source: string
  target: string
}

export type PrereqEdgeOrigin = 'base' | 'research' | 'manual'

export type PrereqEditState = {
  base: PrereqEdge[]
  research: PrereqEdge[]
  added: PrereqEdge[]
  removed: PrereqEdge[]
  suppressedResearch: PrereqEdge[]
}

export type PrereqEdgeWithOrigin = PrereqEdge & { origin: PrereqEdgeOrigin }

export function prereqEdgeKey(edge: PrereqEdge): string {
  return `${edge.source}\u0000${edge.target}`
}

function uniqueEdges(edges: PrereqEdge[]): PrereqEdge[] {
  const seen = new Set<string>()
  const result: PrereqEdge[] = []
  for (const edge of edges) {
    const key = prereqEdgeKey(edge)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(edge)
  }
  return result
}

function removeEdge(edges: PrereqEdge[], key: string): PrereqEdge[] {
  return edges.filter((edge) => prereqEdgeKey(edge) !== key)
}

function hasEdge(edges: PrereqEdge[], key: string): boolean {
  return edges.some((edge) => prereqEdgeKey(edge) === key)
}

export function createPrereqEditState(params: { base: PrereqEdge[]; research: PrereqEdge[] }): PrereqEditState {
  return {
    base: uniqueEdges(params.base),
    research: uniqueEdges(params.research),
    added: [],
    removed: [],
    suppressedResearch: []
  }
}

export function listCurrentPrereqEdges(state: PrereqEditState): PrereqEdgeWithOrigin[] {
  const removedKeys = new Set(state.removed.map(prereqEdgeKey))
  const suppressedKeys = new Set(state.suppressedResearch.map(prereqEdgeKey))

  const baseEdges = state.base.filter((edge) => !removedKeys.has(prereqEdgeKey(edge)))
  const baseKeys = new Set(baseEdges.map(prereqEdgeKey))

  const researchEdges = state.research.filter((edge) => {
    const key = prereqEdgeKey(edge)
    if (suppressedKeys.has(key)) return false
    if (baseKeys.has(key)) return false
    return true
  })
  const researchKeys = new Set(researchEdges.map(prereqEdgeKey))

  const addedEdges = state.added.filter((edge) => {
    const key = prereqEdgeKey(edge)
    if (baseKeys.has(key)) return false
    if (researchKeys.has(key)) return false
    return true
  })

  return [
    ...baseEdges.map((edge) => ({ ...edge, origin: 'base' as const })),
    ...researchEdges.map((edge) => ({ ...edge, origin: 'research' as const })),
    ...addedEdges.map((edge) => ({ ...edge, origin: 'manual' as const }))
  ]
}

function isEdgePresent(state: PrereqEditState, key: string): boolean {
  if (hasEdge(state.added, key)) return true
  if (hasEdge(state.removed, key)) {
    // removed base edge: not present
    return false
  }

  const basePresent = hasEdge(state.base, key)
  if (basePresent) return true

  if (hasEdge(state.suppressedResearch, key)) return false
  const researchPresent = hasEdge(state.research, key)
  return researchPresent
}

export function addPrereqEdge(state: PrereqEditState, edge: PrereqEdge): PrereqEditState {
  const key = prereqEdgeKey(edge)
  if (isEdgePresent(state, key)) return state

  if (hasEdge(state.removed, key)) {
    return { ...state, removed: removeEdge(state.removed, key) }
  }

  if (hasEdge(state.suppressedResearch, key)) {
    return { ...state, suppressedResearch: removeEdge(state.suppressedResearch, key) }
  }

  return { ...state, added: uniqueEdges([...state.added, edge]) }
}

export function removePrereqEdge(state: PrereqEditState, edge: PrereqEdge): PrereqEditState {
  const key = prereqEdgeKey(edge)

  if (!isEdgePresent(state, key)) {
    return state
  }

  if (hasEdge(state.added, key)) {
    return { ...state, added: removeEdge(state.added, key) }
  }

  const baseHas = hasEdge(state.base, key)
  const removedHas = hasEdge(state.removed, key)
  if (baseHas && !removedHas) {
    return { ...state, removed: uniqueEdges([...state.removed, edge]) }
  }

  const researchHas = hasEdge(state.research, key)
  const suppressedHas = hasEdge(state.suppressedResearch, key)
  if (researchHas && !suppressedHas) {
    return { ...state, suppressedResearch: uniqueEdges([...state.suppressedResearch, edge]) }
  }

  return state
}

export type PrereqCycleResult = {
  hasCycle: boolean
  path: string[] | null
}

export function detectPrereqCycle(edges: PrereqEdge[]): PrereqCycleResult {
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, [])
    adjacency.get(edge.source)?.push(edge.target)
  }

  const color = new Map<string, 0 | 1 | 2>()
  for (const nodeId of adjacency.keys()) color.set(nodeId, 0)

  const stack: string[] = []
  const stackIndex = new Map<string, number>()

  const visit = (nodeId: string): string[] | null => {
    color.set(nodeId, 1)
    stackIndex.set(nodeId, stack.length)
    stack.push(nodeId)

    for (const nextId of adjacency.get(nodeId) ?? []) {
      const state = color.get(nextId) ?? 0
      if (state === 1) {
        const startIndex = stackIndex.get(nextId)
        if (startIndex === undefined) {
          return [nodeId, nextId]
        }
        return [...stack.slice(startIndex), nextId]
      }
      if (state === 0) {
        const found = visit(nextId)
        if (found) return found
      }
    }

    stack.pop()
    stackIndex.delete(nodeId)
    color.set(nodeId, 2)
    return null
  }

  for (const nodeId of adjacency.keys()) {
    if ((color.get(nodeId) ?? 0) !== 0) continue
    const found = visit(nodeId)
    if (found) return { hasCycle: true, path: found }
  }

  return { hasCycle: false, path: null }
}

