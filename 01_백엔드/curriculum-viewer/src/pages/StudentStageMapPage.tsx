import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import { createBrowserSessionRepository } from '../lib/repository/sessionRepository'
import {
  buildStudentStageMapModel,
  type LargeCategoryId,
  type StageNodeViewModel
} from '../lib/studentMap/stageMap'
import { loadLearningGraphV1 } from '../lib/studentLearning/graph'
import { computeNodeProgressV1 } from '../lib/studentLearning/progress'
import type { AttemptSessionStoreV1, LearningGraphV1 } from '../lib/studentLearning/types'
import { ROUTES } from '../routes'
import { useAuth } from '../lib/auth/AuthProvider'
import { SKILL_LABELS } from '../lib/diagnosis/skillLabels'

const EMPTY_STORE: AttemptSessionStoreV1 = {
  version: 1,
  sessionsById: {},
  draftSessionIdByNodeId: {}
}

const CATEGORY_UNLOCK_STORAGE_KEY = 'student-map-unlocked-categories-v1'

function statusLabel(status: StageNodeViewModel['status']): string {
  if (status === 'CLEARED') return '완료'
  if (status === 'IN_PROGRESS') return '진행 중'
  if (status === 'AVAILABLE') return '도전 가능'
  return '잠김'
}

function statusIcon(status: StageNodeViewModel['status']): string {
  if (status === 'CLEARED') return '⭐'
  if (status === 'IN_PROGRESS') return '🔥'
  if (status === 'AVAILABLE') return '✨'
  return '🔒'
}

function buildMainPath(stages: StageNodeViewModel[]): string {
  if (stages.length === 0) return ''
  const points = stages.map((stage) => ({ x: stage.xPercent, y: stage.y }))
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const current = points[i]
    const midY = (prev.y + current.y) / 2
    path += ` Q ${prev.x} ${midY}, ${current.x} ${current.y}`
  }
  return path
}

function findAnchorStage(sideQuest: StageNodeViewModel, stages: StageNodeViewModel[]): StageNodeViewModel | null {
  if (stages.length === 0) return null
  let best = stages[0]
  let bestDistance = Math.abs(sideQuest.y - best.y)
  for (const stage of stages) {
    const distance = Math.abs(sideQuest.y - stage.y)
    if (distance < bestDistance) {
      best = stage
      bestDistance = distance
    }
  }
  return best
}

