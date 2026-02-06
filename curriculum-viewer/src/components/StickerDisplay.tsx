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
}

export default function StickerDisplay({ totalCount, latestReason }: StickerDisplayProps) {
  const hasReason = Boolean(latestReason?.trim())

  return (
    <div className="sticker-display-card">
      <StickerIcon reason={latestReason} />
      <div className="sticker-display-content">
        <p className="sticker-display-label">총 스티커</p>
        <p className="sticker-display-total">{totalCount}개</p>
        <p className="sticker-display-hint muted">
          {hasReason ? '스티커에 마우스를 올려 사유를 확인해 보세요.' : '아직 받은 스티커가 없어요.'}
        </p>
      </div>
    </div>
  )
}
