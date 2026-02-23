import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { DetailPanelContext } from '../components/AppLayout'
import CurriculumGraphView from '../components/CurriculumGraphView'
import LearningNodeDetailPanel from '../components/LearningNodeDetailPanel'
import LearningStatusLegend from '../components/LearningStatusLegend'
import NodeDetail from '../components/NodeDetail'
import { useAuth } from '../lib/auth/AuthProvider'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import type { GraphLayoutDirection } from '../lib/curriculum/graphLayout'
import type { CurriculumNode } from '../lib/curriculum/types'
import { getGraphVisibleNodes } from '../lib/curriculum/graphView'
import { createBrowserSessionRepository } from '../lib/repository/sessionRepository'
import { useFocusNodeId } from '../lib/routing/useFocusNodeId'
import { loadLearningGraphV1 } from '../lib/studentLearning/graph'
import { computeNodeProgressV1 } from '../lib/studentLearning/progress'
import type { LearningGraphV1, NodeProgressV1 } from '../lib/studentLearning/types'

const GRAPH_FITVIEW_PADDING = 0.15

export default function GraphPage() {
  const { setDetail } = useOutletContext<DetailPanelContext>()
  const { data, loading, error } = useCurriculum()
  const { focusNodeId, setFocusNodeId } = useFocusNodeId()
  const [direction, setDirection] = useState<GraphLayoutDirection>('TB')
  const { user } = useAuth()

  const [learningGraph, setLearningGraph] = useState<LearningGraphV1 | null>(null)
  const [progressByNodeId, setProgressByNodeId] = useState<Record<string, NodeProgressV1> | null>(
    null
  )

  // 학습 그래프 로딩
  useEffect(() => {
    const controller = new AbortController()
    loadLearningGraphV1(controller.signal)
      .then((graph) => setLearningGraph(graph))
      .catch(() => {
        // 학습 그래프 로딩 실패 시 무시 (선택적 기능)
      })
    return () => controller.abort()
  }, [])

  // 노드 진행 상태 계산
  useEffect(() => {
    if (!learningGraph || !user) {
      setProgressByNodeId(null)
      return
    }

    const repo = createBrowserSessionRepository()
    if (!repo) {
      setProgressByNodeId(null)
      return
    }

    const store = repo.readStore(user.id)
    const progress = computeNodeProgressV1({ graph: learningGraph, store })
    setProgressByNodeId(progress)
  }, [learningGraph, user])

  const visibleNodeCount = useMemo(() => {
    if (!data) return 0
    return getGraphVisibleNodes(data.nodes).length
  }, [data])

  const nodeById = useMemo(() => {
    if (!data) return new Map<string, CurriculumNode>()
    return new Map(data.nodes.map((node) => [node.id, node]))
  }, [data])

  const prereqByNodeId = useMemo(() => {
    if (!learningGraph) return new Map<string, string[]>()
    const map = new Map<string, string[]>()
    for (const edge of learningGraph.edges) {
      if (edge.type !== 'requires') continue
      const list = map.get(edge.targetId) ?? []
      list.push(edge.sourceId)
      map.set(edge.targetId, list)
    }
    return map
  }, [learningGraph])

  const prereqLabelByNodeId = useMemo(() => {
    const result: Record<string, string> = {}
    for (const node of nodeById.values()) {
      result[node.id] = node.title
    }
    return result
  }, [nodeById])

  useEffect(() => {
    if (!focusNodeId) {
      setDetail(
        <div>
          <h2>노드 상세</h2>
          <p className="muted">지도의 노드를 클릭하세요.</p>
        </div>
      )
      return
    }

    // 학습 노드면 LearningNodeDetailPanel 사용
    const progress = progressByNodeId?.[focusNodeId]
    if (progress) {
      const node = nodeById.get(focusNodeId)
      const meta = {
        title: node?.title ?? focusNodeId,
        text: node?.text ?? null
      }
      const prereqNodeIds = prereqByNodeId.get(focusNodeId) ?? []
      setDetail(
        <LearningNodeDetailPanel
          nodeId={focusNodeId}
          meta={meta}
          progress={progress}
          prereqNodeIds={prereqNodeIds}
          prereqLabelByNodeId={prereqLabelByNodeId}
        />
      )
      return
    }

    // 기본: NodeDetail 사용
    setDetail(<NodeDetail nodeId={focusNodeId} />)
  }, [focusNodeId, setDetail, progressByNodeId, nodeById, prereqByNodeId, prereqLabelByNodeId])

  return (
    <section>
      <h1>지도</h1>

      <div className="graph-toolbar">
        <div className="graph-control">
          Layout
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value as GraphLayoutDirection)}
          >
            <option value="TB">Top - Bottom</option>
            <option value="LR">Left - Right</option>
          </select>
        </div>
        <div className="graph-meta">
          {visibleNodeCount > 0 ? `${visibleNodeCount} nodes` : 'Loading…'}
        </div>
      </div>

      <div className="graph-legend" style={{ marginBottom: 12 }}>
        <span className="legend-item">
          <span className="legend-inline contains" /> contains
        </span>
        <span className="legend-item">
          <span className="legend-inline progression" /> progression
        </span>
        <span style={{ marginLeft: 16 }}>|</span>
        <LearningStatusLegend />
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}

      <div className="graph-canvas">
        <CurriculumGraphView
          nodes={data?.nodes ?? null}
          focusNodeId={focusNodeId}
          onNodeClick={(nodeId) => setFocusNodeId(nodeId)}
          direction={direction}
          fitViewPadding={GRAPH_FITVIEW_PADDING}
          progressByNodeId={progressByNodeId}
        />
      </div>
    </section>
  )
}
