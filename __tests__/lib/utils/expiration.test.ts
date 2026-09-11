import { describe, expect, it } from 'vitest'
import { daysUntilExpiration, getExpirationStatus, isExpiringSoon } from '@/lib/utils/expiration'

function localYmd(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe('expiration utilities', () => {
  describe('missing and blank dates', () => {
    it.each([
      undefined,
      '',
      '   ',
    ] as const)('treats %j as not soon, null status, and Infinity days', (value) => {
      expect(isExpiringSoon(value)).toBe(false)
      expect(getExpirationStatus(value)).toBeNull()
      expect(daysUntilExpiration(value)).toBe(Infinity)
    })
  })

  describe('isExpiringSoon', () => {
    it('returns true for today (offset 0)', () => {
      expect(isExpiringSoon(localYmd(0))).toBe(true)
    })

    it('returns true for date 7 days from now', () => {
      expect(isExpiringSoon(localYmd(7))).toBe(true)
    })

    it('returns false for date 8 days from now', () => {
      expect(isExpiringSoon(localYmd(8))).toBe(false)
    })

    it('returns true for already-expired date (offset -2)', () => {
      expect(isExpiringSoon(localYmd(-2))).toBe(true)
    })
  })

  describe('getExpirationStatus', () => {
    it('returns expiring for today (offset 0)', () => {
      expect(getExpirationStatus(localYmd(0))).toBe('expiring')
    })

    it('returns expiring for date 7 days from now', () => {
      expect(getExpirationStatus(localYmd(7))).toBe('expiring')
    })

    it('returns null for date 8 days from now', () => {
      expect(getExpirationStatus(localYmd(8))).toBeNull()
    })

    it('returns expired for already-expired date (offset -2)', () => {
      expect(getExpirationStatus(localYmd(-2))).toBe('expired')
    })
  })

  describe('daysUntilExpiration', () => {
    it('returns 0 for today', () => {
      expect(daysUntilExpiration(localYmd(0))).toBe(0)
    })

    it('returns 7 for date 7 days from now', () => {
      expect(daysUntilExpiration(localYmd(7))).toBe(7)
    })

    it('returns 8 for date 8 days from now', () => {
      expect(daysUntilExpiration(localYmd(8))).toBe(8)
    })

    it('returns -2 for date 2 days ago', () => {
      expect(daysUntilExpiration(localYmd(-2))).toBe(-2)
    })
  })
})
