import { describe, expect, it } from 'vitest'
import { extendDueAtByWeek } from './dueAt'

describe('extendDueAtByWeek', () => {
  it('extends ISO datetime with timezone by 7 days', () => {
    const next = extendDueAtByWeek('2026-02-01T12:30:00Z')
    expect(next).toMatch(/^2026-02-08T\d{2}:\d{2}$/)
  })

  it('extends datetime-local format by 7 days', () => {
    const next = extendDueAtByWeek('2026-02-01T23:59')
    expect(next).toBe('2026-02-08T23:59')
  })

  it('returns null for invalid input', () => {
    expect(extendDueAtByWeek('not-a-date')).toBeNull()
    expect(extendDueAtByWeek('')).toBeNull()
  })
})
