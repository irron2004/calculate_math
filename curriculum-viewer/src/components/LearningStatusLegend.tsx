import type { NodeStatus } from '../lib/studentLearning/types'

const LEGEND: Array<{ status: NodeStatus; label: string }> = [
  { status: 'CLEARED', label: 'CLEARED' },
  { status: 'AVAILABLE', label: 'AVAILABLE' },
  { status: 'IN_PROGRESS', label: 'IN_PROGRESS' },
  { status: 'LOCKED', label: 'LOCKED' }
]

export function LearningStatusBadge({ status }: { status: NodeStatus }) {
  return (
    <span className={`learning-status-badge status-${status}`}>
      <span className="learning-status-dot" aria-hidden="true" />
      {status}
    </span>
  )
}

export default function LearningStatusLegend() {
  return (
    <div className="learning-legend" aria-label="Node status legend">
      {LEGEND.map((item) => (
        <span key={item.status} className="legend-item">
          <LearningStatusBadge status={item.status} />
        </span>
      ))}
    </div>
  )
}
