import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { formatTagKo } from '../lib/diagnostic/tags'
import { ROUTES } from '../routes'

type StudyStyle = 'short' | 'long'

type SurveyDraft = {
  grade: string
  confidence: number | null
  recentHardTags: string[]
  studyStyle: StudyStyle | null
}

const SURVEY_STORAGE_KEY = 'onboarding:survey:v1'

const CONFIDENCE_OPTIONS: Array<{ value: number; label: string; emoji: string }> = [
  { value: 1, label: '어려워요', emoji: '😟' },
  { value: 2, label: '조금 어려워요', emoji: '😕' },
  { value: 3, label: '보통이에요', emoji: '🙂' },
  { value: 4, label: '잘 하는 편이에요', emoji: '😄' },
  { value: 5, label: '아주 자신 있어요', emoji: '😎' }
]

const RECENT_HARD_TAGS = [
  'place_value',
  'add_carry',
  'sub_borrow',
  'multiply_basic',
  'divide_basic',
  'fraction_basic',
  'word_problem',
  'pattern',
  'geometry_perimeter'
]

function safeSessionStorageSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export default function OnboardingSurveyPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const defaultGrade = useMemo(() => {
    const raw = (user?.grade ?? '3').trim()
    return /^[1-6]$/.test(raw) ? raw : '3'
  }, [user?.grade])

  const [grade, setGrade] = useState(defaultGrade)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [recentHardTags, setRecentHardTags] = useState<Set<string>>(new Set())
  const [studyStyle, setStudyStyle] = useState<StudyStyle | null>(null)

  if (isAdmin) {
    return (
      <section className="onboarding">
        <h1>진단</h1>
        <p className="muted">학생 전용 기능입니다.</p>
        <div className="node-actions" style={{ marginTop: 16 }}>
          <Link to={ROUTES.dashboard} className="button button-ghost">
            홈으로
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="onboarding">
      <h1>맞춤 숙제 시작</h1>
      <p className="muted">1분 설문 + 3~5분 진단으로 시작점을 잡아요.</p>

      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()

          const payload: SurveyDraft = {
            grade: grade.trim(),
            confidence,
            recentHardTags: Array.from(recentHardTags),
            studyStyle
          }

          safeSessionStorageSet(SURVEY_STORAGE_KEY, JSON.stringify(payload))
          navigate(ROUTES.placement)
        }}
      >
        <label className="form-field">
          학년 (필수)
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="1">초1</option>
            <option value="2">초2</option>
            <option value="3">초3</option>
            <option value="4">초4</option>
            <option value="5">초5</option>
            <option value="6">초6</option>
          </select>
        </label>

        <div className="onboarding-field">
          <div className="onboarding-label">수학 자신감 (선택)</div>
          <div className="onboarding-choice-row">
            {CONFIDENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`choice-pill ${confidence === option.value ? 'active' : ''}`}
                onClick={() => setConfidence(option.value)}
              >
                <span className="choice-emoji" aria-hidden="true">
                  {option.emoji}
                </span>
                {option.label}
              </button>
            ))}
            <button
              type="button"
              className={`choice-pill ${confidence === null ? 'active' : ''}`}
              onClick={() => setConfidence(null)}
            >
              모르겠어요
            </button>
          </div>
        </div>

        <div className="onboarding-field">
          <div className="onboarding-label">최근 어려웠던 것 (선택)</div>
          <div className="onboarding-chip-grid">
            {RECENT_HARD_TAGS.map((tag) => {
              const checked = recentHardTags.has(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  className={`tag-toggle ${checked ? 'active' : ''}`}
                  onClick={() => {
                    setRecentHardTags((prev) => {
                      const next = new Set(prev)
                      if (next.has(tag)) next.delete(tag)
                      else next.add(tag)
                      return next
                    })
                  }}
                >
                  {formatTagKo(tag)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="onboarding-field">
          <div className="onboarding-label">공부 성향 (선택)</div>
          <div className="onboarding-choice-row">
            <button
              type="button"
              className={`choice-pill ${studyStyle === 'short' ? 'active' : ''}`}
              onClick={() => setStudyStyle('short')}
            >
              짧게 자주
            </button>
            <button
              type="button"
              className={`choice-pill ${studyStyle === 'long' ? 'active' : ''}`}
              onClick={() => setStudyStyle('long')}
            >
              길게 한번
            </button>
            <button
              type="button"
              className={`choice-pill ${studyStyle === null ? 'active' : ''}`}
              onClick={() => setStudyStyle(null)}
            >
              상관없어요
            </button>
          </div>
        </div>

        <div className="node-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button-primary">
            진단 시작하기
          </button>
          <Link to={ROUTES.dashboard} className="button button-ghost">
            나중에
          </Link>
        </div>
      </form>
    </section>
  )
}

