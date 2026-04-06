function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDateTimeLocalString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

export function extendDueAtByDays(dueAt: string, days: number): string | null {
  const trimmed = dueAt.trim()
  if (!trimmed) return null

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null

  date.setDate(date.getDate() + days)
  return toDateTimeLocalString(date)
}

export function extendDueAtByWeek(dueAt: string): string | null {
  return extendDueAtByDays(dueAt, 7)
}
