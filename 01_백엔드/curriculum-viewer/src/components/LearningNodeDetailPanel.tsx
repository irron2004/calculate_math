import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NodeProgressV1 } from '../lib/studentLearning/types'
import { LearningStatusBadge } from './LearningStatusLegend'

type NodeMeta = {
  title: string
  text?: string | null
}

export default function LearningNodeDetailPanel(props: {
  nodeId: string
  meta: NodeMeta
  progress: NodeProgressV1
  prereqNodeIds: string[]
  prereqLabelByNodeId: Record<string, string>
}) {
  const navigate = useNavigate()
  const status = props.progress.status

  const missingPrereqs = useMemo(() => {
    return props.progress.lockedReasons?.missingPrereqNodeIds ?? []
  }, [props.progress.lockedReasons?.missingPrereqNodeIds])

  return (
    <div>
      <h2>{props.meta.title}</h2>
      <p className="muted mono">{props.nodeId}</p>

      <dl className="detail-dl">
        <dt>상태</dt>
        <dd>
          <LearningStatusBadge status={props.progress.status} />
        </dd>
        <dt>선행</dt>
        <dd>
          {props.prereqNodeIds.length === 0 ? (
            <span className="muted">없음</span>
          ) : (
            <ul className="node-links">
              {props.prereqNodeIds.map((id) => {
                const missing = missingPrereqs.includes(id)
                const label = props.prereqLabelByNodeId[id] ?? id
                return (
                  <li key={id} className={missing ? 'error' : ''}>
                    {label} <span className="muted mono">({id})</span>
                    {missing ? <span className="muted"> · 미해제</span> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </dd>
      </dl>

      {props.progress.status === 'LOCKED' && missingPrereqs.length > 0 ? (
        <p className="error" style={{ marginTop: 10 }}>
          잠김: 선행 노드를 먼저 클리어하세요.
        </p>
      ) : null}

      {props.meta.text ? (
        <div className="learn-description">
          <h3 style={{ margin: 0 }}>설명</h3>
          <p className="detail-text">{props.meta.text}</p>
        </div>
      ) : null}

      <div className="node-actions">
        {(status === 'AVAILABLE' || status === 'IN_PROGRESS') && (
          <button
            className="button button-primary"
            onClick={() => navigate(`/learn/${props.nodeId}`)}
          >
            {status === 'IN_PROGRESS' ? '계속하기' : '도전하기'}
          </button>
        )}
        {status === 'CLEARED' && (
          <button
            className="button button-ghost"
            onClick={() => navigate(`/learn/${props.nodeId}`)}
          >
            다시 풀기
          </button>
        )}
      </div>
    </div>
  )
}
