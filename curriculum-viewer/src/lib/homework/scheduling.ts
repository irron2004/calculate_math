export type HomeworkDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDateTimeLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}`
}

function startOfIsoWeekLocal(date: Date): Date {
  const result = new Date(date)
  const daysSinceMonday = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - daysSinceMonday)
  result.setHours(0, 0, 0, 0)
  return result
}

function dayKeyToIsoIndex(dayKey: HomeworkDayKey): number {
  if (dayKey === 'mon') return 0
  if (dayKey === 'tue') return 1
  if (dayKey === 'wed') return 2
  if (dayKey === 'thu') return 3
  return 4
}

export function resolveHomeworkDayKey(dayKey: string | null | undefined): HomeworkDayKey | null {
  const trimmed = (dayKey ?? '').trim()
  if (trimmed === 'mon' || trimmed === 'tue' || trimmed === 'wed' || trimmed === 'thu' || trimmed === 'fri') {
    return trimmed
  }
  return null
}

export function computeDefaultScheduleAndDue(params: {
  now: Date
  dayKey: HomeworkDayKey | null
  fallbackDayKey?: HomeworkDayKey
}): { scheduledAt: string; dueAt: string } {
  const fallback = params.fallbackDayKey ?? 'fri'
  const effectiveDayKey = params.dayKey ?? fallback
  const weekStart = startOfIsoWeekLocal(params.now)
  const target = new Date(weekStart)
  target.setDate(target.getDate() + dayKeyToIsoIndex(effectiveDayKey))

  const scheduledAt = new Date(target)
  scheduledAt.setHours(8, 0, 0, 0)

  const dueAt = new Date(target)
  dueAt.setHours(23, 59, 0, 0)

  return {
    scheduledAt: toDateTimeLocalInputValue(scheduledAt),
    dueAt: toDateTimeLocalInputValue(dueAt)
  }
}

export function formatHomeworkTitleDaySuffix(dayKey: HomeworkDayKey): string {
  if (dayKey === 'mon') return '월'
  if (dayKey === 'tue') return '화'
  if (dayKey === 'wed') return '수'
  if (dayKey === 'thu') return '목'
  return '금'
}
