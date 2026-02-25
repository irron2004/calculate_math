import type { ReactNode } from 'react'
import type { ResearchGraphViewMode } from './viewMode'

export function buildResearchNodeLabel(params: {
  mode: ResearchGraphViewMode
  nodeType: string
  depth: number
  label: string
  id: string
  proposed?: boolean
  description?: string
}): ReactNode {
  if (params.mode === 'overview') {
    return (
      <div className="research-node-label research-node-label--overview">
        <div className="research-node-title research-node-title--overview">{params.label}</div>
        {params.proposed ? <span className="badge badge-warn">proposed</span> : null}
      </div>
    )
  }

  return (
    <div className="research-node-label research-node-label--editor">
      <div className="mono research-node-meta">
        {params.nodeType}
        <span style={{ marginLeft: 6 }}>depth {params.depth}</span>
        {params.proposed ? (
          <span className="badge badge-warn" style={{ marginLeft: 6 }}>
            proposed
          </span>
        ) : null}
      </div>
      <div className="research-node-title">{params.label}</div>
      {params.description ? <div className="muted research-node-description">{params.description}</div> : null}
      <div className="mono research-node-id">{params.id}</div>
    </div>
  )
}
