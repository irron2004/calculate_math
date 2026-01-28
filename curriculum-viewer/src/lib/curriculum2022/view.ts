import type { CSSProperties } from 'react'

export type PrereqEdgeStyleOrigin = 'existing' | 'research' | 'manual'

export function getEdgeStyle(
  edgeType: string,
  options?: { prereqOrigin?: PrereqEdgeStyleOrigin }
): CSSProperties {
  switch (edgeType) {
    case 'prereq':
      switch (options?.prereqOrigin ?? 'existing') {
        case 'manual':
          return { stroke: '#22c55e', strokeWidth: 3, opacity: 0.95 }
        case 'research':
          return { stroke: '#d97706', strokeWidth: 2.5, opacity: 0.95, strokeDasharray: '6 4' }
        case 'existing':
        default:
          return { stroke: '#ef4444', strokeWidth: 3, opacity: 0.95 }
      }
    case 'contains':
      return { stroke: '#94a3b8', strokeWidth: 1.5, opacity: 0.8 }
    case 'alignsTo':
      return { stroke: '#0ea5e9', strokeWidth: 1.5, opacity: 0.85, strokeDasharray: '6 4' }
    default:
      return { stroke: '#64748b', strokeWidth: 1.5, opacity: 0.85 }
  }
}
