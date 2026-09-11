import { describe, expect, it } from 'vitest'
import { applyTemplateDefaultsToRow } from '@/lib/ai/batch-template-defaults'
import { formatDate } from '@/lib/ai/utils'
import { itemDefaultsFromTemplate } from '@/lib/inventory/restock-from-template'
import type { BatchReviewRow } from '@/types/batch-review'
import type { ItemTemplate } from '@/types/template'

function makeAddRow(overrides: Partial<BatchReviewRow['addData']> = {}): BatchReviewRow {
  return {
    id: 'row-1',
    operation: 'add',
    status: 'ready',
    source: { source: 'ai_text', raw: 'four steaks' },
    addData: {
      name: 'steaks',
      quantity: 4,
      unit: 'each',
      locationId: 'loc-freezer',
      ...overrides,
    },
  }
}

function makeTemplate(overrides: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    id: 'template-steak',
    name: 'Steak',
    defaultUnit: 'each',
    defaultQuantity: 1,
    defaultExpirationDays: 180,
    defaultStorageLocationId: 'loc-freezer',
    categoryId: 'cat-meat',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('applyTemplateDefaultsToRow', () => {
  it('matches plural AI names to templates and derives expiration from purchase date', () => {
    const row = makeAddRow()
    const result = applyTemplateDefaultsToRow(
      row,
      [makeTemplate()],
      new Date('2026-04-27T12:00:00Z'),
    )

    expect(result.addData).toMatchObject({
      name: 'Steak',
      templateId: 'template-steak',
      categoryId: 'cat-meat',
      purchaseDate: '2026-04-27',
      expirationDate: '2026-10-24',
    })
  })

  it('keeps omitted paste expiry as lot identity when stamping template use-by', () => {
    const row = makeAddRow({
      expirationDate: undefined,
      pasteExpirationDate: null,
    })
    const result = applyTemplateDefaultsToRow(
      row,
      [makeTemplate()],
      new Date('2026-04-27T12:00:00Z'),
    )

    expect(result.addData?.expirationDate).toBe('2026-10-24')
    expect(result.addData?.pasteExpirationDate).toBeNull()
  })

  it('does not overwrite an explicit expiration date', () => {
    const row = makeAddRow({ expirationDate: '2026-05-01' })
    const result = applyTemplateDefaultsToRow(
      row,
      [makeTemplate()],
      new Date('2026-04-27T12:00:00Z'),
    )

    expect(result.addData?.purchaseDate).toBe('2026-04-27')
    expect(result.addData?.expirationDate).toBe('2026-05-01')
  })

  it('returns the same row after defaults have already been applied', () => {
    const row = makeAddRow({
      name: 'Steak',
      templateId: 'template-steak',
      categoryId: 'cat-meat',
      purchaseDate: '2026-04-27',
      expirationDate: '2026-10-24',
    })

    const result = applyTemplateDefaultsToRow(
      row,
      [makeTemplate()],
      new Date('2026-04-27T12:00:00Z'),
    )

    expect(result).toBe(row)
  })

  it('returns the same row when no expiration can be derived', () => {
    const row = makeAddRow({
      name: 'Steak',
      templateId: 'template-steak',
      categoryId: 'cat-meat',
      purchaseDate: '2026-04-27',
    })

    const result = applyTemplateDefaultsToRow(
      row,
      [makeTemplate({ defaultExpirationDays: undefined })],
      new Date('2026-04-27T12:00:00Z'),
    )

    expect(result).toBe(row)
  })

  it('replaces empty string expirationDate with template-derived value', () => {
    const row = makeAddRow({ expirationDate: '' })
    const result = applyTemplateDefaultsToRow(
      row,
      [makeTemplate()],
      new Date('2026-04-27T12:00:00Z'),
    )

    expect(result.addData?.expirationDate).toBe('2026-10-24')
  })

  it('replaces non-date string expirationDate with template-derived value', () => {
    const row = makeAddRow({ expirationDate: 'not mentioned' })
    const result = applyTemplateDefaultsToRow(
      row,
      [makeTemplate()],
      new Date('2026-04-27T12:00:00Z'),
    )

    expect(result.addData?.expirationDate).toBe('2026-10-24')
  })

  it('keeps paste quantity 2 when the template default is 1', () => {
    const row = makeAddRow({ quantity: 2 })
    const result = applyTemplateDefaultsToRow(row, [makeTemplate({ defaultQuantity: 1 })])

    expect(result.addData?.quantity).toBe(2)
  })

  it('does not invent 1 / each when quantity and unit are missing and no template matches', () => {
    const row = makeAddRow({
      name: 'Rice',
      quantity: 0,
      unit: '',
      locationId: 'loc-pantry',
    })

    const result = applyTemplateDefaultsToRow(row, [])

    expect(result.status).toBe('missing_quantity')
    expect(result.addData?.quantity).toBe(0)
    expect(result.addData?.quantity).not.toBe(1)
    expect(result.addData?.unit).toBe('')
    expect(result.addData?.unit).not.toBe('each')
  })

  it('does not invent each when quantity is present and unit is missing and no template matches', () => {
    const row = makeAddRow({
      name: 'Rice',
      quantity: 2,
      unit: '',
      locationId: 'loc-pantry',
    })

    const result = applyTemplateDefaultsToRow(row, [])

    expect(result.status).toBe('missing_unit')
    expect(result.addData?.quantity).toBe(2)
    expect(result.addData?.unit).toBe('')
    expect(result.addData?.unit).not.toBe('each')
  })

  it('overwrites guessed non-null unit, quantity, and expiry from a matching template', () => {
    const row: BatchReviewRow = {
      ...makeAddRow({
        name: 'milk',
        quantity: 3,
        unit: 'each',
        locationId: 'loc-fridge',
        expirationDate: '2026-12-01',
      }),
      parseMetadata: {
        parseWarnings: ['Uncertain: guessed unit'],
        isUncertain: true,
        uncertaintyReason: 'guessed unit',
      },
    }

    const result = applyTemplateDefaultsToRow(
      row,
      [
        makeTemplate({
          id: 'template-milk',
          name: 'Milk',
          defaultUnit: 'gallon',
          defaultQuantity: 1,
          defaultExpirationDays: 10,
          defaultStorageLocationId: 'loc-fridge',
        }),
      ],
      new Date(2026, 3, 27, 12, 0, 0),
    )

    expect(result.addData?.unit).toBe('gallon')
    expect(result.addData?.quantity).toBe(1)
    expect(result.addData?.expirationDate).toBe('2026-05-07')
    expect(result.parseMetadata?.isUncertain).toBe(false)
    expect(result.parseMetadata?.uncertaintyReason).toBeUndefined()
    expect(
      result.parseMetadata?.parseWarnings.some((warning) => warning.startsWith('Uncertain:')),
    ).toBe(false)
  })

  it('keeps a guessed unit and isUncertain when the matching template has no unit', () => {
    const row: BatchReviewRow = {
      ...makeAddRow({
        name: 'milk',
        quantity: 1,
        unit: 'each',
        locationId: 'loc-fridge',
      }),
      parseMetadata: {
        parseWarnings: ['Uncertain: guessed unit'],
        isUncertain: true,
        uncertaintyReason: 'guessed unit',
      },
    }

    const result = applyTemplateDefaultsToRow(row, [
      makeTemplate({
        id: 'template-milk',
        name: 'Milk',
        defaultUnit: '',
        defaultQuantity: 1,
        defaultExpirationDays: undefined,
        defaultStorageLocationId: 'loc-fridge',
      }),
    ])

    expect(result.addData?.unit).toBe('each')
    expect(result.parseMetadata?.isUncertain).toBe(true)
    expect(result.parseMetadata?.uncertaintyReason).toBe('guessed unit')
  })

  it('fills omitted unit, place, quantity, and expiry from a matching template', () => {
    const row: BatchReviewRow = {
      ...makeAddRow({
        name: 'steaks',
        quantity: 0,
        unit: '',
        locationId: '',
        expirationDate: undefined,
        purchaseDate: undefined,
      }),
      status: 'missing_location',
    }

    const result = applyTemplateDefaultsToRow(
      row,
      [makeTemplate()],
      new Date(2026, 3, 27, 12, 0, 0),
    )

    expect(result.addData).toMatchObject({
      name: 'Steak',
      quantity: 1,
      unit: 'each',
      locationId: 'loc-freezer',
      templateId: 'template-steak',
    })
    expect(result.addData?.expirationDate).toBeTruthy()
    expect(result.status).toBe('ready')
  })

  it('keeps a dated paste expiry and still fills omitted unit, place, and quantity', () => {
    const row: BatchReviewRow = {
      ...makeAddRow({
        name: 'steaks',
        quantity: 0,
        unit: '',
        locationId: '',
        purchaseDate: '2026-04-27',
        expirationDate: '2026-05-01',
      }),
      status: 'missing_location',
    }

    const result = applyTemplateDefaultsToRow(row, [makeTemplate()])

    expect(result.addData?.expirationDate).toBe('2026-05-01')
    expect(result.addData?.quantity).toBe(1)
    expect(result.addData?.unit).toBe('each')
    expect(result.addData?.locationId).toBe('loc-freezer')
    expect(result.addData?.name).toBe('Steak')
    expect(result.status).toBe('ready')
  })

  it('leaves unknown place empty and missing_location when the template has no usual place', () => {
    const row: BatchReviewRow = {
      ...makeAddRow({ locationId: '' }),
      status: 'ready',
    }

    const result = applyTemplateDefaultsToRow(row, [
      makeTemplate({ defaultStorageLocationId: undefined }),
    ])

    expect(result.addData?.locationId).toBe('')
    expect(result.status).toBe('missing_location')
  })

  it('does not change already-filled fields on a second apply, including a YYYY-MM-DD expiry', () => {
    const row: BatchReviewRow = {
      ...makeAddRow({
        name: 'steaks',
        quantity: 0,
        unit: '',
        locationId: '',
        purchaseDate: '2026-04-27',
        expirationDate: '2026-05-01',
      }),
      status: 'missing_location',
      parseMetadata: {
        parseWarnings: ['Uncertain: guessed amount'],
        isUncertain: true,
        uncertaintyReason: 'guessed amount',
      },
    }

    const templates = [makeTemplate()]
    const first = applyTemplateDefaultsToRow(row, templates)
    const second = applyTemplateDefaultsToRow(first, templates)

    expect(second).toBe(first)
    expect(second.addData).toEqual(first.addData)
    expect(second.status).toBe(first.status)
    expect(second.parseMetadata).toEqual(first.parseMetadata)
  })

  it('clears isUncertain when a template matches', () => {
    const row: BatchReviewRow = {
      ...makeAddRow(),
      parseMetadata: {
        parseWarnings: ['Uncertain: guessed unit'],
        isUncertain: true,
        uncertaintyReason: 'guessed unit',
      },
    }

    const result = applyTemplateDefaultsToRow(row, [makeTemplate()])

    expect(result.parseMetadata?.isUncertain).toBe(false)
  })

  it('clears uncertaintyReason and Uncertain-prefixed warnings when a matching template fills the guess', () => {
    const row: BatchReviewRow = {
      ...makeAddRow(),
      parseMetadata: {
        parseWarnings: ['Uncertain: guessed unit', 'Quantity estimated'],
        isUncertain: true,
        uncertaintyReason: 'guessed unit',
      },
    }

    const result = applyTemplateDefaultsToRow(row, [makeTemplate()])

    expect(result.parseMetadata?.isUncertain).toBe(false)
    expect(result.parseMetadata?.uncertaintyReason).toBeUndefined()
    expect(result.parseMetadata?.parseWarnings).toEqual(['Quantity estimated'])
  })

  it('keeps model isUncertain when no template matches', () => {
    const row: BatchReviewRow = {
      ...makeAddRow({ name: 'Dragonfruit' }),
      parseMetadata: {
        parseWarnings: ['Uncertain: guessed unit'],
        isUncertain: true,
        uncertaintyReason: 'guessed unit',
      },
    }

    const result = applyTemplateDefaultsToRow(row, [makeTemplate()])

    expect(result.parseMetadata?.isUncertain).toBe(true)
    expect(result.parseMetadata?.uncertaintyReason).toBe('guessed unit')
  })

  it('formatDate uses the local calendar date, not UTC ISO', () => {
    const today = new Date(2026, 0, 1, 0, 30, 0)

    expect(formatDate(today)).toBe('2026-01-01')

    const isoDate = today.toISOString().split('T')[0]
    if (isoDate !== '2026-01-01') {
      expect(formatDate(today)).not.toBe(isoDate)
    }
  })

  it('uses local calendar dates from itemDefaultsFromTemplate, not UTC ISO', () => {
    const today = new Date(2026, 0, 1, 0, 30, 0)
    const template = makeTemplate({ defaultExpirationDays: 7 })
    const row = makeAddRow({
      quantity: 0,
      unit: '',
      locationId: '',
      purchaseDate: undefined,
      expirationDate: undefined,
    })

    const result = applyTemplateDefaultsToRow(row, [template], today)
    const expected = itemDefaultsFromTemplate(template, today)

    expect(result.addData?.purchaseDate).toBe(expected.purchaseDate)
    expect(result.addData?.expirationDate).toBe(expected.expirationDate)
    expect(result.addData?.purchaseDate).toBe('2026-01-01')
    expect(result.addData?.expirationDate).toBe('2026-01-08')

    const isoDate = today.toISOString().split('T')[0]
    if (isoDate !== '2026-01-01') {
      expect(result.addData?.purchaseDate).not.toBe(isoDate)
    }
  })

  it('does not apply template fill to remove rows', () => {
    const row: BatchReviewRow = {
      id: 'row-rm',
      operation: 'remove',
      status: 'no_match',
      source: { source: 'ai_text', raw: 'steaks' },
      removeData: {
        type: 'unresolved',
        requestedName: 'steaks',
        removeQuantity: 2,
        candidates: [],
      },
      parseMetadata: {
        parseWarnings: ['Uncertain: guessed'],
        isUncertain: true,
        uncertaintyReason: 'guessed',
      },
    }

    const result = applyTemplateDefaultsToRow(row, [makeTemplate()])

    expect(result).toBe(row)
    expect(result.removeData).toEqual(row.removeData)
    expect(result.parseMetadata?.isUncertain).toBe(true)
  })
})
