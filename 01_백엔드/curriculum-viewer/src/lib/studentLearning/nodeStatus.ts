import type { NodeStatus } from './types'

export function getMissingPrereqNodeIds(params: {
  prereqNodeIds: string[]
  clearedNodeIds: Set<string>
}): string[] {
  return params.prereqNodeIds.filter((id) => !params.clearedNodeIds.has(id))
}

export function calculateNodeStatus(params: {
  isCleared: boolean
  hasDraft: boolean
  hasSubmitted: boolean
  isStart?: boolean
  missingPrereqNodeIds: string[]
}): NodeStatus {
  if (params.isCleared) return 'CLEARED'
  if (params.hasDraft || params.hasSubmitted) return 'IN_PROGRESS'
  if (params.isStart) return 'AVAILABLE'
  if (params.missingPrereqNodeIds.length === 0) return 'AVAILABLE'
  return 'LOCKED'
}
