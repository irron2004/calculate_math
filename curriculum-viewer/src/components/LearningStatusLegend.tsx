import type { NodeStatus } from '../lib/studentLearning/types'

const LEARNING_STATUS_META: Record<NodeStatus, { label: string; emoji: string; description: string }> = {
  CLEARED: { label: '완료', emoji: '⭐', description: '잘했어요!' },
  AVAILABLE: { label: '도전 가능', emoji: '🚀', description: '도전해보세요!' },
  IN_PROGRESS: { label: '진행 중', emoji: '📚', description: '열심히 하는 중!' },
  LOCKED: { label: '잠금', emoji: '🔒', description: '먼저 배워야 해요' }
}

const LEGEND_ORDER: NodeStatus[] = ['CLEARED', 'AVAILABLE', 'IN_PROGRESS', 'LOCKED']

export function LearningStatusBadge({ status }: { status: NodeStatus }) {
  const meta = LEARNING_STATUS_META[status]
  return (
    <span className={`learning-status-badge status-${status}`} title={meta.description}>
      <span className="learning-status-emoji" aria-hidden="true">{meta.emoji}</span>
      {meta.label}
    </span>
  )
}

export default function LearningStatusLegend() {
  return (
    <div className="learning-legend" aria-label="학습 상태 안내">
      {LEGEND_ORDER.map((status) => (
        <span key={status} className="legend-item">
          <LearningStatusBadge status={status} />
        </span>
      ))}
    </div>
  )
}
