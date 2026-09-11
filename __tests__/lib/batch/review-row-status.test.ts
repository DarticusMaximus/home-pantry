import { describe, expect, it } from 'vitest'
import { deriveReviewRowStatus, UNRESOLVED_REVIEW_STATUSES } from '@/lib/batch/review-row-status'
import type { AddLotMatch, BatchReviewRow, RemoveCandidate } from '@/types/batch-review'

function makeAddRow(overrides: Partial<BatchReviewRow> = {}): BatchReviewRow {
  return {
    id: overrides.id ?? 'row-1',
    operation: 'add',
    status: overrides.status ?? 'ready',
    source: { source: 'ai_text', raw: 'test' },
    addData: overrides.addData ?? {
      name: 'Milk',
      quantity: 2,
      unit: 'gallon',
      locationId: 'loc-1',
    },
    ...overrides,
  }
}

function makeRemoveRow(overrides: Partial<BatchReviewRow> = {}): BatchReviewRow {
  return {
    id: overrides.id ?? 'row-1',
    operation: 'remove',
    status: overrides.status ?? 'ready',
    source: { source: 'ai_text', raw: 'test' },
    removeData: overrides.removeData ?? {
      type: 'resolved',
      matchedItemId: 'item-1',
      matchedItemName: 'Milk',
      currentQuantity: 4,
      removeQuantity: 2,
      candidates: [],
    },
    ...overrides,
  }
}

const lotChoiceMatch: AddLotMatch = {
  kind: 'lot_choice',
  candidate: {
    itemId: 'lot-1',
    name: 'beans',
    locationId: 'loc-1',
    quantity: 2,
    unit: 'cans',
    expirationDate: '2026-09-10',
  },
}

const ambiguousMatch: AddLotMatch = {
  kind: 'ambiguous',
  candidates: [
    { itemId: 'clone-a', name: 'beans', locationId: 'loc-1', quantity: 2, unit: 'cans' },
    { itemId: 'clone-b', name: 'beans', locationId: 'loc-1', quantity: 4, unit: 'cans' },
  ],
}

const candidate: RemoveCandidate = {
  item: { id: 'i1', name: 'Cheddar', quantity: 1, unit: 'each', locationId: 'loc-1' },
  score: 0.5,
}

describe('deriveReviewRowStatus', () => {
  it('returns missing_name for a blank add name', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({ addData: { name: '', quantity: 1, unit: 'each', locationId: 'loc-1' } }),
      ),
    ).toBe('missing_name')
  })

  it('returns missing_name for a whitespace add name', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({ addData: { name: '   ', quantity: 1, unit: 'each', locationId: 'loc-1' } }),
      ),
    ).toBe('missing_name')
  })

  it('returns missing_name for a blank remove requested name', () => {
    expect(
      deriveReviewRowStatus(
        makeRemoveRow({
          removeData: {
            type: 'unresolved',
            requestedName: '',
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ),
    ).toBe('missing_name')
  })

  it('returns missing_name for a blank remove matched name', () => {
    expect(
      deriveReviewRowStatus(
        makeRemoveRow({
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-1',
            matchedItemName: '  ',
            currentQuantity: 4,
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ),
    ).toBe('missing_name')
  })

  it('returns missing_name before missing_quantity when both are blank', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({ addData: { name: '', quantity: 0, unit: 'each', locationId: 'loc-1' } }),
      ),
    ).toBe('missing_name')
  })

  it('returns missing_quantity for add quantity 0', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({ addData: { name: 'Milk', quantity: 0, unit: 'gallon', locationId: 'loc-1' } }),
      ),
    ).toBe('missing_quantity')
  })

  it('returns missing_quantity for add quantity -1', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({
          addData: { name: 'Milk', quantity: -1, unit: 'gallon', locationId: 'loc-1' },
        }),
      ),
    ).toBe('missing_quantity')
  })

  it('returns missing_quantity for remove quantity 0', () => {
    expect(
      deriveReviewRowStatus(
        makeRemoveRow({
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-1',
            matchedItemName: 'Milk',
            currentQuantity: 4,
            removeQuantity: 0,
            candidates: [],
          },
        }),
      ),
    ).toBe('missing_quantity')
  })

  it('returns missing_quantity for qty 0 even when addMatch is lot_choice', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({
          addData: { name: 'beans', quantity: 0, unit: 'cans', locationId: 'loc-1' },
          addMatch: lotChoiceMatch,
        }),
      ),
    ).toBe('missing_quantity')
  })

  it('returns missing_unit for a blank add unit', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({ addData: { name: 'Milk', quantity: 1, unit: '', locationId: 'loc-1' } }),
      ),
    ).toBe('missing_unit')
  })

  it('returns missing_unit for a whitespace add unit', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({ addData: { name: 'Milk', quantity: 1, unit: '  ', locationId: 'loc-1' } }),
      ),
    ).toBe('missing_unit')
  })

  it('returns missing_location for a blank add location', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({ addData: { name: 'Milk', quantity: 1, unit: 'each', locationId: '' } }),
      ),
    ).toBe('missing_location')
  })

  it('returns missing_location for a whitespace add location', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({ addData: { name: 'Milk', quantity: 1, unit: 'each', locationId: '  ' } }),
      ),
    ).toBe('missing_location')
  })

  it('returns lot_choice when add fields are ok and addMatch is lot_choice', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: lotChoiceMatch,
        }),
      ),
    ).toBe('lot_choice')
  })

  it('returns ambiguous_match when add fields are ok and addMatch is ambiguous', () => {
    expect(
      deriveReviewRowStatus(
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: ambiguousMatch,
        }),
      ),
    ).toBe('ambiguous_match')
  })

  it('returns no_match for an unresolved remove with no candidates', () => {
    expect(
      deriveReviewRowStatus(
        makeRemoveRow({
          removeData: {
            type: 'unresolved',
            requestedName: 'caviar',
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ),
    ).toBe('no_match')
  })

  it('returns ambiguous_match for an unresolved remove with candidates', () => {
    expect(
      deriveReviewRowStatus(
        makeRemoveRow({
          removeData: {
            type: 'unresolved',
            requestedName: 'cheese',
            removeQuantity: 1,
            candidates: [candidate],
          },
        }),
      ),
    ).toBe('ambiguous_match')
  })

  it('returns ready for a filled add', () => {
    expect(deriveReviewRowStatus(makeAddRow())).toBe('ready')
  })

  it('returns ready for a resolved remove', () => {
    expect(deriveReviewRowStatus(makeRemoveRow())).toBe('ready')
  })

  it('returns ready for an uncertain add so it is not unresolved', () => {
    const status = deriveReviewRowStatus(
      makeAddRow({
        parseMetadata: {
          parseWarnings: [],
          isUncertain: true,
          uncertaintyReason: 'looks off',
        },
      }),
    )

    expect(status).toBe('ready')
    expect(UNRESOLVED_REVIEW_STATUSES.has(status)).toBe(false)
  })
})
