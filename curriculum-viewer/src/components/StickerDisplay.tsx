import { useId, useState } from 'react'

type StickerIconProps = {
  reason?: string | null
  label?: string
}

export function StickerIcon({ reason, label = '칭찬 스티커' }: StickerIconProps) {
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const message = reason?.trim()
  const hasReason = Boolean(message)

  const openTooltip = () => {
    if (hasReason) {
      setOpen(true)
    }
  }

  const closeTooltip = () => {
    setOpen(false)
  }

  const iconClassName = hasReason ? 'sticker-icon sticker-icon--interactive' : 'sticker-icon'

  return (
    <span className="sticker-icon-wrapper">
      <span
        role="img"
        aria-label={label}
        aria-describedby={open && hasReason ? tooltipId : undefined}
        tabIndex={hasReason ? 0 : undefined}
        className={iconClassName}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
      >
        <span aria-hidden="true">🏅</span>
      </span>
      {open && hasReason ? (
        <span id={tooltipId} role="tooltip" className="sticker-tooltip">
          {message}
        </span>
      ) : null}
    </span>
  )
}

type StickerDisplayProps = {
  totalCount: number
  latestReason?: string | null
  maxCount?: number
  recentReasons?: string[]
}

export default function StickerDisplay({
  totalCount,
  latestReason,
  maxCount = 100,
  recentReasons = []
}: StickerDisplayProps) {
  const hasReason = Boolean(latestReason?.trim())
  const normalizedMaxCount = Math.max(1, Math.trunc(maxCount))
  const normalizedTotalCount = Math.max(0, Math.trunc(totalCount))
  const filledCount = Math.min(normalizedTotalCount, normalizedMaxCount)
  const percentage = Math.min(100, Math.round((filledCount / normalizedMaxCount) * 100))
  const previewReasons = recentReasons
    .map((reason) => reason.trim())
    .filter((reason) => reason.length > 0)
    .slice(0, 8)
  const slots = Array.from({ length: normalizedMaxCount }, (_, index) => index < filledCount)

  return (
    <div className="sticker-display-stack">
      <div className="sticker-display-card">
        <StickerIcon reason={latestReason} />
        <div className="sticker-display-content">
          <p className="sticker-display-label">총 스티커</p>
          <p className="sticker-display-total">
            {normalizedTotalCount} / {normalizedMaxCount}
          </p>
          <p className="sticker-display-hint muted">
            {hasReason ? '최근 스티커 사유를 확인해 보세요.' : '아직 받은 스티커가 없어요.'}
          </p>
          <div className="sticker-progress" aria-label={`스티커 달성률 ${percentage}%`}>
            <span className="sticker-progress-fill" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </div>

      <div className="sticker-board-card">
        <div className="sticker-board-header">
          <p className="sticker-board-title">칭찬 스티커 보드</p>
          <p className="sticker-board-count muted">{percentage}% 달성</p>
        </div>
        {previewReasons.length > 0 ? (
          <ul className="sticker-reason-preview" aria-label="최근 칭찬 사유">
            {previewReasons.map((reason, index) => (
              <li key={`${reason}-${index}`} className="sticker-reason-preview-item" title={reason}>
                <span className="sticker-reason-preview-icon" aria-hidden="true">
                  🏅
                </span>
                <span className="sticker-reason-preview-text">{reason}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="sticker-board-grid" aria-label="칭찬 스티커 100칸 보드">
          {slots.map((filled, index) => (
            <span
              key={index}
              className={filled ? 'sticker-board-slot sticker-board-slot--filled' : 'sticker-board-slot'}
              aria-hidden="true"
            >
              {filled ? '🏅' : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
