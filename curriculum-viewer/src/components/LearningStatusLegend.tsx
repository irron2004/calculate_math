import type { NodeStatus } from '../lib/studentLearning/types'

const LEARNING_STATUS_META: Record<NodeStatus, { label: string; icon: string }> = {
  CLEARED: { label: 'CLEARED', icon: 'check' },
  AVAILABLE: { label: 'AVAILABLE', icon: 'play' },
  IN_PROGRESS: { label: 'IN_PROGRESS', icon: 'clock' },
  LOCKED: { label: 'LOCKED', icon: 'lock' }
}

const LEGEND_ORDER: NodeStatus[] = ['CLEARED', 'AVAILABLE', 'IN_PROGRESS', 'LOCKED']

export function LearningStatusBadge({ status }: { status: NodeStatus }) {
  const meta = LEARNING_STATUS_META[status]
  return (
    <span className={`learning-status-badge status-${status}`}>
      <span className="learning-status-dot" aria-hidden="true" data-icon={meta.icon} />
      {meta.label}
    </span>
  )
}

export default function LearningStatusLegend() {
  return (
    <div className="learning-legend" aria-label="Node status legend">
      {LEGEND_ORDER.map((status) => (
        <span key={status} className="legend-item">
          <LearningStatusBadge status={status} />
        </span>
      ))}
    </div>
  )
}
