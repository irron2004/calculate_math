import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { formatTagKo } from '../lib/diagnostic/tags'
import { getMyStudentProfile } from '../lib/studentProfile/api'
import type { StudentProfile } from '../lib/studentProfile/types'
import { ROUTES } from '../routes'

function getLevelLabel(level: string): string {
  const match = /^E(\d+)-(\d+)$/.exec(level.trim())
  if (!match) return level
  const grade = match[1]
  const band = match[2]
  const bandLabel = band === '3' ? '상' : band === '2' ? '중' : '하'
  return `초${grade} (${bandLabel})`
}

export default function PlacementResultPage() {
  const { isAdmin } = useAuth()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    getMyStudentProfile(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setProfile(data)
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '프로필을 불러올 수 없습니다.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [isAdmin])

  const topMessage = useMemo(() => {
    if (!profile) return null
    const mainTag = profile.weakTagsTop3?.[0]
    if (!mainTag) return '이제 맞춤 숙제를 시작해볼까요?'
    return `먼저 "${formatTagKo(mainTag)}"부터 차근차근!`
  }, [profile])

  if (isAdmin) {
    return (
      <section>
        <h1>진단 결과</h1>
        <p className="muted">학생 전용 기능입니다.</p>
        <div className="node-actions" style={{ marginTop: 16 }}>
          <Link to={ROUTES.dashboard} className="button button-ghost">
            홈으로
          </Link>
        </div>
      </section>
    )
  }

  if (loading) {
    return (
      <section>
        <h1>진단 결과</h1>
        <p className="muted">불러오는 중...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <h1>진단 결과</h1>
        <p className="error">{error}</p>
        <div className="node-actions" style={{ marginTop: 16 }}>
          <Link to={ROUTES.onboarding} className="button button-primary">
            다시 진단하기
          </Link>
          <Link to={ROUTES.dashboard} className="button button-ghost">
            홈으로
          </Link>
        </div>
      </section>
    )
  }

  if (!profile) {
    return (
      <section>
        <h1>진단 결과</h1>
        <p className="muted">아직 진단 결과가 없어요.</p>
        <div className="node-actions" style={{ marginTop: 16 }}>
          <Link to={ROUTES.onboarding} className="button button-primary">
            진단 시작하기
          </Link>
          <Link to={ROUTES.dashboard} className="button button-ghost">
            홈으로
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="placement-result">
      <h1>시작점이 정해졌어요!</h1>
      <p className="muted">{topMessage}</p>

      <div className="dashboard-mission-card" style={{ marginTop: 16 }}>
        <div className="dashboard-mission-meta">
          <div className="dashboard-mission-title">내 레벨</div>
          <div className="muted">{getLevelLabel(profile.estimatedLevel)}</div>
        </div>
        <div className="dashboard-mission-actions">
          <Link to={ROUTES.dashboard} className="button button-primary">
            오늘 숙제 시작
          </Link>
          <Link to={ROUTES.mypage} className="button button-ghost">
            숙제함
          </Link>
        </div>
      </div>

      {profile.weakTagsTop3.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>약점 태그</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {profile.weakTagsTop3.map((tag) => (
              <span key={tag} className="tag-chip">
                {formatTagKo(tag)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

