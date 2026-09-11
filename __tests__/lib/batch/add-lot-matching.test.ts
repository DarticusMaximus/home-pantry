import { describe, expect, it } from 'vitest'
import { applyAddLotMatchToRow, formatJoinNote, matchAddLot } from '@/lib/batch/add-lot-matching'
import type { AddRowData, BatchReviewRow } from '@/types/batch-review'
import type { Item } from '@/types/item'

function makeItem(overrides: Partial<Item> & { name: string }): Item {
  return {
    id: overrides.id ?? `id-${overrides.name}`,
    name: overrides.name,
    quantity: overrides.quantity ?? 1,
    unit: overrides.unit ?? 'cans',
    locationId: overrides.locationId ?? 'loc-fridge',
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

function makeAdd(
  overrides: Partial<AddRowData> = {},
): Pick<AddRowData, 'name' | 'unit' | 'locationId' | 'expirationDate'> {
  return {
    name: 'beans',
    unit: 'cans',
    locationId: 'loc-fridge',
    ...overrides,
  }
}

describe('matchAddLot', () => {
  describe('join — exactly one compatible lot', () => {
    it('joins undated paste to the one undated same-name/place/unit row', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans', quantity: 2 })]

      const result = matchAddLot(makeAdd(), inventory)

      expect(result.status).toBe('ready')
      expect(result.addMatch).toEqual({
        kind: 'join',
        itemId: 'lot-1',
        currentQuantity: 2,
        name: 'beans',
        unit: 'cans',
      })
    })

    it('joins same-date paste to the one dated same-name/place/unit row', () => {
      const inventory = [
        makeItem({
          id: 'lot-dated',
          name: 'beans',
          quantity: 3,
          expirationDate: '2026-09-10',
        }),
      ]

      const result = matchAddLot(makeAdd({ expirationDate: '2026-09-10' }), inventory)

      expect(result.status).toBe('ready')
      expect(result.addMatch?.kind).toBe('join')
      if (result.addMatch?.kind === 'join') {
        expect(result.addMatch.itemId).toBe('lot-dated')
      }
    })

    it('joins Milk and milk', () => {
      const inventory = [makeItem({ id: 'milk-1', name: 'Milk', unit: 'gal' })]

      const result = matchAddLot(makeAdd({ name: 'milk', unit: 'gal' }), inventory)

      expect(result.addMatch?.kind).toBe('join')
      if (result.addMatch?.kind === 'join') {
        expect(result.addMatch.itemId).toBe('milk-1')
      }
    })

    it('joins steaks and Steak after singularize', () => {
      const inventory = [makeItem({ id: 'steak-1', name: 'Steak', unit: 'each' })]

      const result = matchAddLot(makeAdd({ name: 'steaks', unit: 'each' }), inventory)

      expect(result.addMatch?.kind).toBe('join')
      if (result.addMatch?.kind === 'join') {
        expect(result.addMatch.itemId).toBe('steak-1')
      }
    })

    it('joins when category differs', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans', categoryId: 'cat-veg' })]

      const result = matchAddLot(makeAdd(), inventory)

      expect(result.addMatch?.kind).toBe('join')
      if (result.addMatch?.kind === 'join') {
        expect(result.addMatch.itemId).toBe('lot-1')
      }
    })

    it('treats whitespace and invalid expiry as undated and joins', () => {
      const inventory = [
        makeItem({ id: 'lot-1', name: 'beans', expirationDate: '  ' }),
        makeItem({
          id: 'other',
          name: 'rice',
          expirationDate: 'not-a-date',
        }),
      ]

      const result = matchAddLot(makeAdd({ expirationDate: 'soon' }), inventory)

      expect(result.addMatch?.kind).toBe('join')
      if (result.addMatch?.kind === 'join') {
        expect(result.addMatch.itemId).toBe('lot-1')
      }
    })
  })

  describe('new lot', () => {
    it('does not join whole milk to milk', () => {
      const inventory = [makeItem({ id: 'milk-1', name: 'milk', unit: 'gal' })]

      const result = matchAddLot(makeAdd({ name: 'whole milk', unit: 'gal' }), inventory)

      expect(result.status).toBe('ready')
      expect(result.addMatch).toEqual({ kind: 'new_lot' })
    })

    it('treats gal vs gallon as a new lot', () => {
      const inventory = [makeItem({ id: 'milk-1', name: 'milk', unit: 'gallon' })]

      const result = matchAddLot(makeAdd({ name: 'milk', unit: 'gal' }), inventory)

      expect(result.addMatch).toEqual({ kind: 'new_lot' })
    })

    it('treats a different locationId as a new lot', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans', locationId: 'loc-pantry' })]

      const result = matchAddLot(makeAdd({ locationId: 'loc-fridge' }), inventory)

      expect(result.addMatch).toEqual({ kind: 'new_lot' })
    })

    it('creates a new lot for dated paste vs one undated live row (no lot_choice)', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans' })]

      const result = matchAddLot(makeAdd({ expirationDate: '2026-09-10' }), inventory)

      expect(result.status).toBe('ready')
      expect(result.addMatch).toEqual({ kind: 'new_lot' })
    })

    it('creates a new lot when dates differ', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans', expirationDate: '2026-09-10' })]

      const result = matchAddLot(makeAdd({ expirationDate: '2026-10-01' }), inventory)

      expect(result.addMatch).toEqual({ kind: 'new_lot' })
    })

    it('creates a new lot when nothing matches name/place/unit', () => {
      const inventory = [makeItem({ id: 'rice-1', name: 'rice' })]

      const result = matchAddLot(makeAdd(), inventory)

      expect(result.addMatch).toEqual({ kind: 'new_lot' })
    })
  })

  describe('lot_choice — undated paste vs one dated lot', () => {
    it('returns lot_choice with that candidate', () => {
      const inventory = [
        makeItem({
          id: 'dated-beans',
          name: 'beans',
          quantity: 2,
          expirationDate: '2026-09-10',
        }),
      ]

      const result = matchAddLot(makeAdd(), inventory)

      expect(result.status).toBe('lot_choice')
      expect(result.addMatch).toEqual({
        kind: 'lot_choice',
        candidate: {
          itemId: 'dated-beans',
          name: 'beans',
          locationId: 'loc-fridge',
          quantity: 2,
          unit: 'cans',
          expirationDate: '2026-09-10',
        },
      })
    })
  })

  describe('ambiguous — two or more same-name/place/unit lots', () => {
    it('returns ambiguous for two undated clones even though both are compatible', () => {
      const inventory = [
        makeItem({ id: 'clone-a', name: 'beans', quantity: 2 }),
        makeItem({ id: 'clone-b', name: 'beans', quantity: 1 }),
      ]

      const result = matchAddLot(makeAdd(), inventory)

      expect(result.status).toBe('ambiguous_match')
      expect(result.addMatch?.kind).toBe('ambiguous')
      if (result.addMatch?.kind === 'ambiguous') {
        expect(result.addMatch.candidates.map((c) => c.itemId)).toEqual(['clone-a', 'clone-b'])
      }
    })

    it('returns ambiguous for mixed undated+dated lots even if exactly one is compatible', () => {
      const inventory = [
        makeItem({ id: 'undated', name: 'beans', quantity: 2 }),
        makeItem({
          id: 'dated',
          name: 'beans',
          quantity: 1,
          expirationDate: '2026-09-10',
        }),
      ]

      const result = matchAddLot(makeAdd(), inventory)

      expect(result.status).toBe('ambiguous_match')
      expect(result.addMatch?.kind).toBe('ambiguous')
      if (result.addMatch?.kind === 'ambiguous') {
        expect(result.addMatch.candidates).toHaveLength(2)
      }
    })
  })

  describe('missing location wins', () => {
    it('does not match when locationId is missing', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans' })]

      const result = matchAddLot(makeAdd({ locationId: '' }), inventory)

      expect(result.status).toBe('missing_location')
      expect(result.addMatch).toBeUndefined()
    })

    it('does not match when locationId is whitespace', () => {
      const inventory = [
        makeItem({
          id: 'dated-beans',
          name: 'beans',
          expirationDate: '2026-09-10',
        }),
      ]

      const result = matchAddLot(makeAdd({ locationId: '   ' }), inventory)

      expect(result.status).toBe('missing_location')
      expect(result.addMatch).toBeUndefined()
    })
  })
})

