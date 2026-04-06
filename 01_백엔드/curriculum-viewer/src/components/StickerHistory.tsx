import type { PraiseSticker } from '../lib/sticker/types'
import { StickerIcon } from './StickerDisplay'

type StickerHistoryProps = {
  stickers: PraiseSticker[]
}

function formatStickerDate(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return isoString
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getReasonLabel(sticker: PraiseSticker): string {
  if (sticker.reasonType === 'bonus') {
    return '보너스'
  }
  return '숙제 우수'
}

export default function StickerHistory({ stickers }: StickerHistoryProps) {
  if (stickers.length === 0) {
    return <p className="muted">획득한 스티커가 아직 없습니다.</p>
  }

  return (
    <ul className="sticker-history-list">
      {stickers.map((sticker) => (
        <li key={sticker.id} className="sticker-history-item">
          <StickerIcon reason={sticker.reason} />
          <div className="sticker-history-content">
            <p className="sticker-history-reason">{sticker.reason}</p>
            <p className="sticker-history-meta">
              <span className="sticker-history-chip">{getReasonLabel(sticker)}</span>
              <span className="sticker-history-count">+{sticker.count}개</span>
              <span className="muted">{formatStickerDate(sticker.grantedAt)}</span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
