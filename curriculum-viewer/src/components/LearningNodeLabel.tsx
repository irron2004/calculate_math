import type { NodeStatus } from '../lib/studentLearning/types'
import { LearningStatusBadge } from './LearningStatusLegend'

export default function LearningNodeLabel(props: {
  title: string
  nodeId: string
  status: NodeStatus
}) {
  return (
    <div className="learning-node-label" data-status={props.status}>
      <div className="learning-node-row">
        <div className="learning-node-title">{props.title}</div>
        <LearningStatusBadge status={props.status} />
      </div>
      <div className="graph-node-id">{props.nodeId}</div>
    </div>
  )
}

