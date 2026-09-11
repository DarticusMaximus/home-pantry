import { existsSync, readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParsedReviewFields } from '@/lib/ai/review-row-build'
import {
  createAddReviewRow,
  createRemoveReviewRow,
  resolveCategory,
  resolveLocation,
} from '@/lib/ai/review-row-build'
import type { BatchRowParseMetadata, BatchSource } from '@/types/batch-review'
import type { Item } from '@/types/item'

function makeFields(overrides: Partial<ParsedReviewFields> = {}): ParsedReviewFields {
  return {
    name: 'Rice',
    quantity: null,
    unit: null,
    categoryName: null,
    explicitLocationName: 'pantry',
    expirationHint: null,
    isUncertain: false,
    ...overrides,
  }
}

const addSource: BatchSource = { source: 'ai_text', raw: 'Rice' }
const parseMetadata: BatchRowParseMetadata = { parseWarnings: [], isUncertain: false }

function makeInventoryItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-milk',
    name: 'Milk',
    quantity: 2,
    unit: 'gallon',
    locationId: 'loc-fridge',
    createdById: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('resolveLocation', () => {
  it('matches a cued name against lowercase map keys', () => {
    expect(resolveLocation('Fridge', new Map([['fridge', 'loc-1']]))).toBe('loc-1')
  })

  it('lowercases map keys while iterating', () => {
    expect(resolveLocation('fridge', new Map([['Fridge', 'loc-1']]))).toBe('loc-1')
  })

  it('returns empty when the name or map is missing', () => {
    expect(resolveLocation(null, new Map([['fridge', 'loc-1']]))).toBe('')
    expect(resolveLocation('Fridge')).toBe('')
  })

  it('returns empty for an unknown cue', () => {
    expect(resolveLocation('Freezer', new Map([['fridge', 'loc-1']]))).toBe('')
  })
})

describe('resolveCategory', () => {
  it('looks up a lowercased name against lowercase keys', () => {
    expect(resolveCategory('Dairy', new Map([['dairy', 'cat-1']]))).toBe('cat-1')
  })

  it('does not lowercase map keys', () => {
    expect(resolveCategory('Dairy', new Map([['Dairy', 'cat-1']]))).toBeUndefined()
  })
})

describe('createAddReviewRow', () => {
  it('keeps missing qty/unit unresolved when a place is known and no template fills them', () => {
    const row = createAddReviewRow({
      item: makeFields(),
      idPrefix: 'parse',
      source: addSource,
      parseMetadata,
      locationLookup: new Map([['pantry', 'loc-pantry']]),
    })

    expect(row.status).toBe('missing_quantity')
    expect(row.addData?.quantity).not.toBe(1)
    expect(row.addData?.unit).not.toBe('each')
  })

  it('copies notes when present and leaves them undefined when omitted', () => {
    const withNotes = createAddReviewRow({
      item: makeFields({ notes: 'Coca-Cola 12-pack' }),
      idPrefix: 'img',
      source: { source: 'ai_image', raw: 'Rice' },
      parseMetadata,
      locationLookup: new Map([['pantry', 'loc-pantry']]),
    })
    expect(withNotes.addData?.notes).toBe('Coca-Cola 12-pack')

    const withoutNotes = createAddReviewRow({
      item: makeFields(),
      idPrefix: 'img',
      source: { source: 'ai_image', raw: 'Rice' },
      parseMetadata,
      locationLookup: new Map([['pantry', 'loc-pantry']]),
    })
    expect(withoutNotes.addData?.notes).toBeUndefined()
  })
})