export default function StudentStageMapPage() {
  const { data, loading, error } = useCurriculum()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedCategoryQuery = searchParams.get('category')
  const selectedDomainQuery = searchParams.get('domain')
  const focusNodeId = searchParams.get('focusNodeId') ?? searchParams.get('focus')

  const [learningGraph, setLearningGraph] = useState<LearningGraphV1 | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [graphLoading, setGraphLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  const [selectedStage, setSelectedStage] = useState<StageNodeViewModel | null>(null)
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    const controller = new AbortController()
    setGraphLoading(true)
    setGraphError(null)
    loadLearningGraphV1(controller.signal)
      .then((graph) => {
        if (controller.signal.aborted) return
        setLearningGraph(graph)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setGraphError(err instanceof Error ? err.message : '학습 지도를 불러오지 못했습니다.')
        setLearningGraph(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setGraphLoading(false)
        }
      })
    return () => controller.abort()
  }, [reloadToken])

  const progressByNodeId = useMemo(() => {
    if (!learningGraph || !user) return {}
    const repo = createBrowserSessionRepository()
    if (!repo) {
      return computeNodeProgressV1({ graph: learningGraph, store: EMPTY_STORE })
    }
    const store = repo.readStore(user.id)
    return computeNodeProgressV1({ graph: learningGraph, store })
  }, [learningGraph, user])

  const model = useMemo(() => {
    if (!data || !learningGraph) return null
    return buildStudentStageMapModel({
      curriculumNodes: data.nodes,
      learningGraph,
      progressByNodeId,
      selectedCategoryId: selectedCategoryQuery as LargeCategoryId | null,
      selectedDomainId: selectedDomainQuery
    })
  }, [data, learningGraph, progressByNodeId, selectedCategoryQuery, selectedDomainQuery])

  const allVisibleStages = useMemo(() => {
    if (!model) return []
    return [...model.stages, ...model.sideQuests]
  }, [model])

  const titleById = useMemo(() => {
    const map = new Map<string, string>()
    if (!data) return map
    for (const node of data.nodes) {
      map.set(node.id, node.title)
    }
    return map
  }, [data])

  useEffect(() => {
    if (!model) return
    const preferredId =
      (focusNodeId && allVisibleStages.some((node) => node.nodeId === focusNodeId) ? focusNodeId : null) ??
      model.nextActions[0]?.nodeId ??
      model.stages[0]?.nodeId ??
      null
    if (!preferredId) return
    const target = buttonRefs.current[preferredId]
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [model, allVisibleStages, focusNodeId])

  useEffect(() => {
    if (!model || !user) return
    const storageKey = `${CATEGORY_UNLOCK_STORAGE_KEY}:${user.username}`
    const raw = window.localStorage.getItem(storageKey)
    let seen = new Set<string>()
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          seen = new Set(parsed.filter((value): value is string => typeof value === 'string'))
        }
      } catch {
        seen = new Set<string>()
      }
    }

    const unlocked = model.categories.filter((category) => category.unlocked)
    const newlyUnlocked = unlocked.filter((category) => !seen.has(category.id))

    if (newlyUnlocked.length > 0) {
      const latest = newlyUnlocked[0]
      setUnlockMessage(`${latest.label}이 열렸습니다!`)
    }

    for (const category of unlocked) {
      seen.add(category.id)
    }
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(seen)))
  }, [model, user])

  if (loading || graphLoading) {
    return (
      <section>
        <h1>나의 수학 여정</h1>
        <p className="muted">지도를 불러오는 중...</p>
      </section>
    )
  }

  if (error || graphError || !model) {
    return (
      <section>
        <h1>나의 수학 여정</h1>
        <p className="muted">지도를 불러오지 못했어요.</p>
        <p className="error">{error ?? graphError ?? '알 수 없는 오류'}</p>
        <button type="button" className="button button-primary" onClick={() => setReloadToken((v) => v + 1)}>
          다시 시도
        </button>
      </section>
    )
  }

  const selectedDomain = model.domains.find((domain) => domain.id === model.selectedDomainId) ?? model.domains[0]
  const canvasHeight = Math.max(420, ...allVisibleStages.map((stage) => stage.y + 120))
  const pathD = buildMainPath(model.stages)

  return (
    <section className="student-stage-map-page">
      <header className="student-stage-map-header">
        <h1>나의 수학 여정</h1>
        <div className="student-category-chips" role="tablist" aria-label="큰 분류 선택">
          {model.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={
                category.id === model.selectedCategoryId
                  ? 'student-category-chip student-category-chip--active'
                  : 'student-category-chip'
              }
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.set('category', category.id)
                next.delete('domain')
                setSearchParams(next)
              }}
            >
              {category.label}
            </button>
          ))}
        </div>
        <div className="student-domain-chips" role="tablist" aria-label="도메인 선택">
          {model.domains.map((domain) => (
            <button
              key={domain.id}
              type="button"
              className={
                domain.id === model.selectedDomainId
                  ? 'student-domain-chip student-domain-chip--active'
                  : 'student-domain-chip'
              }
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.set('category', model.selectedCategoryId)
                next.set('domain', domain.id)
                setSearchParams(next)
              }}
            >
              {domain.label}
            </button>
          ))}
        </div>
        <p className="muted">
          이번 영역 진행률 {selectedDomain?.clearedCount ?? 0}/{selectedDomain?.totalCount ?? 0}
        </p>
        {unlockMessage ? <p className="student-category-unlock-banner">{unlockMessage}</p> : null}
      </header>

      <section className="student-next-actions" aria-label="지금 할 것">
        <div className="student-next-actions-header">
          <h2>지금 할 것 ✨</h2>
        </div>
        <div className="student-next-actions-grid">
          {model.nextActions.map((action) => (
            <article key={action.nodeId} className="student-next-action-card">
              <p className="student-next-action-title">{action.title}</p>
              <p className="muted">{statusLabel(action.status)} · {action.subtitle}</p>
              <button
                type="button"
                className="button button-primary"
                onClick={() => navigate(`${ROUTES.learn}/${encodeURIComponent(action.nodeId)}`)}
              >
                {action.ctaLabel}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="student-stage-map-canvas" aria-label="학습 지도">
        <div className="student-stage-map-inner" style={{ height: canvasHeight }}>
          <svg className="student-stage-map-svg" viewBox={`0 0 100 ${canvasHeight}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="mapPathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="50%" stopColor="#9b7dc8" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            {pathD ? <path d={pathD} className="student-stage-map-main-path" /> : null}
            {model.sideQuests.map((node) => {
              const anchor = findAnchorStage(node, model.stages)
              if (!anchor) return null
              return (
                <line
                  key={`line-${node.nodeId}`}
                  x1={anchor.xPercent}
                  y1={anchor.y}
                  x2={node.xPercent}
                  y2={node.y}
                  className="student-stage-map-side-line"
                />
              )
            })}
          </svg>

          {allVisibleStages.map((node) => {
            const className = [
              'student-stage-bubble',
              `status-${node.status.toLowerCase()}`,
              node.isSideQuest ? 'is-side' : '',
              node.isRecommended ? 'is-recommended' : ''
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={node.nodeId}
                ref={(el) => {
                  buttonRefs.current[node.nodeId] = el
                }}
                type="button"
                className={className}
                style={{ left: `${node.xPercent}%`, top: `${node.y}px` }}
                onClick={() => setSelectedStage(node)}
                aria-label={`${node.title} ${statusLabel(node.status)}`}
              >
                <span className="student-stage-bubble-icon" aria-hidden="true">
                  {statusIcon(node.status)}
                </span>
                <span className="student-stage-bubble-title">{node.title}</span>
                <span className="student-stage-bubble-status">
                  {node.isSideQuest ? '도전' : statusLabel(node.status)}
                </span>
              </button>
            )
          })}

          {model.hiddenFutureCount > 0 ? (
            <div className="student-stage-hidden-future">앞으로 {model.hiddenFutureCount}개 스테이지가 더 열려요</div>
          ) : null}
        </div>
      </section>

      {selectedStage ? (
        <div className="student-stage-sheet-backdrop" onClick={() => setSelectedStage(null)}>
          <div className="student-stage-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedStage.title}</h3>
            <p className="muted">{statusLabel(selectedStage.status)}</p>
            {(() => {
              const requiredSkillIds = learningGraph?.edges
                .filter((e) => e.type === 'requires_skill' && e.targetId === selectedStage.nodeId)
                .map((e) => e.sourceId) ?? []
              const taughtSkillIds = learningGraph?.edges
                .filter((e) => e.type === 'teaches' && e.sourceId === selectedStage.nodeId)
                .map((e) => e.targetId) ?? []
              return (
                <>
                  {requiredSkillIds.length > 0 && (
                    <div className="stage-sheet-teaches">
                      <p className="muted stage-sheet-teaches-label">필요한 스킬</p>
                      <div className="stage-sheet-teaches-chips">
                        {requiredSkillIds.map((skillId) => (
                          <span key={skillId} className="skill-chip">
                            {SKILL_LABELS[skillId] ?? skillId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {taughtSkillIds.length > 0 && (
                    <div className="stage-sheet-teaches">
                      <p className="muted stage-sheet-teaches-label">배울 수 있는 스킬</p>
                      <div className="stage-sheet-teaches-chips">
                        {taughtSkillIds.map((skillId) => (
                          <span key={skillId} className="skill-chip">
                            {SKILL_LABELS[skillId] ?? skillId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
            {selectedStage.status === 'LOCKED' ? (
              <p className="muted">
                먼저 {titleById.get(selectedStage.missingPrereqNodeIds[0] ?? '') ?? '이전 스테이지'}부터 해보자!
              </p>
            ) : null}
            <div className="student-stage-sheet-actions">
              {selectedStage.status === 'AVAILABLE' || selectedStage.status === 'IN_PROGRESS' ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => navigate(`${ROUTES.learn}/${encodeURIComponent(selectedStage.nodeId)}`)}
                >
                  {selectedStage.status === 'IN_PROGRESS' ? '계속하기' : '시작하기'}
                </button>
              ) : null}
              {selectedStage.status === 'CLEARED' ? (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => navigate(`${ROUTES.learn}/${encodeURIComponent(selectedStage.nodeId)}`)}
                >
                  다시 풀기
                </button>
              ) : null}
              <button type="button" className="button button-ghost" onClick={() => setSelectedStage(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
