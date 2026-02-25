import { describe, expect, it } from 'vitest'
import { computeDefaultScheduleAndDue, resolveHomeworkDayKey } from './scheduling'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}`
}

describe('homework scheduling defaults', () => {
  it('resolves dayKey strings to HomeworkDayKey', () => {
    expect(resolveHomeworkDayKey('mon')).toBe('mon')
    expect(resolveHomeworkDayKey(' fri ')).toBe('fri')
    expect(resolveHomeworkDayKey('')).toBeNull()
    expect(resolveHomeworkDayKey('sat')).toBeNull()
    expect(resolveHomeworkDayKey(null)).toBeNull()
  })

  it('computes schedule 08:00 and due 23:59 for the same-week weekday (local)', () => {
    const now = new Date(2026, 1, 19, 12, 0)
    const { scheduledAt, dueAt } = computeDefaultScheduleAndDue({ now, dayKey: 'mon' })

    expect(scheduledAt).toBe(toLocalInput(new Date(2026, 1, 16, 8, 0)))
    expect(dueAt).toBe(toLocalInput(new Date(2026, 1, 16, 23, 59)))
  })

  it('falls back to Friday when dayKey is missing', () => {
    const now = new Date(2026, 1, 19, 12, 0)
    const { scheduledAt, dueAt } = computeDefaultScheduleAndDue({ now, dayKey: null })
    expect(scheduledAt).toBe(toLocalInput(new Date(2026, 1, 20, 8, 0)))
    expect(dueAt).toBe(toLocalInput(new Date(2026, 1, 20, 23, 59)))
  })
})
