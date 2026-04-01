import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EvalResultList from '../components/EvalResultList'
import { useAuth } from '../lib/auth/AuthProvider'
import { loadLearningGraphV1 } from '../lib/studentLearning/graph'
import { recommendNextNodeIds } from '../lib/studentLearning/progress'
import type { LearningGraphV1 } from '../lib/studentLearning/types'
import { createBrowserSessionRepository } from '../lib/repository/sessionRepository'
import { ROUTES } from '../routes'
import { loadProblemBank } from '../lib/learn/problems'
import type { Problem } from '../lib/learn/problems'
import { saveDiagnosis } from '../lib/diagnosis/api'
import { CALC_MISTAKE } from '../lib/diagnosis/types'
import type { DiagnosisChoice } from '../lib/diagnosis/types'
import { fetchSkillLevels } from '../lib/skillLevels/api'
import { SKILL_LABELS } from '../lib/diagnosis/skillLabels'

export default function EvalPage() {
  const params = useParams()
  const sessionId = params.sessionId ? decodeURIComponent(params.sessionId) : null
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? null

  const label = useMemo(() => {
    if (!sessionId) return null
    return sessionId.length > 60 ? `${sessionId.slice(0, 60)}…` : sessionId
  }, [sessionId])

  const [learningGraph, setLearningGraph] = useState<LearningGraphV1 | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [problems, setProblems] = useState<Record<string, Problem[]>>({})
  const [diagnosisDone, setDiagnosisDone] = useState(false)
  const [diagnosisLoading, setDiagnosisLoading] = useState(false)
  const [clearedSkillLevels, setClearedSkillLevels] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function run() {
      setGraphError(null)
      try {
        const loaded = await loadLearningGraphV1(controller.signal)
        setLearningGraph({ nodes: loaded.nodes, edges: loaded.edges })
      } catch (err) {
        if (controller.signal.aborted) return
        setGraphError(err instanceof Error ? err.message : String(err))
      }
    }

    run()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!grading?.cleared) return
    fetchSkillLevels()
      .then(setClearedSkillLevels)
      .catch(() => {})
  }, [grading?.cleared])

  useEffect(() => {
    const controller = new AbortController()
    loadProblemBank(controller.signal)
      .then((bank) => {
        if (!controller.signal.aborted) setProblems(bank.problemsByNodeId)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const storeAndSession = useMemo(() => {
    if (!sessionId || !userId) return { store: null, session: null }
    const repo = createBrowserSessionRepository()
    const store = repo ? repo.readStore(userId) : null
    if (!store) return { store: null, session: null }
    return { store, session: store.sessionsById[sessionId] ?? null }
  }, [sessionId, userId])

  const session = storeAndSession.session
  const store = storeAndSession.store

  const grading = session?.status === 'SUBMITTED' ? session.grading ?? null : null

  const nextNodeId = useMemo(() => {
    if (!grading?.cleared) return null
    if (!learningGraph || !store) return null
    const candidates = recommendNextNodeIds({ graph: learningGraph, store, maxCount: 1 })
    return candidates[0] ?? null
  }, [grading?.cleared, learningGraph, store])

  const asLabelById = useMemo(() => {
    const map = new Map<string, string>()
    if (!learningGraph) return map
    for (const node of learningGraph.nodes) {
      if (node.nodeType === 'atomic_skill' && node.label) {
        map.set(node.id, node.label)
      }
    }
    return map
  }, [learningGraph])

  const diagnosisOptions = useMemo((): DiagnosisChoice[] => {
    if (!grading || grading.cleared) return []
    if (!session?.nodeId) return []
    const nodeProblems = problems[session.nodeId] ?? []
    const skillIds = new Set<string>()
    for (const [problemId, result] of Object.entries(grading.perProblem)) {
      if (!result.isCorrect) {
        const problem = nodeProblems.find((p) => p.id === problemId)
        if (problem?.required_skills) {
          for (const sk of problem.required_skills) skillIds.add(sk)
        }
      }
    }
    return Array.from(skillIds).map((skillId) => ({
      skillId,
      label: asLabelById.get(skillId) ?? skillId
    }))
  }, [grading, session?.nodeId, problems, asLabelById])

  const taughtSkillIds = useMemo(() => {
    if (!learningGraph || !session?.nodeId) return []
    return learningGraph.edges
      .filter((e) => e.type === 'teaches' && e.sourceId === session.nodeId)
      .map((e) => e.targetId)
  }, [learningGraph, session?.nodeId])

  const handleDiagnosis = async (choice: DiagnosisChoice) => {
    if (!sessionId || diagnosisLoading) return
    setDiagnosisLoading(true)
    await saveDiagnosis(sessionId, choice)
    setDiagnosisDone(true)
    setDiagnosisLoading(false)
  }

  return (
    <section>
      <h1>평가</h1>
      {label ? <p className="muted">Session: {label}</p> : null}

      {!session ? <p className="error">세션을 찾을 수 없습니다.</p> : null}
      {graphError ? <p className="muted">그래프 로딩 실패: {graphError}</p> : null}

      {grading ? (
        <>
          <div className={`eval-result-banner ${grading.cleared ? 'eval-result-cleared' : 'eval-result-progress'}`}>
            <span className="eval-result-emoji">{grading.cleared ? '🎉' : '💪'}</span>
            <div className="eval-result-text">
              <p className="eval-result-main">
                {grading.cleared ? '축하해요! 완료했어요!' : '조금만 더 힘내요!'}
              </p>
              <p className="eval-result-detail">
                정답: {grading.correctCount} / {grading.totalCount} · 정답률: {Math.round(grading.accuracy * 100)}%
              </p>
            </div>
          </div>

          {grading.cleared && clearedSkillLevels !== null && taughtSkillIds.length > 0 && (
            <div className="skill-growth-section">
              <h3 className="skill-growth-title">🌟 스킬이 자랐어요!</h3>
              <div className="skill-growth-cards">
                {taughtSkillIds.map((skillId) => {
                  const level = clearedSkillLevels[skillId] ?? 0
                  return (
                    <div key={skillId} className="skill-card">
                      <div className="skill-card-label">
                        {SKILL_LABELS[skillId] ?? skillId}
                      </div>
                      <div className="skill-level-bar">
                        {[1, 2, 3].map((seg) => (
                          <div
                            key={seg}
                            className={`skill-level-segment ${level >= seg ? 'filled' : 'empty'}`}
                          />
                        ))}
                      </div>
                      <div className="skill-level-text">레벨 {level} / 3</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {grading.perTag && grading.perTag.length > 0 && (
            <div className="tag-accuracy-section">
              <h2>태그별 정답률</h2>
              <ul className="tag-accuracy-list">
                {grading.perTag.map((item) => (
                  <li key={item.tag} className="tag-accuracy-item">
                    <span className="tag-name">{item.tag}</span>
                    <span className="tag-stats">
                      {item.correctCount}/{item.totalCount} ({Math.round(item.accuracy * 100)}%)
                    </span>
                    <div className="tag-bar">
                      <div
                        className="tag-bar-fill"
                        style={{ width: `${Math.round(item.accuracy * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!grading.cleared && diagnosisOptions.length > 0 && !diagnosisDone ? (
            <div className="diagnosis-section">
              <h2 className="diagnosis-title">왜 틀렸을까요?</h2>
              <p className="muted diagnosis-subtitle">가장 가까운 이유를 골라보세요</p>
              <div className="diagnosis-options">
                {diagnosisOptions.map((opt) => (
                  <button
                    key={opt.skillId}
                    type="button"
                    className="diagnosis-option-btn"
                    onClick={() => handleDiagnosis(opt)}
                    disabled={diagnosisLoading}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="diagnosis-option-btn diagnosis-option-calc-mistake"
                  onClick={() => handleDiagnosis(CALC_MISTAKE)}
                  disabled={diagnosisLoading}
                >
                  {CALC_MISTAKE.label}
                </button>
              </div>
            </div>
          ) : !grading.cleared && diagnosisDone ? (
            <p className="diagnosis-done muted">기록했어요 👍</p>
          ) : null}

          <EvalResultList perProblem={grading.perProblem} responses={session?.responses ?? {}} />
        </>
      ) : session ? (
        <p className="muted">제출 전(DRAFT) 세션입니다.</p>
      ) : null}

      <div className="node-actions">
        {grading?.cleared ? (
          nextNodeId ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate(`${ROUTES.learn}/${encodeURIComponent(nextNodeId)}`)}
            >
              다음 노드
            </button>
          ) : (
            <Link to={ROUTES.map} className="button button-primary">
              지도
            </Link>
          )
        ) : session?.nodeId ? (
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate(`${ROUTES.learn}/${encodeURIComponent(session.nodeId)}`)}
          >
            재도전
          </button>
        ) : null}

        <Link to={ROUTES.map} className="button button-ghost">
          지도로 돌아가기
        </Link>
        <Link to={ROUTES.dashboard} className="button button-ghost">
          홈
        </Link>
      </div>
    </section>
  )
}
