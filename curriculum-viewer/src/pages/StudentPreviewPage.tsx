import { useMemo } from 'react'
import SkillGraphPreview from '../components/SkillGraphPreview'
import { useRepositories } from '../lib/repository/RepositoryProvider'

export default function StudentPreviewPage() {
  const { graphRepository } = useRepositories()
  const snapshot = useMemo(() => graphRepository.loadStudentGraph(), [graphRepository])

  return (
    <section>
      <h1>프리뷰</h1>
      <p className="muted">현재 런타임 세션의 Active Published를 렌더합니다.</p>

      {!snapshot ? (
        <p className="muted">Published가 없습니다. 관리자 모드에서 Publish를 수행하세요.</p>
      ) : (
        <>
          <p className="muted">
            <span className="mono">{snapshot.graphId}</span> · {snapshot.graph.title}
          </p>
          <SkillGraphPreview graph={snapshot.graph} />
        </>
      )}
    </section>
  )
}
