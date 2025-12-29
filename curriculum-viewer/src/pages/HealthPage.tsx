import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { DetailPanelContext } from '../components/AppLayout'

export default function HealthPage() {
  const { setDetail } = useOutletContext<DetailPanelContext>()

  useEffect(() => {
    setDetail(
      <div>
        <h2>필터</h2>
        <p>검증 결과 필터/점프는 다음 단계에서 연결합니다.</p>
      </div>
    )
  }, [setDetail])

  return (
    <section>
      <h1>리포트</h1>
      <p>Placeholder</p>
    </section>
  )
}
