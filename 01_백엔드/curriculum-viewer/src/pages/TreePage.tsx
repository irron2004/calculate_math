import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth/AuthProvider'
import { fetchSkillLevels } from '../lib/skillLevels/api'
import { SKILL_LABELS, SKILL_DESCRIPTIONS, ALL_SKILL_IDS } from '../lib/diagnosis/skillLabels'

export default function TreePage() {
  const { user } = useAuth()
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetchSkillLevels()
      .then(setLevels)
      .catch(() => setError('스킬 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <section>
        <h1>스킬 트리</h1>
        <p className="muted">로그인이 필요합니다.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section>
        <h1>스킬 트리</h1>
        <p className="muted">로딩 중...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <h1>스킬 트리</h1>
        <p className="muted">{error} 다시 시도해보세요.</p>
      </section>
    )
  }

  return (
    <section>
      <h1>스킬 트리</h1>
      <p className="muted">학습을 통해 쌓인 내 스킬 현황이에요.</p>
      <div className="skill-tree-grid">
        {ALL_SKILL_IDS.map((skillId) => {
          const level = levels[skillId] ?? 0
          return (
            <div key={skillId} className="skill-tree-card">
              <div className="skill-tree-card-label">{SKILL_LABELS[skillId]}</div>
              <div className="skill-tree-card-desc">{SKILL_DESCRIPTIONS[skillId]}</div>
              <div className="skill-level-bar">
                {[1, 2, 3].map((seg) => (
                  <div
                    key={seg}
                    className={`skill-level-segment ${level >= seg ? 'filled' : 'empty'}`}
                  />
                ))}
              </div>
              <div className={`skill-tree-card-level-text ${level >= 3 ? 'mastered' : ''}`}>
                {level === 0 ? '미학습' : `레벨 ${level} / 3`}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
