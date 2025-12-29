import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { DetailPanelContext } from '../components/AppLayout'

export default function ExplorerPage() {
  const { setDetail } = useOutletContext<DetailPanelContext>()

  useEffect(() => {
    setDetail(
      <div>
        <h2>상세</h2>
        <p>트리/그래프에서 노드를 선택하면 여기에 표시됩니다.</p>
      </div>
    )
  }, [setDetail])

  return (
    <section>
      <h1>트리</h1>
      <p>Placeholder</p>
    </section>
  )
}
