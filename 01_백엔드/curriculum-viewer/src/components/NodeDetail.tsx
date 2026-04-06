import { useMemo } from 'react'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import type { CurriculumNode } from '../lib/curriculum/types'
import { useFocusNodeId } from '../lib/routing/useFocusNodeId'

type NodeRefProps = {
  node: CurriculumNode
  onSelect: (nodeId: string) => void
}

function NodeRef({ node, onSelect }: NodeRefProps) {
  return (
    <button
      type="button"
      className="link-button"
      onClick={() => onSelect(node.id)}
    >
      {node.title} <span className="muted">({node.id})</span>
    </button>
  )
}

type Props = {
  nodeId: string
}

export default function NodeDetail({ nodeId }: Props) {
  const { index } = useCurriculum()
  const { setFocusNodeId } = useFocusNodeId()

  const node = index?.nodeById.get(nodeId)

  const breadcrumb = useMemo(() => {
    if (!index || !node) return []

    const path: CurriculumNode[] = []
    const seen = new Set<string>()
    let cursor: CurriculumNode | null | undefined = node

    while (cursor && !seen.has(cursor.id)) {
      path.push(cursor)
      seen.add(cursor.id)
      cursor =
        typeof cursor.parent_id === 'string'
          ? index.nodeById.get(cursor.parent_id)
          : null
    }

    return path.reverse()
  }, [index, node])

  if (!index || !node) {
    return (
      <div>
        <h2>노드 상세</h2>
        <p>선택된 노드를 찾지 못했습니다.</p>
      </div>
    )
  }

  const parent =
    typeof node.parent_id === 'string'
      ? index.nodeById.get(node.parent_id) ?? null
      : null

  const children = index.childrenById.get(node.id) ?? []

  return (
    <div className="node-detail">
      <h2>노드 상세</h2>

      {breadcrumb.length > 0 ? (
        <>
          <h3>Breadcrumb</h3>
          <ol className="breadcrumb">
            {breadcrumb.map((entry) => (
              <li key={entry.id}>
                <NodeRef node={entry} onSelect={setFocusNodeId} />
              </li>
            ))}
          </ol>
        </>
      ) : null}

      <dl className="detail-dl">
        <dt>ID</dt>
        <dd>{node.id}</dd>
        <dt>Type</dt>
        <dd>{node.type}</dd>
        <dt>Title</dt>
        <dd>{node.title}</dd>
        {node.subject ? (
          <>
            <dt>Subject</dt>
            <dd>{node.subject}</dd>
          </>
        ) : null}
        {typeof node.grade === 'number' ? (
          <>
            <dt>Grade</dt>
            <dd>{node.grade}</dd>
          </>
        ) : null}
        {node.domain ? (
          <>
            <dt>Domain</dt>
            <dd>{node.domain}</dd>
          </>
        ) : null}
        {node.domain_code ? (
          <>
            <dt>Domain Code</dt>
            <dd>{node.domain_code}</dd>
          </>
        ) : null}
        {node.official_code ? (
          <>
            <dt>Official Code</dt>
            <dd>{node.official_code}</dd>
          </>
        ) : null}
      </dl>

      {node.text ? (
        <>
          <h3>Text</h3>
          <p className="detail-text">{node.text}</p>
        </>
      ) : null}

      {parent ? (
        <>
          <h3>Parent</h3>
          <NodeRef node={parent} onSelect={setFocusNodeId} />
        </>
      ) : null}

      {children.length > 0 ? (
        <>
          <h3>Children</h3>
          <ul className="node-links">
            {children.map((child) => (
              <li key={child.id}>
                <NodeRef node={child} onSelect={setFocusNodeId} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {node.type === 'standard' ? (
        <div className="node-actions">
          <p className="muted">학습/평가 기능은 v2 범위입니다.</p>
        </div>
      ) : null}
    </div>
  )
}
