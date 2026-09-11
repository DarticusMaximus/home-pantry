export function daysUntilExpiration(expirationDate?: string): number {
  if (!expirationDate?.trim()) return Infinity

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expiration = new Date(`${expirationDate}T00:00:00`)
  expiration.setHours(0, 0, 0, 0)

  const diffMs = expiration.getTime() - now.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export function isExpiringSoon(expirationDate?: string): boolean {
  if (!expirationDate?.trim()) return false
  return daysUntilExpiration(expirationDate) <= 7
}

export function getExpirationStatus(expirationDate?: string): 'expired' | 'expiring' | null {
  if (!expirationDate?.trim()) return null

  const days = daysUntilExpiration(expirationDate)

  if (days < 0) return 'expired'
  if (days <= 7) return 'expiring'
  return null
}