describe('createAddReviewRow unit coercion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves a read off-list unit by alias and never by template default', () => {
    const row = createAddReviewRow({
      item: makeFields({ name: 'Milk', quantity: 1, unit: 'gallons' }),
      idPrefix: 'parse',
      source: addSource,
      parseMetadata,
      locationLookup: new Map([['pantry', 'loc-pantry']]),
      templateLookup: new Map([
        [
          'milk',
          {
            id: 'template-milk',
            name: 'Milk',
            defaultUnit: 'qt',
            defaultQuantity: 4,
          },
        ],
      ]),
    })

    expect(row.addData?.unit).toBe('gal')
    expect(row.addData?.quantity).toBe(1)
    expect(row.parseMetadata?.isUncertain).toBe(false)
    expect(row.parseMetadata?.parseWarnings).toEqual([])
  })

  it('keeps each and the read quantity with the reason as a warning when a template matches but has no alias', () => {
    const row = createAddReviewRow({
      item: makeFields({ name: 'Bread', quantity: 1, unit: 'slices' }),
      idPrefix: 'parse',
      source: addSource,
      parseMetadata,
      locationLookup: new Map([['pantry', 'loc-pantry']]),
      templateLookup: new Map([
        [
          'bread',
          {
            id: 'template-bread',
            name: 'Bread',
            defaultUnit: 'bag',
            defaultQuantity: 2,
          },
        ],
      ]),
    })

    expect(row.addData?.unit).toBe('each')
    expect(row.addData?.quantity).toBe(1)
    expect(row.parseMetadata?.isUncertain).toBe(false)
    expect(row.parseMetadata?.uncertaintyReason).toBeUndefined()
    expect(row.parseMetadata?.parseWarnings).toEqual([
      'Unit "slices" is not a known unit — set to each',
    ])
  })

  it('flags uncertainty with the coercion reason when no template matches', () => {
    const row = createAddReviewRow({
      item: makeFields({ name: 'Dragonfruit', quantity: 3, unit: 'slices' }),
      idPrefix: 'parse',
      source: addSource,
      parseMetadata,
      locationLookup: new Map([['pantry', 'loc-pantry']]),
    })

    expect(row.addData?.unit).toBe('each')
    expect(row.addData?.quantity).toBe(3)
    expect(row.status).toBe('ready')
    expect(row.parseMetadata?.isUncertain).toBe(true)
    expect(row.parseMetadata?.uncertaintyReason).toBe(
      'Unit "slices" is not a known unit — set to each',
    )
    expect(row.parseMetadata?.parseWarnings).toEqual([
      'Unit "slices" is not a known unit — set to each',
    ])
  })

  it('still applies template defaults to a guessed off-list unit and keeps the coercion warning', () => {
    const row = createAddReviewRow({
      item: makeFields({ name: 'Milk', quantity: 3, unit: 'slices', isUncertain: true }),
      idPrefix: 'parse',
      source: addSource,
      parseMetadata: { parseWarnings: [], isUncertain: true, uncertaintyReason: 'guessed unit' },
      locationLookup: new Map([['pantry', 'loc-pantry']]),
      templateLookup: new Map([
        [
          'milk',
          {
            id: 'template-milk',
            name: 'Milk',
            defaultUnit: 'bag',
            defaultQuantity: 2,
            defaultExpirationDays: 7,
          },
        ],
      ]),
    })

    expect(row.addData?.unit).toBe('bag')
    expect(row.addData?.quantity).toBe(2)
    expect(row.addData?.expirationDate).toBe('2026-05-04')
    expect(row.parseMetadata?.isUncertain).toBe(false)
    expect(row.parseMetadata?.uncertaintyReason).toBeUndefined()
    expect(row.parseMetadata?.parseWarnings).toEqual([
      'Unit "slices" is not a known unit — set to each',
    ])
  })

  it('passes an on-list unit through and resolves categoryName via categoryLookup', () => {
    const row = createAddReviewRow({
      item: makeFields({ name: 'Yogurt', quantity: 2, unit: 'CUP', categoryName: 'Dairy' }),
      idPrefix: 'parse',
      source: addSource,
      parseMetadata,
      locationLookup: new Map([['pantry', 'loc-pantry']]),
      categoryLookup: new Map([['dairy', 'cat-dairy']]),
    })

    expect(row.addData?.unit).toBe('cup')
    expect(row.addData?.categoryId).toBe('cat-dairy')
    expect(row.parseMetadata?.parseWarnings).toEqual([])

    const unmatched = createAddReviewRow({
      item: makeFields({ name: 'Yogurt', quantity: 2, unit: 'cup', categoryName: 'Mystery' }),
      idPrefix: 'parse',
      source: addSource,
      parseMetadata,
      locationLookup: new Map([['pantry', 'loc-pantry']]),
      categoryLookup: new Map([['dairy', 'cat-dairy']]),
    })

    expect(unmatched.addData?.categoryId).toBeUndefined()
  })
})

describe('createRemoveReviewRow', () => {
  it('uses applyRemoveMatch for a resolved pantry hit', () => {
    const row = createRemoveReviewRow({
      item: makeFields({ name: 'Milk', quantity: 1, explicitLocationName: null }),
      idPrefix: 'parse-remove',
      source: { source: 'ai_text', raw: 'Milk' },
      parseMetadata,
      inventory: [makeInventoryItem()],
    })

    expect(row.status).toBe('ready')
    expect(row.removeData).toMatchObject({
      type: 'resolved',
      matchedItemId: 'item-milk',
    })
  })
})

const TWIN_FUNCTIONS = [
  'function resolveLocation',
  'function resolveCategory',
  'function templatesFromLookup',
  'function isValidDateString',
  'function createAddRow',
  'function createRemoveRow',
  'function generateBatchRowId',
] as const

describe('paste and photo call the shared builders', () => {
  it.each([
    'lib/ai/text-parse-normalizer.ts',
    'lib/ai/image-scan-normalizer.ts',
  ])('%s imports shared builders and has no local twins', (relativePath) => {
    const source = readFileSync(relativePath, 'utf8')

    expect(source).toContain("from '@/lib/ai/review-row-build'")
    expect(source).toContain('createAddReviewRow')
    expect(source).toContain('createRemoveReviewRow')

    for (const twin of TWIN_FUNCTIONS) {
      expect(source).not.toContain(twin)
    }
  })
})

describe('ItemList gone', () => {
  it('does not keep components/items/item-list.tsx', () => {
    expect(existsSync('components/items/item-list.tsx')).toBe(false)
  })
})

describe('Dummy test gone', () => {
  it('does not keep __tests__/example.test.ts', () => {
    expect(existsSync('__tests__/example.test.ts')).toBe(false)
  })
})
