import { formatDate } from '@/lib/ai/utils'
import type { ItemTemplate } from '@/types/template'

export type RestockItemDefaults = {
  name: string
  templateId: string
  quantity: number
  unit: string
  locationId: string
  categoryId: string
  notes: string
  purchaseDate: string
  expirationDate: string
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function itemDefaultsFromTemplate(
  template: ItemTemplate,
  today: Date = new Date(),
): RestockItemDefaults {
  const purchaseDate = formatDate(today)
  const days = template.defaultExpirationDays
  const expirationDate =
    typeof days === 'number' && days > 0 ? formatDate(addLocalDays(today, days)) : ''

  return {
    name: template.name,
    templateId: template.id,
    quantity: template.defaultQuantity,
    unit: template.defaultUnit,
    locationId: template.defaultStorageLocationId || '',
    categoryId: template.categoryId || '',
    notes: template.notes || '',
    purchaseDate,
    expirationDate,
  }
}
