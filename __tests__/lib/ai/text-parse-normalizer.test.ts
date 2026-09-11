import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTemplateDefaultsToRow } from '@/lib/ai/batch-template-defaults'
import { normalizeParsedTextToReviewRows } from '@/lib/ai/text-parse-normalizer'
import { applyAddLotMatchToRow } from '@/lib/batch/add-lot-matching'
import { applyRemoveMatch } from '@/lib/batch/remove-matching'
import { itemDefaultsFromTemplate } from '@/lib/inventory/restock-from-template'
import type { ParsedTextItem } from '@/types/ai-text-parse'
import type { Item } from '@/types/item'
import type { ItemTemplate } from '@/types/template'

function makeParsedItem(overrides: Partial<ParsedTextItem> = {}): ParsedTextItem {
  return {
    name: 'Milk',
    quantity: 1,
    unit: 'gallon',
    categoryName: null,
    explicitLocationName: null,
    expirationHint: null,
    sourceLine: '1 gallon milk',
    isUncertain: false,
    uncertaintyReason: null,
    ...overrides,
  }
}

const steakTemplate = {
  id: 'template-steak',
  name: 'Steak',
  defaultUnit: 'each',
  defaultQuantity: 1,
  categoryId: 'cat-meat',
  defaultStorageLocationId: 'loc-freezer',
  defaultExpirationDays: 7,
}

function steakTemplateLookup(overrides: Partial<typeof steakTemplate> = {}) {
  return new Map([['steak', { ...steakTemplate, ...overrides }]])
}

