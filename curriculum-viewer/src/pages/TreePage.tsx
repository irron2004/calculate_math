import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth/AuthProvider'
import { fetchSkillLevels } from '../lib/skillLevels/api'

const SKILL_LABELS: Record<string, string> = {
  'AS.NUMBER_SENSE': '수 세기와 수의 크기 비교',
  'AS.PLACE_VALUE': '자릿값 이해',
  'AS.ADD_SUB': '덧셈과 뺄셈',
  'AS.MUL_DIV': '곱셈과 나눗셈',
  'AS.FRAC_BASIC': '분수 개념',
  'AS.DECIMAL': '소수 개념',
  'AS.RATIO': '비율과 비례',
}

const SKILL_DESCRIPTIONS: Record<string, string> = {
  'AS.NUMBER_SENSE': '수를 세고 크기를 비교하는 능력',
  'AS.PLACE_VALUE': '자릿값을 이해하고 수를 분해하는 능력',
  'AS.ADD_SUB': '덧셈과 뺄셈으로 수를 계산하는 능력',
  'AS.MUL_DIV': '곱셈과 나눗셈으로 수를 계산하는 능력',
  'AS.FRAC_BASIC': '분수의 개념을 이해하고 크기를 비교하는 능력',
  'AS.DECIMAL': '소수의 개념과 자릿값을 이해하는 능력',
  'AS.RATIO': '비율과 비례 관계를 이해하는 능력',
}

const ALL_SKILL_IDS = Object.keys(SKILL_LABELS)

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
