import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeParsedImageToReviewRows } from '@/lib/ai/image-scan-normalizer'
import { applyRemoveMatch } from '@/lib/batch/remove-matching'
import { itemDefaultsFromTemplate } from '@/lib/inventory/restock-from-template'
import type { ParsedImageItem, ParsedImageResult } from '@/types/ai-image-scan'
import type { Item } from '@/types/item'
import type { ItemTemplate } from '@/types/template'

function makeParsedImageItem(overrides: Partial<ParsedImageItem> = {}): ParsedImageItem {
  return {
    name: 'Milk',
    quantity: null,
    unit: null,
    categoryName: null,
    explicitLocationName: null,
    expirationHint: null,
    isUncertain: false,
    uncertaintyReason: null,
    notes: null,
    ...overrides,
  }
}

function makeParsedImageResult(overrides: Partial<ParsedImageResult> = {}): ParsedImageResult {
  return {
    items: [],
    skippedObjects: [],
    imageSummary: 'groceries on counter',
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

describe('normalizeParsedImageToReviewRows', () => {
  describe('add mode', () => {
    it('maps reliable basics into add rows with template defaults', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Milk', quantity: 2, unit: 'gallon' })],
        }),
        templateLookup: new Map([
          [
            'milk',
            {
              id: 'tpl-milk',
              name: 'Milk',
              categoryId: 'cat-dairy',
              defaultUnit: 'each',
              defaultQuantity: 1,
              defaultStorageLocationId: 'loc-fridge',
              defaultExpirationDays: 14,
            },
          ],
        ]),
      })

      expect(result.rows).toHaveLength(1)
      const row = result.rows[0]
      expect(row.operation).toBe('add')
      expect(row.addData?.name).toBe('Milk')
      expect(row.addData?.quantity).toBe(2)
      expect(row.addData?.unit).toBe('gal')
      expect(row.addData?.templateId).toBe('tpl-milk')
      expect(row.addData?.categoryId).toBe('cat-dairy')
      expect(row.addData?.locationId).toBe('loc-fridge')
    })

    it('fills notes with brand/package detail when present', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Soda', notes: 'Coca-Cola 12-pack' })],
        }),
      })

      expect(result.rows[0].addData?.notes).toBe('Coca-Cola 12-pack')
    })

    it('uses template defaults when parsed fields are absent', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Eggs' })],
        }),
        templateLookup: new Map([
          [
            'eggs',
            {
              id: 'tpl-eggs',
              name: 'Eggs',
              categoryId: 'cat-dairy',
              defaultUnit: 'dozen',
              defaultQuantity: 1,
              defaultStorageLocationId: 'loc-fridge',
              defaultExpirationDays: 21,
            },
          ],
        ]),
      })

      expect(result.rows[0].addData?.quantity).toBe(1)
      expect(result.rows[0].addData?.unit).toBe('dozen')
    })

    it('marks missing_location when no location resolved and no template default', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Banana', quantity: 1, unit: 'each' })],
        }),
      })

      expect(result.rows[0].status).toBe('missing_location')
    })

    it('does not invent 1 / each when photo omits quantity and unit and no template matches', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Rice',
              quantity: null,
              unit: null,
              explicitLocationName: 'pantry',
            }),
          ],
        }),
        locationLookup: new Map([['pantry', 'loc-pantry']]),
      })

      expect(result.rows[0].status).toBe('missing_quantity')
      expect(result.rows[0].addData?.quantity).not.toBe(1)
      expect(result.rows[0].addData?.unit).not.toBe('each')
      expect(result.rows[0].addData?.locationId).toBe('loc-pantry')
    })

    it('does not invent each when photo has quantity but omits unit and no template matches', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Rice',
              quantity: 2,
              unit: null,
              explicitLocationName: 'pantry',
            }),
          ],
        }),
        locationLookup: new Map([['pantry', 'loc-pantry']]),
      })

      expect(result.rows[0].status).toBe('missing_unit')
      expect(result.rows[0].addData?.quantity).toBe(2)
      expect(result.rows[0].addData?.unit).not.toBe('each')
      expect(result.rows[0].addData?.locationId).toBe('loc-pantry')
    })
  })

  describe('fill order', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-27T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('keeps extracted photo qty 2 over template default 1', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'steaks',
              quantity: 2,
              unit: null,
              isUncertain: false,
            }),
          ],
        }),
        templateLookup: steakTemplateLookup({ defaultQuantity: 1 }),
      })

      expect(result.rows[0].addData?.quantity).toBe(2)
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('fills omitted unit, place, qty, and expiry from a matching template and canonicalizes name', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'steaks',
              quantity: null,
              unit: null,
              explicitLocationName: null,
              expirationHint: null,
            }),
          ],
        }),
        templateLookup: steakTemplateLookup(),
      })

      expect(result.rows[0].addData).toMatchObject({
        name: 'Steak',
        quantity: 1,
        unit: 'each',
        locationId: 'loc-freezer',
        templateId: 'template-steak',
      })
      expect(result.rows[0].addData?.expirationDate).toBe('2026-05-04')
      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('keeps a dated photo expiry and fills omitted unit, place, and qty from the template', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'steaks',
              quantity: null,
              unit: null,
              explicitLocationName: null,
              expirationHint: '2026-05-01',
              isUncertain: false,
            }),
          ],
        }),
        templateLookup: steakTemplateLookup(),
      })

      expect(result.rows[0].addData?.expirationDate).toBe('2026-05-01')
      expect(result.rows[0].addData?.quantity).toBe(1)
      expect(result.rows[0].addData?.unit).toBe('each')
      expect(result.rows[0].addData?.locationId).toBe('loc-freezer')
      expect(result.rows[0].addData?.name).toBe('Steak')
      expect(result.rows[0].status).toBe('ready')
    })

    it('lets guessed qty, unit, and expiry lose to a matching template and clears isUncertain', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'steaks',
              quantity: 2,
              unit: 'gallon',
              expirationHint: '2026-05-01',
              isUncertain: true,
              uncertaintyReason: 'guessed from photo',
            }),
          ],
        }),
        templateLookup: steakTemplateLookup({
          defaultQuantity: 1,
          defaultUnit: 'each',
          defaultExpirationDays: 7,
        }),
      })

      expect(result.rows[0].addData?.quantity).toBe(1)
      expect(result.rows[0].addData?.unit).toBe('each')
      expect(result.rows[0].addData?.expirationDate).toBe('2026-05-04')
      expect(result.rows[0].parseMetadata?.isUncertain).toBe(false)
    })

    it('clears Uncertain copy when a matching template fills a guessed row', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'steaks',
              quantity: 2,
              unit: 'gallon',
              expirationHint: '2026-05-01',
              isUncertain: true,
              uncertaintyReason: 'guessed from photo',
            }),
          ],
        }),
        templateLookup: steakTemplateLookup({
          defaultQuantity: 1,
          defaultUnit: 'each',
          defaultExpirationDays: 7,
        }),
      })

      expect(result.rows[0].parseMetadata?.isUncertain).toBe(false)
      expect(result.rows[0].parseMetadata?.uncertaintyReason).toBeUndefined()
      expect(
        result.rows[0].parseMetadata?.parseWarnings.some((warning) =>
          warning.startsWith('Uncertain:'),
        ),
      ).toBe(false)
    })

    it('sets pasteExpirationDate null when uncertain or missing a valid hint, and the seen date when certain', () => {
      const uncertain = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Milk',
              expirationHint: '2026-05-01',
              isUncertain: true,
              uncertaintyReason: 'guessed expiry',
            }),
          ],
        }),
      })
      const noHint = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Milk', expirationHint: null, isUncertain: false })],
        }),
      })
      const invalidHint = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Milk',
              expirationHint: 'soon',
              isUncertain: false,
            }),
          ],
        }),
      })
      const certain = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'steaks',
              expirationHint: '2026-05-01',
              isUncertain: false,
            }),
          ],
        }),
        templateLookup: steakTemplateLookup(),
      })

      expect(uncertain.rows[0].addData?.pasteExpirationDate).toBeNull()
      expect(noHint.rows[0].addData?.pasteExpirationDate).toBeNull()
      expect(invalidHint.rows[0].addData?.pasteExpirationDate).toBeNull()
      expect(certain.rows[0].addData?.pasteExpirationDate).toBe('2026-05-01')
    })

    it('leaves location empty and missing_location when the template has no usual place', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'steaks',
              explicitLocationName: null,
            }),
          ],
        }),
        templateLookup: steakTemplateLookup({ defaultStorageLocationId: undefined }),
      })

      expect(result.rows[0].addData?.locationId).toBe('')
      expect(result.rows[0].status).toBe('missing_location')
    })

    it('keeps model isUncertain and guessed fields when no template matches', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Dragonfruit',
              quantity: 2,
              unit: 'gallon',
              expirationHint: '2026-05-01',
              isUncertain: true,
              uncertaintyReason: 'guessed quantity',
            }),
          ],
        }),
        templateLookup: steakTemplateLookup(),
      })

      expect(result.rows[0].addData?.quantity).toBe(2)
      expect(result.rows[0].addData?.unit).toBe('gal')
      expect(result.rows[0].addData?.expirationDate).toBe('2026-05-01')
      expect(result.rows[0].parseMetadata?.isUncertain).toBe(true)
      expect(result.rows[0].parseMetadata?.uncertaintyReason).toBe('guessed quantity')
      expect(
        result.rows[0].parseMetadata?.parseWarnings.some((warning) =>
          warning.startsWith('Uncertain:'),
        ),
      ).toBe(false)
    })

    it('keeps photo notes after template fill', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'steaks',
              notes: 'Ribeye family pack',
            }),
          ],
        }),
        templateLookup: steakTemplateLookup(),
      })

      expect(result.rows[0].addData?.notes).toBe('Ribeye family pack')
    })

    it('uses local calendar expiry matching itemDefaultsFromTemplate, not UTC ISO', () => {
      const today = new Date(2026, 0, 1, 0, 30, 0)
      vi.setSystemTime(today)

      const template = {
        ...steakTemplate,
        defaultExpirationDays: 7,
      }
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'steaks',
              quantity: null,
              unit: null,
              expirationHint: null,
            }),
          ],
        }),
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

    it('does not import formatDate, toISOString, or calculateExpirationDate for add fill', () => {
      const source = readFileSync('lib/ai/image-scan-normalizer.ts', 'utf8')

      expect(source).not.toMatch(/\bformatDate\b/)
      expect(source).not.toMatch(/\btoISOString\b/)
      expect(source).not.toMatch(/\bcalculateExpirationDate\b/)
    })

    it('does not template-fill remove items', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'remove',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'steaks', quantity: 2, unit: 'gallon' })],
        }),
        templateLookup: steakTemplateLookup(),
        inventory: [],
      })

      expect(result.rows[0].operation).toBe('remove')
      expect(result.rows[0].addData).toBeUndefined()
      expect(result.rows[0].status).toBe('no_match')
      expect(result.rows[0].removeData).toMatchObject({
        type: 'unresolved',
        requestedName: 'steaks',
        removeQuantity: 2,
      })
      expect(result.rows[0].source.source).toBe('ai_image')
    })
  })

  describe('scan-time add match', () => {
    it('joins a photo add onto one compatible undated live lot', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Milk',
              quantity: 1,
              unit: 'gal',
              explicitLocationName: 'fridge',
              expirationHint: null,
              isUncertain: false,
            }),
          ],
        }),
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        inventory: [
          makeInventoryItem({
            id: 'milk-live',
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
        itemId: 'milk-live',
        currentQuantity: 2,
        name: 'Milk',
        unit: 'gal',
      })
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('attaches new_lot when photo expiry differs from the live lot', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Milk',
              quantity: 1,
              unit: 'gal',
              explicitLocationName: 'fridge',
              expirationHint: '2026-05-01',
              isUncertain: false,
            }),
          ],
        }),
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        inventory: [
          makeInventoryItem({
            id: 'milk-live',
            name: 'Milk',
            quantity: 2,
            unit: 'gal',
            locationId: 'loc-fridge',
            expirationDate: '2026-06-01',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].addMatch).toEqual({ kind: 'new_lot' })
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('attaches new_lot when photo unit differs from the live lot', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Milk',
              quantity: 1,
              unit: 'gal',
              explicitLocationName: 'fridge',
              expirationHint: null,
              isUncertain: false,
            }),
          ],
        }),
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        inventory: [
          makeInventoryItem({
            id: 'milk-live',
            name: 'Milk',
            quantity: 2,
            unit: 'gallon',
            locationId: 'loc-fridge',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].addMatch).toEqual({ kind: 'new_lot' })
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('attaches lot_choice when photo omits expiry against one dated live lot', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Milk',
              quantity: 1,
              unit: 'gal',
              explicitLocationName: 'fridge',
              expirationHint: null,
              isUncertain: false,
            }),
          ],
        }),
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        inventory: [
          makeInventoryItem({
            id: 'milk-dated',
            name: 'Milk',
            quantity: 2,
            unit: 'gal',
            locationId: 'loc-fridge',
            expirationDate: '2026-06-01',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('lot_choice')
      expect(result.rows[0].addData?.pasteExpirationDate).toBeNull()
      expect(result.rows[0].addMatch).toEqual({
        kind: 'lot_choice',
        candidate: {
          itemId: 'milk-dated',
          name: 'Milk',
          locationId: 'loc-fridge',
          quantity: 2,
          unit: 'gal',
          expirationDate: '2026-06-01',
        },
      })
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('attaches ambiguous_match when two live lots share name, place, and unit', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Milk',
              quantity: 1,
              unit: 'gal',
              explicitLocationName: 'fridge',
            }),
          ],
        }),
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        inventory: [
          makeInventoryItem({
            id: 'milk-a',
            name: 'Milk',
            quantity: 2,
            unit: 'gal',
            locationId: 'loc-fridge',
          }),
          makeInventoryItem({
            id: 'milk-b',
            name: 'Milk',
            quantity: 4,
            unit: 'gal',
            locationId: 'loc-fridge',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('ambiguous_match')
      expect(result.rows[0].addMatch?.kind).toBe('ambiguous')
      if (result.rows[0].addMatch?.kind === 'ambiguous') {
        expect(result.rows[0].addMatch.candidates.map((candidate) => candidate.itemId)).toEqual([
          'milk-a',
          'milk-b',
        ])
      }
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('does not attach addMatch when location is still missing after fill', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Milk',
              quantity: 1,
              unit: 'gal',
              explicitLocationName: null,
            }),
          ],
        }),
        inventory: [
          makeInventoryItem({
            id: 'milk-live',
            name: 'Milk',
            quantity: 2,
            unit: 'gal',
            locationId: 'loc-fridge',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('missing_location')
      expect(result.rows[0].addMatch).toBeUndefined()
    })

    it('keeps extracted photo qty on a compatible join over template default', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Milk',
              quantity: 2,
              unit: 'gal',
              explicitLocationName: 'fridge',
              expirationHint: null,
              isUncertain: false,
            }),
          ],
        }),
        locationLookup: new Map([['fridge', 'loc-fridge']]),
        templateLookup: new Map([
          [
            'milk',
            {
              id: 'tpl-milk',
              name: 'Milk',
              categoryId: 'cat-dairy',
              defaultUnit: 'gal',
              defaultQuantity: 1,
              defaultStorageLocationId: 'loc-fridge',
              defaultExpirationDays: 14,
            },
          ],
        ]),
        inventory: [
          makeInventoryItem({
            id: 'milk-live',
            name: 'Milk',
            quantity: 2,
            unit: 'gal',
            locationId: 'loc-fridge',
          }),
        ],
      })

      expect(result.rows[0].addData?.quantity).toBe(2)
      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].addMatch).toEqual({
        kind: 'join',
        itemId: 'milk-live',
        currentQuantity: 2,
        name: 'Milk',
        unit: 'gal',
      })
      expect(result.rows[0].source.source).toBe('ai_image')
    })
  })

  describe('remove mode', () => {
    it('routes resolved matches to ready rows', () => {
      const inventory: Item[] = [
        {
          id: 'item-milk',
          name: 'Milk',
          quantity: 3,
          unit: 'gallon',
          locationId: 'loc-fridge',
          categoryId: 'cat-dairy',
          createdAt: '2024-01-01',
        } as Item,
      ]

      const result = normalizeParsedImageToReviewRows({
        operation: 'remove',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Milk', quantity: 1 })],
        }),
        inventory,
      })

      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].removeData?.type).toBe('resolved')
    })

    it('routes ambiguous matches to ambiguous_match rows', () => {
      const inventory: Item[] = [
        {
          id: 'item-milk-1',
          name: 'Milk',
          quantity: 3,
          unit: 'gallon',
          locationId: 'loc-fridge',
          categoryId: 'cat-dairy',
          createdAt: '2024-01-01',
        } as Item,
        {
          id: 'item-milk-2',
          name: 'Milk',
          quantity: 1,
          unit: 'gallon',
          locationId: 'loc-fridge',
          categoryId: 'cat-dairy',
          createdAt: '2024-01-01',
        } as Item,
      ]

      const result = normalizeParsedImageToReviewRows({
        operation: 'remove',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Milk' })],
        }),
        inventory,
      })

      expect(result.rows[0].status).toBe('ambiguous_match')
    })

    it('routes no_match to no_match rows', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'remove',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Dragonfruit' })],
        }),
        inventory: [],
      })

      expect(result.rows[0].status).toBe('no_match')
    })
  })

  describe('scan-time remove match', () => {
    it('resolves photo Milk qty 2 against one live Milk via applyRemoveMatch', () => {
      const inventory = [
        makeInventoryItem({
          id: 'item-milk',
          name: 'Milk',
          quantity: 5,
          unit: 'gal',
          locationId: 'loc-fridge',
        }),
      ]

      const result = normalizeParsedImageToReviewRows({
        operation: 'remove',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Milk', quantity: 2 })],
        }),
        inventory,
      })
      const applied = applyRemoveMatch('Milk', inventory, 2)

      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].status).toBe(applied.status)
      expect(result.rows[0].removeData).toEqual(applied.removeData)
      expect(result.rows[0].removeData).toMatchObject({
        type: 'resolved',
        matchedItemId: 'item-milk',
        currentQuantity: 5,
        removeQuantity: 2,
      })
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('marks two close names as ambiguous_match and unresolved', () => {
      const inventory = [
        makeInventoryItem({
          id: 'item-whole-milk',
          name: 'Whole Milk',
          quantity: 2,
          unit: 'gal',
        }),
        makeInventoryItem({
          id: 'item-oat-milk',
          name: 'Oat Milk',
          quantity: 1,
          unit: 'gal',
        }),
      ]

      const result = normalizeParsedImageToReviewRows({
        operation: 'remove',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Milk', quantity: 1 })],
        }),
        inventory,
      })
      const applied = applyRemoveMatch('Milk', inventory, 1)

      expect(result.rows[0].status).toBe('ambiguous_match')
      expect(result.rows[0].removeData?.type).toBe('unresolved')
      expect(result.rows[0].status).toBe(applied.status)
      expect(result.rows[0].removeData).toEqual(applied.removeData)
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('marks unknown name against non-empty inventory as no_match', () => {
      const inventory = [
        makeInventoryItem({
          id: 'item-bread',
          name: 'Bread',
          quantity: 1,
          unit: 'loaf',
        }),
      ]

      const result = normalizeParsedImageToReviewRows({
        operation: 'remove',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Dragonfruit', quantity: 1 })],
        }),
        inventory,
      })

      expect(result.rows[0].status).toBe('no_match')
      expect(result.rows[0].removeData).toMatchObject({
        type: 'unresolved',
        requestedName: 'Dragonfruit',
        removeQuantity: 1,
        candidates: [],
      })
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('marks empty inventory as no_match at the normalizer', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'remove',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Milk', quantity: 2 })],
        }),
        inventory: [],
      })

      expect(result.rows[0].status).toBe('no_match')
      expect(result.rows[0].removeData).toMatchObject({
        type: 'unresolved',
        requestedName: 'Milk',
        removeQuantity: 2,
        candidates: [],
      })
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('uses applyRemoveMatch and does not wire matchRemoveRow locally', () => {
      const source = readFileSync('lib/ai/image-scan-normalizer.ts', 'utf8')
      const shared = readFileSync('lib/ai/review-row-build.ts', 'utf8')

      expect(shared).toMatch(/\bapplyRemoveMatch\b/)
      expect(source).not.toMatch(/\bmatchRemoveRow\b/)
    })
  })

  describe('uncertainty and skipped objects', () => {
    it('preserves uncertainty metadata', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [
            makeParsedImageItem({
              name: 'Cheese',
              isUncertain: true,
              uncertaintyReason: 'unclear label',
            }),
          ],
        }),
      })

      expect(result.rows[0].parseMetadata?.isUncertain).toBe(true)
      expect(result.rows[0].parseMetadata?.uncertaintyReason).toBe('unclear label')
      expect(
        result.rows[0].parseMetadata?.parseWarnings.some((warning) =>
          warning.startsWith('Uncertain:'),
        ),
      ).toBe(false)
      expect(result.warnings.some((warning) => warning.startsWith('Uncertain:'))).toBe(false)
    })

    it('surfaces skipped objects as warnings', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Apple' })],
          skippedObjects: [{ name: 'Toy', reason: 'not food' }],
        }),
      })

      expect(result.warnings).toContain('Skipped object: Toy — not food')
    })
  })

  describe('source type', () => {
    it('sets source type to ai_image and raw descriptor', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: makeParsedImageResult({
          items: [makeParsedImageItem({ name: 'Bread' })],
        }),
      })

      expect(result.rows[0].source.source).toBe('ai_image')
      expect(result.rows[0].source.raw).toBe('Bread')
      expect(result.rows[0].parseMetadata?.sourceLine).toBe('groceries on counter')
    })
  })
})
