export type PraiseStickerReasonType = 'homework_excellent' | 'bonus'

export type PraiseSticker = {
  id: string
  studentId: string
  count: number
  reason: string
  reasonType: PraiseStickerReasonType
  homeworkId?: string | null
  grantedBy?: string | null
  grantedAt: string
}

export type StickerSummary = {
  totalCount: number
}
