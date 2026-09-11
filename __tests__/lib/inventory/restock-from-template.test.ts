import { describe, expect, it } from 'vitest'
import { itemDefaultsFromTemplate } from '@/lib/inventory/restock-from-template'
import type { ItemTemplate } from '@/types/template'

const RESTOCK_KEYS = [
  'name',
  'templateId',
  'quantity',
  'unit',
  'locationId',
  'categoryId',
  'notes',
  'purchaseDate',
  'expirationDate',
] as const

function makeTemplate(overrides: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    id: 'tpl-milk',
    name: 'Milk',
    defaultUnit: 'gallon',
    defaultQuantity: 1,
    defaultExpirationDays: 7,
    defaultStorageLocationId: 'loc-fridge',
    categoryId: 'cat-dairy',
    notes: 'Buy organic',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('itemDefaultsFromTemplate', () => {
  it('maps a full template to every restock key', () => {
    const today = new Date(2026, 7, 28, 12, 0, 0)
    const result = itemDefaultsFromTemplate(makeTemplate(), today)

    expect(Object.keys(result)).toEqual(expect.arrayContaining([...RESTOCK_KEYS]))
    expect(result).toEqual({
      name: 'Milk',
      templateId: 'tpl-milk',
      quantity: 1,
      unit: 'gallon',
      locationId: 'loc-fridge',
      categoryId: 'cat-dairy',
      notes: 'Buy organic',
      purchaseDate: '2026-08-28',
      expirationDate: '2026-09-04',
    })
  })

  it('uses empty strings when location, category, and notes are missing', () => {
    const today = new Date(2026, 7, 28, 12, 0, 0)
    const result = itemDefaultsFromTemplate(
      makeTemplate({
        defaultStorageLocationId: undefined,
        categoryId: undefined,
        notes: undefined,
        defaultExpirationDays: undefined,
      }),
      today,
    )

    expect(result.locationId).toBe('')
    expect(result.categoryId).toBe('')
    expect(result.notes).toBe('')
    expect(result.expirationDate).toBe('')
    expect(result).toMatchObject({
      name: 'Milk',
      templateId: 'tpl-milk',
      quantity: 1,
      unit: 'gallon',
      purchaseDate: '2026-08-28',
    })
  })

  it('adds defaultExpirationDays of 7 to the injected local today', () => {
    const today = new Date(2026, 0, 1, 12, 0, 0)
    const result = itemDefaultsFromTemplate(makeTemplate({ defaultExpirationDays: 7 }), today)

    expect(result.purchaseDate).toBe('2026-01-01')
    expect(result.expirationDate).toBe('2026-01-08')
  })

  it.each([
    undefined,
    0,
    -3,
  ] as const)('leaves expirationDate empty when defaultExpirationDays is %j', (defaultExpirationDays) => {
    const today = new Date(2026, 0, 1, 12, 0, 0)
    const result = itemDefaultsFromTemplate(makeTemplate({ defaultExpirationDays }), today)

    expect(result.purchaseDate).toBe('2026-01-01')
    expect(result.expirationDate).toBe('')
  })

  it('formats dates as local padded YYYY-MM-DD, not UTC ISO', () => {
    const today = new Date(2026, 0, 1, 0, 30, 0)
    const result = itemDefaultsFromTemplate(makeTemplate({ defaultExpirationDays: 7 }), today)

    expect(result.purchaseDate).toBe('2026-01-01')
    expect(result.purchaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.expirationDate).toBe('2026-01-08')

    const isoDate = today.toISOString().split('T')[0]
    if (isoDate !== '2026-01-01') {
      expect(result.purchaseDate).not.toBe(isoDate)
    }
  })
})