function asItemTemplate(template: typeof steakTemplate): ItemTemplate {
  return {
    ...template,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function makeInventoryItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: 'Milk',
    quantity: 2,
    unit: 'gal',
    locationId: 'loc-fridge',
    createdById: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('normalizeParsedTextToReviewRows', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('add-mode normalization', () => {
    it('maps reliable basics (name, quantity, unit) into add rows', () => {
      const items = [
        makeParsedItem({ name: 'Bread', quantity: 1, unit: 'loaf' }),
        makeParsedItem({ name: 'Eggs', quantity: 12, unit: 'each' }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
      })

      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].operation).toBe('add')
      expect(result.rows[0].status).toBe('missing_location')
      expect(result.rows[0].addData?.name).toBe('Bread')
      expect(result.rows[0].addData?.quantity).toBe(1)
      expect(result.rows[0].addData?.unit).toBe('each')
      expect(result.rows[0].addData?.locationId).toBe('')
      expect(result.rows[1].addData?.name).toBe('Eggs')
      expect(result.rows[1].addData?.quantity).toBe(12)
    })

    it('fills locationId from explicit location cues', () => {
      const items = [
        makeParsedItem({
          name: 'Butter',
          quantity: 1,
          unit: 'lb',
          explicitLocationName: 'fridge',
        }),
      ]

      const locationLookup = new Map([['fridge', 'loc-fridge-id']])

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
        locationLookup,
      })

      expect(result.rows[0].addData?.locationId).toBe('loc-fridge-id')
      expect(result.rows[0].status).toBe('ready')
    })

    it('does not invent 1 / each when paste omits quantity and unit and no template matches', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'Rice',
            quantity: null,
            unit: null,
            explicitLocationName: 'pantry',
          }),
        ],
        locationLookup: new Map([['pantry', 'loc-pantry']]),
      })

      expect(result.rows[0].status).toBe('missing_quantity')
      expect(result.rows[0].addData?.quantity).not.toBe(1)
      expect(result.rows[0].addData?.unit).not.toBe('each')
      expect(result.rows[0].addData?.locationId).toBe('loc-pantry')
    })

    it('does not invent each when paste has quantity but omits unit and no template matches', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'Rice',
            quantity: 2,
            unit: null,
            explicitLocationName: 'pantry',
          }),
        ],
        locationLookup: new Map([['pantry', 'loc-pantry']]),
      })

      expect(result.rows[0].status).toBe('missing_unit')
      expect(result.rows[0].addData?.quantity).toBe(2)
      expect(result.rows[0].addData?.unit).not.toBe('each')
      expect(result.rows[0].addData?.locationId).toBe('loc-pantry')
    })

    it('leaves location unresolved when no explicit cue is present', () => {
      const items = [makeParsedItem({ explicitLocationName: null })]

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
      })

      expect(result.rows[0].addData?.locationId).toBe('')
      expect(result.rows[0].status).toBe('missing_location')
    })

    it('leaves location unresolved when explicit cue does not match known locations', () => {
      const items = [
        makeParsedItem({
          explicitLocationName: 'garage shelf',
        }),
      ]

      const locationLookup = new Map([['fridge', 'loc-fridge-id']])

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
        locationLookup,
      })

      expect(result.rows[0].addData?.locationId).toBe('')
      expect(result.rows[0].status).toBe('missing_location')
    })

    it('maps category and expiration when provided', () => {
      const items = [
        makeParsedItem({
          name: 'Yogurt',
          quantity: 3,
          unit: 'cup',
          categoryName: 'Dairy',
          expirationHint: '2026-05-01',
        }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
        categoryLookup: new Map([['dairy', 'cat-dairy-id']]),
      })

      expect(result.rows[0].addData?.categoryId).toBe('cat-dairy-id')
      expect(result.rows[0].addData?.expirationDate).toBe('2026-05-01')
    })

    it('matches plural parsed names to singular templates and applies template defaults', () => {
      const items = [
        makeParsedItem({
          name: 'steaks',
          quantity: 4,
          unit: null,
          explicitLocationName: 'Fridge Freezer',
        }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
        locationLookup: new Map([['fridge freezer', 'loc-freezer']]),
        templateLookup: new Map([
          [
            'steak',
            {
              id: 'template-steak',
              name: 'Steak',
              defaultUnit: 'each',
              defaultQuantity: 1,
              categoryId: 'cat-meat',
              defaultStorageLocationId: 'loc-freezer',
              defaultExpirationDays: 7,
            },
          ],
        ]),
      })

      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].addData).toMatchObject({
        name: 'Steak',
        quantity: 4,
        unit: 'each',
        locationId: 'loc-freezer',
        templateId: 'template-steak',
        categoryId: 'cat-meat',
        purchaseDate: '2026-04-27',
        expirationDate: '2026-05-04',
      })
    })

    it('keeps explicit expiration hints instead of template-derived expiration dates', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [makeParsedItem({ name: 'Milk', expirationHint: '2026-04-30' })],
        templateLookup: new Map([
          [
            'milk',
            {
              id: 'template-milk',
              name: 'Milk',
              defaultUnit: 'gallon',
              defaultQuantity: 1,
              defaultExpirationDays: 10,
            },
          ],
        ]),
      })

      expect(result.rows[0].addData?.purchaseDate).toBe('2026-04-27')
      expect(result.rows[0].addData?.expirationDate).toBe('2026-04-30')
    })

    it('ignores empty string expirationHint and uses template default', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [makeParsedItem({ name: 'Steak', expirationHint: '' })],
        templateLookup: new Map([
          [
            'steak',
            {
              id: 'template-steak',
              name: 'Steak',
              defaultUnit: 'each',
              defaultQuantity: 1,
              defaultExpirationDays: 180,
            },
          ],
        ]),
      })

      expect(result.rows[0].addData?.expirationDate).toBe('2026-10-24')
    })

    it('ignores non-date string expirationHint and uses template default', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [makeParsedItem({ name: 'Steak', expirationHint: 'not mentioned' })],
        templateLookup: new Map([
          [
            'steak',
            {
              id: 'template-steak',
              name: 'Steak',
              defaultUnit: 'each',
              defaultQuantity: 1,
              defaultExpirationDays: 180,
            },
          ],
        ]),
      })

      expect(result.rows[0].addData?.expirationDate).toBe('2026-10-24')
    })

    it('keeps paste quantity 2 when the template default is 1', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [makeParsedItem({ name: 'steaks', quantity: 2, unit: null })],
        templateLookup: steakTemplateLookup(),
      })

      expect(result.rows[0].addData?.quantity).toBe(2)
      expect(result.rows[0].addData?.name).toBe('Steak')
    })

    it('overwrites guessed non-null unit, quantity, and expiry from a matching template', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'Milk',
            quantity: 3,
            unit: 'each',
            expirationHint: '2026-12-01',
            isUncertain: true,
            uncertaintyReason: 'guessed unit',
          }),
        ],
        templateLookup: new Map([
          [
            'milk',
            {
              id: 'template-milk',
              name: 'Milk',
              defaultUnit: 'gallon',
              defaultQuantity: 1,
              defaultExpirationDays: 10,
              defaultStorageLocationId: 'loc-fridge',
            },
          ],
        ]),
      })

      expect(result.rows[0].addData?.unit).toBe('gallon')
      expect(result.rows[0].addData?.quantity).toBe(1)
      expect(result.rows[0].addData?.expirationDate).toBe('2026-05-07')
      expect(result.rows[0].parseMetadata?.isUncertain).toBe(false)
    })

    it('fills omitted unit, place, quantity, and expiry from a matching template', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'steaks',
            quantity: null,
            unit: null,
            explicitLocationName: null,
            expirationHint: null,
          }),
        ],
        templateLookup: steakTemplateLookup(),
      })

      expect(result.rows[0].addData).toMatchObject({
        name: 'Steak',
        quantity: 1,
        unit: 'each',
        locationId: 'loc-freezer',
        templateId: 'template-steak',
      })
      expect(result.rows[0].addData?.expirationDate).toBeTruthy()
      expect(result.rows[0].status).toBe('ready')
    })

    it('keeps paste expiry and fills omitted unit, place, and quantity from the template', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'steaks',
            quantity: null,
            unit: null,
            explicitLocationName: null,
            expirationHint: '2026-05-01',
            isUncertain: false,
            uncertaintyReason: null,
          }),
        ],
        templateLookup: steakTemplateLookup(),
      })

      expect(result.rows[0].addData?.expirationDate).toBe('2026-05-01')
      expect(result.rows[0].addData?.quantity).toBe(1)
      expect(result.rows[0].addData?.unit).toBe('each')
      expect(result.rows[0].addData?.locationId).toBe('loc-freezer')
      expect(result.rows[0].addData?.name).toBe('Steak')
      expect(result.rows[0].status).toBe('ready')
    })

    it('leaves unknown place empty and missing_location when the template has no usual place', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'steaks',
            quantity: null,
            unit: null,
            explicitLocationName: null,
          }),
        ],
        templateLookup: steakTemplateLookup({ defaultStorageLocationId: undefined }),
      })

      expect(result.rows[0].addData?.locationId).toBe('')
      expect(result.rows[0].status).toBe('missing_location')
    })

    it('does not change already-filled add fields on a second template apply', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'steaks',
            quantity: null,
            unit: null,
            explicitLocationName: null,
            expirationHint: '2026-05-01',
          }),
        ],
        templateLookup: steakTemplateLookup(),
      })

      const again = applyTemplateDefaultsToRow(result.rows[0], [asItemTemplate(steakTemplate)])

      expect(again).toBe(result.rows[0])
      expect(again.addData).toEqual(result.rows[0].addData)
    })

    it('clears isUncertain when a template matches and keeps it when none matches', () => {
      const matched = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'steaks',
            quantity: null,
            unit: null,
            isUncertain: true,
            uncertaintyReason: 'guessed unit',
          }),
        ],
        templateLookup: steakTemplateLookup(),
      })

      const unmatched = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'Dragonfruit',
            quantity: null,
            unit: null,
            isUncertain: true,
            uncertaintyReason: 'guessed unit',
          }),
        ],
        templateLookup: steakTemplateLookup(),
      })

      expect(matched.rows[0].parseMetadata?.isUncertain).toBe(false)
      expect(matched.rows[0].parseMetadata?.uncertaintyReason).toBeUndefined()
      expect(
        matched.rows[0].parseMetadata?.parseWarnings.some((warning) =>
          warning.startsWith('Uncertain:'),
        ),
      ).toBe(false)
      expect(unmatched.rows[0].parseMetadata?.isUncertain).toBe(true)
      expect(unmatched.rows[0].parseMetadata?.uncertaintyReason).toBe('guessed unit')
    })

    it('uses local calendar expiry matching itemDefaultsFromTemplate, not UTC ISO', () => {
      const today = new Date(2026, 0, 1, 0, 30, 0)
      vi.setSystemTime(today)

      const template = {
        ...steakTemplate,
        defaultExpirationDays: 7,
      }
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'steaks',
            quantity: null,
            unit: null,
            expirationHint: null,
          }),
        ],
        templateLookup: steakTemplateLookup({ defaultExpirationDays: 7 }),
      })

      const expected = itemDefaultsFromTemplate(asItemTemplate(template), today)

      expect(result.rows[0].addData?.purchaseDate).toBe(expected.purchaseDate)
      expect(result.rows[0].addData?.expirationDate).toBe(expected.expirationDate)
      expect(result.rows[0].addData?.purchaseDate).toBe('2026-01-01')
      expect(result.rows[0].addData?.expirationDate).toBe('2026-01-08')

      const isoDate = today.toISOString().split('T')[0]
      if (isoDate !== '2026-01-01') {
        expect(result.rows[0].addData?.purchaseDate).not.toBe(isoDate)
      }
    })

    it('attaches a join addMatch when inventory has one compatible lot', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'Milk',
            quantity: 1,
            unit: 'gallon',
            explicitLocationName: 'fridge',
          }),
        ],
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        inventory: [
          makeInventoryItem({
            id: 'milk-1',
            name: 'Milk',
            quantity: 2,
            unit: 'gal',
            locationId: 'loc-fridge',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].addMatch).toEqual({
        kind: 'join',
        itemId: 'milk-1',
        currentQuantity: 2,
        name: 'Milk',
        unit: 'gal',
      })
    })

    it('attaches lot_choice for undated paste against one dated same-name/place/unit lot', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'beans',
            quantity: 2,
            unit: 'cans',
            explicitLocationName: 'fridge',
          }),
        ],
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        inventory: [
          makeInventoryItem({
            id: 'beans-dated',
            name: 'beans',
            quantity: 3,
            unit: 'can',
            locationId: 'loc-fridge',
            expirationDate: '2026-09-10',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('lot_choice')
      expect(result.rows[0].addMatch).toEqual({
        kind: 'lot_choice',
        candidate: {
          itemId: 'beans-dated',
          name: 'beans',
          locationId: 'loc-fridge',
          quantity: 3,
          unit: 'can',
          expirationDate: '2026-09-10',
        },
      })
    })

    it('attaches ambiguous_match when two same-name/place/unit lots exist', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'beans',
            quantity: 1,
            unit: 'cans',
            explicitLocationName: 'fridge',
          }),
        ],
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        inventory: [
          makeInventoryItem({
            id: 'clone-a',
            name: 'beans',
            quantity: 2,
            unit: 'can',
            locationId: 'loc-fridge',
          }),
          makeInventoryItem({
            id: 'clone-b',
            name: 'beans',
            quantity: 4,
            unit: 'can',
            locationId: 'loc-fridge',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('ambiguous_match')
      expect(result.rows[0].addMatch?.kind).toBe('ambiguous')
      if (result.rows[0].addMatch?.kind === 'ambiguous') {
        expect(result.rows[0].addMatch.candidates.map((candidate) => candidate.itemId)).toEqual([
          'clone-a',
          'clone-b',
        ])
      }
    })

    it('does not attach addMatch when location is still missing', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [makeParsedItem({ name: 'Milk', explicitLocationName: null })],
        inventory: [
          makeInventoryItem({
            id: 'milk-1',
            name: 'Milk',
            quantity: 2,
            unit: 'gallon',
            locationId: 'loc-fridge',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('missing_location')
      expect(result.rows[0].addMatch).toBeUndefined()
    })

    it('attaches new_lot when place is known and no compatible live lot exists', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'Rice',
            quantity: 1,
            unit: 'bag',
            explicitLocationName: 'fridge',
          }),
        ],
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        inventory: [
          makeInventoryItem({
            id: 'milk-1',
            name: 'Milk',
            quantity: 2,
            unit: 'gallon',
            locationId: 'loc-fridge',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].addMatch).toEqual({ kind: 'new_lot' })
    })

    it('matches inventory after template fill of place and name', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'steaks',
            quantity: 2,
            unit: null,
            explicitLocationName: null,
          }),
        ],
        templateLookup: steakTemplateLookup(),
        inventory: [
          makeInventoryItem({
            id: 'steak-1',
            name: 'Steak',
            quantity: 3,
            unit: 'each',
            locationId: 'loc-freezer',
          }),
        ],
      })

      expect(result.rows[0].addData?.name).toBe('Steak')
      expect(result.rows[0].addData?.locationId).toBe('loc-freezer')
      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].addMatch).toEqual({
        kind: 'join',
        itemId: 'steak-1',
        currentQuantity: 3,
        name: 'Steak',
        unit: 'each',
      })
    })

    it('keeps lot_choice for undated paste when a template would stamp expiry against one dated live lot', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({
            name: 'beans',
            quantity: 2,
            unit: 'cans',
            explicitLocationName: 'fridge',
            expirationHint: null,
          }),
        ],
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        templateLookup: new Map([
          [
            'beans',
            {
              id: 'template-beans',
              name: 'beans',
              defaultUnit: 'cans',
              defaultQuantity: 1,
              defaultStorageLocationId: 'loc-fridge',
              defaultExpirationDays: 7,
            },
          ],
        ]),
        inventory: [
          makeInventoryItem({
            id: 'beans-dated',
            name: 'beans',
            quantity: 3,
            unit: 'can',
            locationId: 'loc-fridge',
            expirationDate: '2026-09-10',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('lot_choice')
      expect(result.rows[0].addMatch).toEqual({
        kind: 'lot_choice',
        candidate: {
          itemId: 'beans-dated',
          name: 'beans',
          locationId: 'loc-fridge',
          quantity: 3,
          unit: 'can',
          expirationDate: '2026-09-10',
        },
      })
      expect(result.rows[0].addData?.expirationDate).toBe('2026-05-04')
      expect(result.rows[0].addData?.pasteExpirationDate).toBeNull()

      const rematched = applyAddLotMatchToRow(result.rows[0], [
        makeInventoryItem({
          id: 'beans-dated',
          name: 'beans',
          quantity: 3,
          unit: 'can',
          locationId: 'loc-fridge',
          expirationDate: '2026-09-10',
        }),
      ])
      expect(rematched.status).toBe('lot_choice')
      expect(rematched.addMatch?.kind).toBe('lot_choice')
      expect(rematched.addData?.expirationDate).toBe('2026-05-04')
    })
  })

  describe('remove-mode normalization', () => {
    it('routes through remove matching with existing inventory', () => {
      const items = [makeParsedItem({ name: 'Milk', quantity: 1, unit: 'gallon' })]
      const inventory = [
        makeInventoryItem({
          id: 'item-milk',
          name: 'Milk',
          quantity: 2,
          unit: 'gallon',
        }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'remove',
        parsedItems: items,
        inventory,
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].operation).toBe('remove')
      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].removeData?.type).toBe('resolved')
      if (result.rows[0].removeData?.type === 'resolved') {
        expect(result.rows[0].removeData.matchedItemId).toBe('item-milk')
        expect(result.rows[0].removeData.removeQuantity).toBe(1)
      }
    })

    it('marks ambiguous remove matches as ambiguous_match', () => {
      const items = [makeParsedItem({ name: 'Milk', quantity: 1, unit: 'gallon' })]
      const inventory = [
        makeInventoryItem({
          id: 'item-whole-milk',
          name: 'Whole Milk',
          quantity: 2,
          unit: 'gallon',
        }),
        makeInventoryItem({
          id: 'item-oat-milk',
          name: 'Oat Milk',
          quantity: 1,
          unit: 'gallon',
        }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'remove',
        parsedItems: items,
        inventory,
      })

      expect(result.rows[0].status).toBe('ambiguous_match')
      expect(result.rows[0].removeData?.type).toBe('unresolved')
    })

    it('marks no-match remove rows as no_match', () => {
      const items = [makeParsedItem({ name: 'Unobtainium', quantity: 1, unit: 'each' })]
      const inventory: Item[] = []

      const result = normalizeParsedTextToReviewRows({
        operation: 'remove',
        parsedItems: items,
        inventory,
      })

      expect(result.rows[0].status).toBe('no_match')
      expect(result.rows[0].removeData?.type).toBe('unresolved')
    })

    it('uses the same removeData mapping as applyRemoveMatch', () => {
      const items = [makeParsedItem({ name: 'Milk', quantity: 2, unit: 'gallon' })]
      const inventory = [
        makeInventoryItem({
          id: 'item-milk',
          name: 'Milk',
          quantity: 5,
          unit: 'gallon',
        }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'remove',
        parsedItems: items,
        inventory,
      })
      const applied = applyRemoveMatch('Milk', inventory, 2)

      expect(result.rows[0].status).toBe(applied.status)
      expect(result.rows[0].removeData).toEqual(applied.removeData)
    })

    it('does not apply template fill to remove items', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'remove',
        parsedItems: [
          makeParsedItem({
            name: 'steaks',
            quantity: 2,
            unit: null,
            isUncertain: true,
            uncertaintyReason: 'guessed',
          }),
        ],
        inventory: [],
        templateLookup: steakTemplateLookup(),
      })

      expect(result.rows[0].operation).toBe('remove')
      expect(result.rows[0].addData).toBeUndefined()
      expect(result.rows[0].status).toBe('no_match')
      expect(result.rows[0].removeData).toMatchObject({
        type: 'unresolved',
        requestedName: 'steaks',
        removeQuantity: 2,
      })
      expect(result.rows[0].parseMetadata?.isUncertain).toBe(true)
    })
  })

  describe('uncertain receipt rows', () => {
    it('keeps uncertain rows visible with parse metadata', () => {
      const items = [
        makeParsedItem({
          name: 'Orgnc',
          quantity: 1,
          unit: null,
          sourceLine: 'orgnc      2.99',
          isUncertain: true,
          uncertaintyReason: 'Abbreviated item name',
        }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].parseMetadata?.isUncertain).toBe(true)
      expect(result.rows[0].parseMetadata?.sourceLine).toBe('orgnc      2.99')
      expect(result.rows[0].parseMetadata?.uncertaintyReason).toBe('Abbreviated item name')
      expect(
        result.rows[0].parseMetadata?.parseWarnings.some((warning) =>
          warning.startsWith('Uncertain:'),
        ),
      ).toBe(false)
    })

    it('includes parse warnings from uncertain rows in result warnings', () => {
      const items = [
        makeParsedItem({
          name: 'Ketchup',
          quantity: 1,
          unit: 'bottle',
          isUncertain: false,
        }),
        makeParsedItem({
          name: 'Orgnc',
          quantity: 1,
          unit: null,
          isUncertain: true,
          uncertaintyReason: 'Abbreviated name may be incorrect',
        }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
      })

      expect(result.rows[1]?.parseMetadata?.isUncertain).toBe(true)
      expect(result.rows[1]?.parseMetadata?.uncertaintyReason).toBe(
        'Abbreviated name may be incorrect',
      )
      expect(result.warnings.some((warning) => warning.startsWith('Uncertain:'))).toBe(false)
      expect(
        result.rows.some((row) =>
          row.parseMetadata?.parseWarnings.some((warning) => warning.startsWith('Uncertain:')),
        ),
      ).toBe(false)
    })
  })

  describe('accounting line filtering', () => {
    it('ignores tax lines', () => {
      const items = [
        makeParsedItem({
          name: 'Milk',
          quantity: 1,
          unit: 'gallon',
          sourceLine: 'Milk 1gal        4.99',
        }),
        makeParsedItem({
          name: 'Tax',
          quantity: null,
          unit: null,
          sourceLine: 'TAX              0.42',
          isUncertain: true,
          uncertaintyReason: 'Accounting line',
        }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].addData?.name).toBe('Milk')
    })

    it('ignores total and payment lines', () => {
      const items = [
        makeParsedItem({
          name: 'Bread',
          quantity: 1,
          unit: 'loaf',
        }),
        makeParsedItem({
          name: 'TOTAL',
          quantity: null,
          unit: null,
          sourceLine: 'TOTAL           12.45',
          isUncertain: true,
          uncertaintyReason: 'Accounting line',
        }),
        makeParsedItem({
          name: 'Payment',
          quantity: null,
          unit: null,
          sourceLine: 'VISA ****1234   12.45',
          isUncertain: true,
          uncertaintyReason: 'Payment line',
        }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].addData?.name).toBe('Bread')
    })

    it('keeps item names that start with accounting keywords', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [
          makeParsedItem({ name: 'Cashew' }),
          makeParsedItem({ name: 'Total cereal' }),
          makeParsedItem({ name: 'Total', quantity: null, unit: null }),
          makeParsedItem({ name: 'Tax', quantity: null, unit: null }),
          makeParsedItem({ name: 'Tax 1.20', quantity: null, unit: null }),
          makeParsedItem({ name: 'Total 12.34', quantity: null, unit: null }),
        ],
      })

      expect(result.rows.map((row) => row.addData?.name)).toEqual(['Cashew', 'Total cereal'])
    })
  })

  describe('empty and total-failure cases', () => {
    it('returns zero rows and a warning when all items are accounting lines', () => {
      const items = [
        makeParsedItem({
          name: 'SUBTOTAL',
          quantity: null,
          unit: null,
          sourceLine: 'SUBTOTAL        9.99',
          isUncertain: true,
          uncertaintyReason: 'Accounting line',
        }),
        makeParsedItem({
          name: 'TAX',
          quantity: null,
          unit: null,
          sourceLine: 'TAX              0.82',
          isUncertain: true,
          uncertaintyReason: 'Accounting line',
        }),
      ]

      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: items,
      })

      expect(result.rows).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThanOrEqual(1)
    })

    it('returns empty rows array for empty parsed items', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'add',
        parsedItems: [],
      })

      expect(result.rows).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })
  })
})
