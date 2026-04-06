export type DraftRestoreModalProps = {
  isOpen: boolean
  savedAt?: number | null
  onRestore: () => void
  onDiscard: () => void
}

function formatSavedAt(savedAt?: number | null): string | null {
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null
  return new Date(savedAt).toLocaleString()
}

export default function DraftRestoreModal({
  isOpen,
  savedAt,
  onRestore,
  onDiscard
}: DraftRestoreModalProps) {
  if (!isOpen) return null
  const savedLabel = formatSavedAt(savedAt)

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Draft restore">
      <div className="modal-content">
        <h2>이전 답안이 있습니다</h2>
        <p>저장된 답안을 불러오시겠습니까?</p>
        {savedLabel ? <p className="muted">{savedLabel} 저장됨</p> : null}
        <div className="modal-actions">
          <button type="button" className="button button-primary" onClick={onRestore}>
            이어서 풀기
          </button>
          <button type="button" className="button button-ghost" onClick={onDiscard}>
            처음부터 풀기
          </button>
        </div>
      </div>
    </div>
  )
}
