import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import NodeDetail from '../components/NodeDetail'
import type { DetailPanelContext } from '../components/AppLayout'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import type { CurriculumNode } from '../lib/curriculum/types'
import { useFocusNodeId } from '../lib/routing/useFocusNodeId'

function matchesQuery(node: CurriculumNode, query: string): boolean {
  if (node.id.toLowerCase().includes(query)) return true
  if (node.title.toLowerCase().includes(query)) return true
  if ((node.text ?? '').toLowerCase().includes(query)) return true
  return false
}

export default function ExplorerPage() {
  const { setDetail } = useOutletContext<DetailPanelContext>()
  const navigate = useNavigate()
  const { index, loading, error } = useCurriculum()
  const { focusNodeId, setFocusNodeId } = useFocusNodeId()

  const [searchQuery, setSearchQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const focusedNode = focusNodeId ? index?.nodeById.get(focusNodeId) : null

  useEffect(() => {
    if (focusNodeId) {
      setDetail(<NodeDetail nodeId={focusNodeId} />)
      return
    }

    setDetail(
      <div>
        <h2>상세</h2>
        <p>트리에서 노드를 선택하면 상세가 표시됩니다.</p>
      </div>
    )
  }, [focusNodeId, setDetail])

  useEffect(() => {
    if (!index || !focusedNode) return

    setExpanded((prev) => {
      const next = new Set(prev)
      let cursor: CurriculumNode | null = focusedNode
      const seen = new Set<string>()

      while (cursor && !seen.has(cursor.id)) {
        next.add(cursor.id)
        seen.add(cursor.id)
        cursor =
          typeof cursor.parent_id === 'string'
            ? index.nodeById.get(cursor.parent_id) ?? null
            : null
      }

      return next
    })
  }, [focusedNode, index])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!index || query.length === 0) return []

    const nodes = Array.from(index.nodeById.values()).filter((node) =>
      matchesQuery(node, query)
    )

    return nodes.slice(0, 50)
  }, [index, searchQuery])

  const toggleExpanded = (nodeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const renderNode = (node: CurriculumNode, depth: number) => {
    const children = index?.childrenById.get(node.id) ?? []
    const isExpanded = expanded.has(node.id)
    const isFocused = node.id === focusNodeId

    return (
      <li key={node.id}>
        <button
          type="button"
          className={`tree-node ${isFocused ? 'tree-node-active' : ''}`}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          onClick={() => {
            if (node.type === 'standard') {
              navigate(`/learn/${encodeURIComponent(node.id)}`)
              return
            }

            toggleExpanded(node.id)
            setFocusNodeId(node.id)
          }}
        >
          {children.length > 0 ? (
            <span aria-hidden="true" className="tree-caret">
              {isExpanded ? '▾' : '▸'}
            </span>
          ) : (
            <span aria-hidden="true" className="tree-caret-placeholder" />
          )}
          <span className="tree-title">{node.title}</span>
          <span className="tree-id">{node.id}</span>
        </button>
        {children.length > 0 && isExpanded ? (
          <ul className="tree-list">
            {children.map((child) => renderNode(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <section>
      <h1>트리</h1>

      <div className="tree-toolbar">
        <label className="tree-search">
          검색
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ID / Title / Text"
          />
        </label>
        {focusNodeId ? (
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setFocusNodeId(null, { replace: true })}
          >
            선택 해제
          </button>
        ) : null}
      </div>

      {loading ? <p>Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {searchResults.length > 0 ? (
        <div className="search-results">
          <h2>검색 결과</h2>
          <ul>
            {searchResults.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setFocusNodeId(node.id)}
                >
                  {node.title} <span className="muted">({node.id})</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {index ? (
        <ul className="tree-list tree-root">
          {index.rootNodes.map((node) => renderNode(node, 0))}
        </ul>
      ) : null}
    </section>
  )
}
