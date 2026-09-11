import { describe, expect, it } from 'vitest'
import { applyRemoveMatch, matchRemoveRow, sortRemoveCandidates } from '@/lib/batch/remove-matching'
import type { Item } from '@/types/item'

function makeItem(overrides: Partial<Item> & { name: string }): Item {
  return {
    id: overrides.id ?? `id-${overrides.name}`,
    name: overrides.name,
    quantity: overrides.quantity ?? 1,
    unit: overrides.unit ?? 'each',
    locationId: overrides.locationId ?? 'loc-1',
    templateId: overrides.templateId,
    categoryId: overrides.categoryId,
    expirationDate: overrides.expirationDate,
    purchaseDate: overrides.purchaseDate,
    notes: overrides.notes,
    createdById: overrides.createdById ?? 'user-1',
    createdAt: overrides.createdAt ?? '2026-01-01',
    updatedAt: overrides.updatedAt ?? '2026-01-01',
  }
}

describe('matchRemoveRow', () => {
  describe('strong unique match', () => {
    it('auto-selects when one candidate clearly matches by name', () => {
      const inventory = [
        makeItem({ name: 'Whole Milk', quantity: 2 }),
        makeItem({ name: 'Cheddar Cheese', quantity: 1 }),
        makeItem({ name: 'Eggs', quantity: 12 }),
      ]

      const result = matchRemoveRow('milk', inventory)

      expect(result.status).toBe('resolved')
      expect(result.bestMatch).toBeDefined()
      expect(result.bestMatch!.item.name).toBe('Whole Milk')
    })

    it('selects exact match over partial match', () => {
      const inventory = [
        makeItem({ name: 'Milk', quantity: 2 }),
        makeItem({ name: 'Whole Milk', quantity: 1 }),
      ]

      const result = matchRemoveRow('Milk', inventory)

      expect(result.status).toBe('resolved')
      expect(result.bestMatch!.item.name).toBe('Milk')
    })

    it('scores candidates with descending relevance', () => {
      const inventory = [
        makeItem({ name: 'Almond Milk', quantity: 1 }),
        makeItem({ name: 'Milk Chocolate', quantity: 3 }),
        makeItem({ name: 'Milk', quantity: 2 }),
      ]

      const result = matchRemoveRow('milk', inventory)

      expect(result.status).toBe('resolved')
      expect(result.candidates[0].item.name).toBe('Milk')
    })
  })

  describe('ambiguous matches', () => {
    it('returns ambiguous when multiple candidates have similar scores', () => {
      const inventory = [
        makeItem({ name: 'Cheddar Cheese', quantity: 1 }),
        makeItem({ name: 'Swiss Cheese', quantity: 2 }),
        makeItem({ name: 'Cream Cheese', quantity: 1 }),
      ]

      const result = matchRemoveRow('cheese', inventory)

      expect(result.status).toBe('ambiguous')
      expect(result.bestMatch).toBeNull()
      expect(result.candidates.length).toBeGreaterThan(1)
    })

    it('returns ambiguous when two items have the same name in different locations', () => {
      const inventory = [
        makeItem({ name: 'Butter', quantity: 2, locationId: 'fridge' }),
        makeItem({ name: 'Butter', quantity: 1, locationId: 'freezer' }),
      ]

      const result = matchRemoveRow('butter', inventory)

      expect(result.status).toBe('ambiguous')
    })
  })

  describe('no match', () => {
    it('returns no_match when nothing in inventory resembles the request', () => {
      const inventory = [
        makeItem({ name: 'Bread', quantity: 1 }),
        makeItem({ name: 'Eggs', quantity: 12 }),
      ]

      const result = matchRemoveRow('caviar', inventory)

      expect(result.status).toBe('no_match')
      expect(result.candidates).toHaveLength(0)
      expect(result.bestMatch).toBeNull()
    })

    it('returns no_match when inventory is empty', () => {
      const result = matchRemoveRow('milk', [])

      expect(result.status).toBe('no_match')
    })
  })

  describe('name normalization', () => {
    it('matches case-insensitively', () => {
      const inventory = [makeItem({ name: 'whole milk', quantity: 2 })]

      const result = matchRemoveRow('WHOLE MILK', inventory)

      expect(result.status).toBe('resolved')
    })

    it('matches after trimming whitespace', () => {
      const inventory = [makeItem({ name: 'Milk', quantity: 2 })]

      const result = matchRemoveRow('  milk  ', inventory)

      expect(result.status).toBe('resolved')
    })
  })
})

describe('sortRemoveCandidates', () => {
  it('returns candidates sorted by score descending', () => {
    const inventory = [
      makeItem({ name: 'Milk', quantity: 2 }),
      makeItem({ name: 'Almond Milk', quantity: 1 }),
      makeItem({ name: 'Milk Chocolate', quantity: 3 }),
    ]

    const candidates = sortRemoveCandidates('milk', inventory)

    expect(candidates.length).toBeGreaterThan(0)
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1].score).toBeGreaterThanOrEqual(candidates[i].score)
    }
  })

  it('returns empty array for empty inventory', () => {
    const candidates = sortRemoveCandidates('milk', [])

    expect(candidates).toHaveLength(0)
  })

  it('includes every matching inventory item with no active-flag filter', () => {
    const inventory = [
      makeItem({ name: 'Milk', quantity: 0 }),
      makeItem({ name: 'Almond Milk', quantity: 1 }),
    ]

    const candidates = sortRemoveCandidates('milk', inventory)

    expect(candidates.map((c) => c.item.name)).toEqual(
      expect.arrayContaining(['Milk', 'Almond Milk']),
    )
  })
})

describe('applyRemoveMatch', () => {
  it('builds resolved removeData and keeps the requested removeQuantity', () => {
    const inventory = [makeItem({ id: 'milk-1', name: 'Milk', quantity: 3 })]

    const result = applyRemoveMatch('Milk', inventory, 2)

    expect(result.status).toBe('ready')
    expect(result.removeData).toMatchObject({
      type: 'resolved',
      matchedItemId: 'milk-1',
      matchedItemName: 'Milk',
      currentQuantity: 3,
      removeQuantity: 2,
    })
  })

  it('builds unresolved ambiguous removeData and keeps removeQuantity', () => {
    const inventory = [
      makeItem({ id: 'whole', name: 'Whole Milk', quantity: 2 }),
      makeItem({ id: 'oat', name: 'Oat Milk', quantity: 1 }),
    ]

    const result = applyRemoveMatch('Milk', inventory, 1)

    expect(result.status).toBe('ambiguous_match')
    expect(result.removeData).toMatchObject({
      type: 'unresolved',
      requestedName: 'Milk',
      removeQuantity: 1,
    })
    expect(result.removeData.candidates.length).toBeGreaterThan(1)
  })

  it('builds no_match with empty candidates when inventory is empty', () => {
    const result = applyRemoveMatch('Milk', [], 4)

    expect(result.status).toBe('no_match')
    expect(result.removeData).toEqual({
      type: 'unresolved',
      requestedName: 'Milk',
      removeQuantity: 4,
      candidates: [],
    })
  })
})
