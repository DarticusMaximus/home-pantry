export function singularize(value: string): string {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`
  if (value.endsWith('es')) return value.slice(0, -2)
  if (value.endsWith('s')) return value.slice(0, -1)
  return value
}

export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calculateExpirationDate(purchaseDate: string, days?: number): string | undefined {
  if (!days || days <= 0) return undefined
  const date = new Date(`${purchaseDate}T00:00:00`)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}