describe('applyAddLotMatchToRow', () => {
  it('keeps lot_choice on rematch when paste omitted expiry and a template stamped a different use-by', () => {
    const inventory = [
      makeItem({
        id: 'beans-dated',
        name: 'beans',
        quantity: 3,
        unit: 'cans',
        locationId: 'loc-fridge',
        expirationDate: '2026-09-10',
      }),
    ]
    const row: BatchReviewRow = {
      id: 'row-c4',
      operation: 'add',
      status: 'lot_choice',
      source: { source: 'ai_text', raw: '2 cans beans' },
      addData: {
        name: 'beans',
        quantity: 2,
        unit: 'cans',
        locationId: 'loc-fridge',
        expirationDate: '2026-05-04',
        pasteExpirationDate: null,
      },
      addMatch: {
        kind: 'lot_choice',
        candidate: {
          itemId: 'beans-dated',
          name: 'beans',
          locationId: 'loc-fridge',
          quantity: 3,
          unit: 'cans',
          expirationDate: '2026-09-10',
        },
      },
    }

    const rematched = applyAddLotMatchToRow(row, inventory)

    expect(rematched.status).toBe('lot_choice')
    expect(rematched.addMatch).toEqual(row.addMatch)
    expect(rematched.addData?.expirationDate).toBe('2026-05-04')
  })
})

describe('formatJoinNote', () => {
  it('includes location name when present', () => {
    expect(
      formatJoinNote({
        locationName: 'Fridge',
        name: 'beans',
        currentQty: 2,
        addQty: 2,
        unit: 'cans',
      }),
    ).toBe('Fridge beans, 2 cans → 4 cans')
  })

  it('omits location when the name is missing', () => {
    expect(
      formatJoinNote({
        name: 'beans',
        currentQty: 2,
        addQty: 2,
        unit: 'cans',
      }),
    ).toBe('beans, 2 cans → 4 cans')
  })
})
