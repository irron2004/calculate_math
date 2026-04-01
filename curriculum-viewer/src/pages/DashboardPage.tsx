import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import { fetchRecommendations } from '../lib/recommendations/api'
import type { RecommendationItem } from '../lib/recommendations/types'
import { createBrowserSessionRepository } from '../lib/repository/sessionRepository'
import { fetchSkillLevels } from '../lib/skillLevels/api'
import { SKILL_LABELS } from '../lib/diagnosis/skillLabels'
import { ROUTES } from '../routes'

type WrongNode = {
  nodeId: string
  title: string
  wrongCount: number
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const { data } = useCurriculum()
  const navigate = useNavigate()

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [recLoading, setRecLoading] = useState(false)
  const [skillLevels, setSkillLevels] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    setRecLoading(true)
    fetchRecommendations(controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setRecommendations(res.items)
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecLoading(false)
      })
    return () => controller.abort()
  }, [user])

  useEffect(() => {
    if (!user) return
    fetchSkillLevels().then(setSkillLevels).catch(() => {})
  }, [user])

  const titleById = useMemo(() => {
    const map = new Map<string, string>()
    if (!data) return map
    for (const node of data.nodes) map.set(node.id, node.title)
    return map
  }, [data])

  const recentWrongNodes = useMemo((): WrongNode[] => {
    if (!user) return []
    const repo = createBrowserSessionRepository()
    if (!repo) return []
    const store = repo.readStore(user.id)
    const wrongByNode = new Map<string, number>()
    for (const session of Object.values(store.sessionsById)) {
      if (session.status !== 'SUBMITTED' || !session.grading) continue
      const wrongCount = session.grading.totalCount - session.grading.correctCount
      if (wrongCount > 0) {
        wrongByNode.set(session.nodeId, (wrongByNode.get(session.nodeId) ?? 0) + wrongCount)
      }
    }
    return Array.from(wrongByNode.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nodeId, wrongCount]) => ({
        nodeId,
        title: titleById.get(nodeId) ?? nodeId,
        wrongCount
      }))
  }, [user, titleById])

  const learnedSkills = useMemo(() =>
    Object.entries(skillLevels)
      .filter(([, lvl]) => lvl > 0)
      .map(([skillId, level]) => ({ skillId, label: SKILL_LABELS[skillId] ?? skillId, level })),
    [skillLevels]
  )

  if (isAdmin) {
    return (
      <section>
        <h1>관리자 대시보드</h1>
        <p className="muted">학생 관리 및 커리큘럼 설정은 관리자 모드에서 이용하세요.</p>
      </section>
    )
  }

  return (
    <section className="dashboard-page">
      <header className="dashboard-header">
        <h1>{user?.name ?? user?.username}님, 안녕하세요! 👋</h1>
        <p className="muted">오늘도 수학 실력을 키워봐요</p>
      </header>

      {learnedSkills.length > 0 && (
        <div className="skill-summary-section">
          <p className="skill-summary-title">내 스킬 현황</p>
          <div className="skill-chips">
            {learnedSkills.map(({ skillId, label, level }) => (
              <span key={skillId} className="skill-chip">
                <span className="skill-chip-label">{label}</span>
                <span className="skill-chip-dots">
                  {'●'.repeat(level)}{'○'.repeat(3 - level)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <section className="dashboard-section" aria-label="오늘의 추천">
        <h2>지금 이거 해봐! ✨</h2>
        {recLoading ? (
          <p className="muted">추천을 불러오는 중...</p>
        ) : recommendations.length === 0 ? (
          <div className="dashboard-empty-card">
            <p className="muted">문제를 풀면 맞춤 추천이 생겨요.</p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate(ROUTES.map)}
            >
              스킬 트리 보기
            </button>
          </div>
        ) : (
          <div className="dashboard-rec-list">
            {recommendations.map((item) => (
              <article key={item.nodeId} className="dashboard-rec-card">
                <p className="dashboard-rec-title">
                  {titleById.get(item.nodeId) ?? item.nodeId}
                </p>
                <p className="muted dashboard-rec-reason">→ {item.reason}</p>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() =>
                    navigate(`${ROUTES.learn}/${encodeURIComponent(item.nodeId)}`)
                  }
                >
                  시작하기
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {recentWrongNodes.length > 0 ? (
        <section className="dashboard-section" aria-label="오답 복습">
          <h2>다시 도전해봐! 🔥</h2>
          <div className="dashboard-wrong-list">
            {recentWrongNodes.map((node) => (
              <button
                key={node.nodeId}
                type="button"
                className="dashboard-wrong-item"
                onClick={() =>
                  navigate(`${ROUTES.learn}/${encodeURIComponent(node.nodeId)}`)
                }
              >
                <span className="dashboard-wrong-title">{node.title}</span>
                <span className="muted dashboard-wrong-count">
                  틀린 문제 {node.wrongCount}개
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  )
}
