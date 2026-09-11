import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useBatchReview } from '@/hooks/use-batch-review'
import type { BatchReviewRow } from '@/types/batch-review'
import type { Item } from '@/types/item'

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

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: overrides.id ?? 'lot-1',
    name: overrides.name ?? 'beans',
    quantity: overrides.quantity ?? 2,
    unit: overrides.unit ?? 'cans',
    locationId: overrides.locationId ?? 'loc-1',
    expirationDate: overrides.expirationDate,
    createdById: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
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

describe('useBatchReview', () => {
  describe('canConfirm', () => {
    it('returns true when all add rows are ready', () => {
      const rows = [makeAddRow({ id: 'row-1' }), makeAddRow({ id: 'row-2' })]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(true)
    })

    it('returns false when any add row is missing a name', () => {
      const rows = [
        makeAddRow({
          id: 'row-1',
          status: 'missing_name',
          addData: { name: '', quantity: 1, unit: 'each', locationId: 'loc-1' },
        }),
        makeAddRow({ id: 'row-2' }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(false)
    })

    it('returns false when any add row is missing quantity', () => {
      const rows = [
        makeAddRow({
          id: 'row-1',
          status: 'missing_quantity',
          addData: { name: 'Milk', quantity: 0, unit: 'each', locationId: 'loc-1' },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(false)
    })

    it('returns false when any add row is missing unit', () => {
      const rows = [
        makeAddRow({
          id: 'row-1',
          status: 'missing_unit',
          addData: { name: 'Milk', quantity: 1, unit: '', locationId: 'loc-1' },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(false)
    })

    it('returns false when any add row is missing location', () => {
      const rows = [
        makeAddRow({
          id: 'row-1',
          status: 'missing_location',
          addData: { name: 'Milk', quantity: 1, unit: 'each', locationId: '' },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(false)
    })

    it('returns false when any remove row has ambiguous_match status', () => {
      const rows = [
        makeRemoveRow({
          id: 'row-1',
          status: 'ambiguous_match',
          removeData: {
            type: 'unresolved',
            requestedName: 'cheese',
            removeQuantity: 1,
            candidates: [
              {
                item: { id: 'i1', name: 'Cheddar', quantity: 1, unit: 'each', locationId: 'loc-1' },
                score: 0.5,
              },
              {
                item: { id: 'i2', name: 'Swiss', quantity: 2, unit: 'each', locationId: 'loc-1' },
                score: 0.4,
              },
            ],
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('remove', rows))

      expect(result.current.canConfirm).toBe(false)
    })

    it('returns false when any remove row has no_match status', () => {
      const rows = [
        makeRemoveRow({
          id: 'row-1',
          status: 'no_match',
          removeData: {
            type: 'unresolved',
            requestedName: 'caviar',
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('remove', rows))

      expect(result.current.canConfirm).toBe(false)
    })

    it('returns true when all remove rows are ready', () => {
      const rows = [makeRemoveRow({ id: 'row-1' })]
      const inventory = [makeItem({ id: 'item-1', name: 'Milk', quantity: 4, unit: 'gallon' })]

      const { result } = renderHook(() => useBatchReview('remove', rows, inventory, false))

      expect(result.current.canConfirm).toBe(true)
    })

    it('returns false when any row has error status', () => {
      const rows = [makeAddRow({ id: 'row-1', status: 'error' })]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(false)
    })

    it('returns false when remaining rows are ready including uncertain', () => {
      const rows = [
        makeAddRow({ id: 'row-1' }),
        makeAddRow({
          id: 'row-2',
          parseMetadata: {
            parseWarnings: [],
            isUncertain: true,
            uncertaintyReason: 'looks off',
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(false)
    })

    it('returns false when there are no rows', () => {
      const { result } = renderHook(() => useBatchReview('add', []))

      expect(result.current.canConfirm).toBe(false)
    })
  })

  describe('confirmGuess', () => {
    const guessedMeta = {
      parseWarnings: [] as string[],
      isUncertain: true,
      uncertaintyReason: 'looks off',
    }

    it('clears the guess without rematching or changing status, match, qty, or place', () => {
      const addMatch = { kind: 'new_lot' as const }
      const rows = [
        makeAddRow({
          id: 'row-1',
          addData: { name: 'Milk', quantity: 2, unit: 'gallon', locationId: 'loc-1' },
          addMatch,
          parseMetadata: guessedMeta,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(false)

      act(() => {
        result.current.confirmGuess('row-1')
      })

      const row = result.current.state.rows[0]
      expect(row.parseMetadata?.isUncertain).toBe(false)
      expect(row.parseMetadata?.uncertaintyReason).toBeUndefined()
      expect(row.status).toBe('ready')
      expect(row.addMatch).toEqual(addMatch)
      expect(row.addData?.quantity).toBe(2)
      expect(row.addData?.locationId).toBe('loc-1')
      expect(result.current.canConfirm).toBe(true)
    })

    it('unblocks confirm when the guess was the only blocker', () => {
      const rows = [
        makeAddRow({ id: 'row-1' }),
        makeAddRow({
          id: 'row-2',
          parseMetadata: guessedMeta,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(false)

      act(() => {
        result.current.confirmGuess('row-2')
      })

      expect(result.current.state.rows[1].parseMetadata?.isUncertain).toBe(false)
      expect(result.current.canConfirm).toBe(true)
    })

    it('strips leftover Uncertain-prefixed parseWarnings without rematching', () => {
      const addMatch = { kind: 'new_lot' as const }
      const rows = [
        makeAddRow({
          id: 'row-1',
          addData: { name: 'Milk', quantity: 2, unit: 'gallon', locationId: 'loc-1' },
          addMatch,
          parseMetadata: {
            parseWarnings: ['Uncertain: quantity guessed', 'Quantity estimated'],
            isUncertain: true,
            uncertaintyReason: 'quantity guessed',
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.confirmGuess('row-1')
      })

      const row = result.current.state.rows[0]
      expect(row.parseMetadata?.isUncertain).toBe(false)
      expect(row.parseMetadata?.uncertaintyReason).toBeUndefined()
      expect(row.parseMetadata?.parseWarnings).toEqual(['Quantity estimated'])
      expect(row.status).toBe('ready')
      expect(row.addMatch).toEqual(addMatch)
      expect(row.addData?.quantity).toBe(2)
      expect(row.addData?.locationId).toBe('loc-1')
    })

    it('does not clear isUncertain on quantity, location, or replaceRow', () => {
      const rows = [
        makeAddRow({
          id: 'row-1',
          parseMetadata: guessedMeta,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.updateRowQuantity('row-1', 5)
      })
      expect(result.current.state.rows[0].parseMetadata?.isUncertain).toBe(true)
      expect(result.current.canConfirm).toBe(false)

      act(() => {
        result.current.updateRowLocation('row-1', 'loc-2')
      })
      expect(result.current.state.rows[0].parseMetadata?.isUncertain).toBe(true)
      expect(result.current.state.rows[0].addData?.locationId).toBe('loc-2')
      expect(result.current.canConfirm).toBe(false)

      act(() => {
        result.current.replaceRow(
          'row-1',
          makeAddRow({
            id: 'row-1',
            addData: { name: 'Oat Milk', quantity: 5, unit: 'gallon', locationId: 'loc-2' },
            parseMetadata: guessedMeta,
          }),
        )
      })
      expect(result.current.state.rows[0].parseMetadata?.isUncertain).toBe(true)
      expect(result.current.state.rows[0].addData?.name).toBe('Oat Milk')
      expect(result.current.canConfirm).toBe(false)
    })
  })

  describe('unresolvedCount', () => {
    it('returns 0 when all rows are ready', () => {
      const rows = [makeAddRow({ id: 'row-1' }), makeAddRow({ id: 'row-2' })]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.unresolvedCount).toBe(0)
    })

    it('counts unresolved rows', () => {
      const rows = [
        makeAddRow({ id: 'row-1' }),
        makeAddRow({ id: 'row-2', status: 'missing_location' }),
        makeAddRow({ id: 'row-3', status: 'missing_name' }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.unresolvedCount).toBe(2)
    })
  })

  describe('updateRowQuantity', () => {
    it('updates quantity for a specific add row', () => {
      const rows = [makeAddRow({ id: 'row-1' })]

      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.updateRowQuantity('row-1', 5)
      })

      const updatedRow = result.current.state.rows.find((r) => r.id === 'row-1')
      expect(updatedRow!.addData!.quantity).toBe(5)
    })

    it('marks quantity 0 as missing_quantity and blocks confirm', () => {
      const rows = [makeAddRow({ id: 'row-1' })]

      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.updateRowQuantity('row-1', 0)
      })

      expect(result.current.state.rows[0].status).toBe('missing_quantity')
      expect(result.current.canConfirm).toBe(false)
    })

    it('returns an otherwise-filled add to ready when quantity is restored to 1', () => {
      const rows = [makeAddRow({ id: 'row-1' })]

      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.updateRowQuantity('row-1', 0)
      })
      act(() => {
        result.current.updateRowQuantity('row-1', 1)
      })

      expect(result.current.state.rows[0].status).toBe('ready')
      expect(result.current.canConfirm).toBe(true)
    })

    it('restores lot_choice not ready when quantity returns to 1', () => {
      const rows = [
        makeAddRow({
          status: 'lot_choice',
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: {
            kind: 'lot_choice',
            candidate: {
              itemId: 'lot-1',
              name: 'beans',
              locationId: 'loc-1',
              quantity: 2,
              unit: 'cans',
              expirationDate: '2026-09-10',
            },
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, []))

      act(() => {
        result.current.updateRowQuantity('row-1', 0)
      })
      act(() => {
        result.current.updateRowQuantity('row-1', 1)
      })

      expect(result.current.state.rows[0].status).toBe('lot_choice')
      expect(result.current.canConfirm).toBe(false)
    })
  })

  describe('updateRowLocation', () => {
    it('updates location for a specific add row', () => {
      const rows = [makeAddRow({ id: 'row-1' })]

      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.updateRowLocation('row-1', 'loc-2')
      })

      const updatedRow = result.current.state.rows.find((r) => r.id === 'row-1')
      expect(updatedRow!.addData!.locationId).toBe('loc-2')
    })

    it('marks a missing-location row as ready after location update', () => {
      const rows = [
        makeAddRow({
          id: 'row-1',
          status: 'missing_location',
          addData: { name: 'Milk', quantity: 1, unit: 'each', locationId: '' },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.updateRowLocation('row-1', 'loc-2')
      })

      const updatedRow = result.current.state.rows.find((r) => r.id === 'row-1')
      expect(updatedRow!.status).toBe('ready')
    })
  })

  describe('replaceRow', () => {
    it('replaces a row entirely', () => {
      const rows = [makeAddRow({ id: 'row-1' })]
      const replacement: BatchReviewRow = makeAddRow({
        id: 'row-1',
        addData: { name: 'Bread', quantity: 1, unit: 'loaf', locationId: 'loc-3' },
      })

      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.replaceRow('row-1', replacement)
      })

      const updatedRow = result.current.state.rows.find((r) => r.id === 'row-1')
      expect(updatedRow!.addData!.name).toBe('Bread')
    })
  })

  describe('removeRow', () => {
    it('removes a row from state', () => {
      const rows = [makeAddRow({ id: 'row-1' }), makeAddRow({ id: 'row-2' })]

      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.removeRow('row-1')
      })

      expect(result.current.state.rows).toHaveLength(1)
      expect(result.current.state.rows[0].id).toBe('row-2')
    })

    it('drops the id and blocks confirm when the last row is gone', () => {
      const rows = [makeAddRow({ id: 'row-1' }), makeAddRow({ id: 'row-2' })]

      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.removeRow('row-1')
      })
      expect(result.current.state.rows.find((row) => row.id === 'row-1')).toBeUndefined()

      act(() => {
        result.current.removeRow('row-2')
      })

      expect(result.current.state.rows).toHaveLength(0)
      expect(result.current.canConfirm).toBe(false)
    })
  })

  describe('keeps family edits across new initialRows', () => {
    it('keeps edited quantity and still joins the live lot while untouched sibling takes template fill', () => {
      const inventory = [
        makeItem({
          id: 'lot-milk',
          name: 'Milk',
          quantity: 3,
          unit: 'gallon',
          locationId: 'loc-1',
        }),
      ]
      const initialRows = [
        makeAddRow({
          id: 'row-1',
          addData: { name: 'Milk', quantity: 1, unit: 'gallon', locationId: 'loc-1' },
        }),
        makeAddRow({
          id: 'row-2',
          addData: { name: 'Eggs', quantity: 1, unit: 'each', locationId: 'loc-1' },
        }),
      ]

      const { result, rerender } = renderHook(
        ({ rows, inv }: { rows: BatchReviewRow[]; inv: Item[] }) =>
          useBatchReview('add', rows, inv),
        { initialProps: { rows: initialRows, inv: inventory } },
      )

      act(() => {
        result.current.updateRowQuantity('row-1', 5)
      })

      rerender({
        rows: [
          makeAddRow({
            id: 'row-1',
            addData: { name: 'Milk', quantity: 1, unit: 'gallon', locationId: 'loc-1' },
          }),
          makeAddRow({
            id: 'row-2',
            addData: { name: 'Eggs', quantity: 1, unit: 'each', locationId: 'loc-2' },
          }),
        ],
        inv: inventory,
      })

      const row1 = result.current.state.rows.find((row) => row.id === 'row-1')
      const row2 = result.current.state.rows.find((row) => row.id === 'row-2')
      expect(row1?.addData?.quantity).toBe(5)
      expect(row1?.addMatch?.kind).toBe('join')
      expect(row2?.addData?.locationId).toBe('loc-2')
    })

    it('keeps edited location across new initialRows', () => {
      const rows = [
        makeAddRow({
          id: 'row-1',
          addData: { name: 'Milk', quantity: 1, unit: 'gallon', locationId: 'loc-1' },
        }),
      ]

      const { result, rerender } = renderHook(
        ({ initial }: { initial: BatchReviewRow[] }) => useBatchReview('add', initial),
        { initialProps: { initial: rows } },
      )

      act(() => {
        result.current.updateRowLocation('row-1', 'loc-fridge')
      })

      rerender({
        initial: [
          makeAddRow({
            id: 'row-1',
            addData: { name: 'Milk', quantity: 1, unit: 'gallon', locationId: 'loc-1' },
          }),
        ],
      })

      expect(result.current.state.rows[0].addData?.locationId).toBe('loc-fridge')
    })

    it('keeps edited name across new initialRows', () => {
      const rows = [
        makeAddRow({
          id: 'row-1',
          addData: { name: 'Milk', quantity: 1, unit: 'gallon', locationId: 'loc-1' },
        }),
      ]

      const { result, rerender } = renderHook(
        ({ initial }: { initial: BatchReviewRow[] }) => useBatchReview('add', initial),
        { initialProps: { initial: rows } },
      )

      act(() => {
        result.current.replaceRow(
          'row-1',
          makeAddRow({
            id: 'row-1',
            addData: { name: 'Oat Milk', quantity: 1, unit: 'gallon', locationId: 'loc-1' },
          }),
        )
      })

      rerender({
        initial: [
          makeAddRow({
            id: 'row-1',
            addData: { name: 'Milk', quantity: 1, unit: 'gallon', locationId: 'loc-1' },
          }),
        ],
      })

      expect(result.current.state.rows[0].addData?.name).toBe('Oat Milk')
    })

    it('keeps Looks-right quantity and isUncertain false across new initialRows and still joins', () => {
      const inventory = [
        makeItem({
          id: 'lot-milk',
          name: 'Milk',
          quantity: 2,
          unit: 'gallon',
          locationId: 'loc-1',
        }),
      ]
      const guessedMeta = {
        parseWarnings: [] as string[],
        isUncertain: true,
        uncertaintyReason: 'looks off',
      }
      const initialRows = [
        makeAddRow({
          id: 'row-1',
          addData: { name: 'Milk', quantity: 3, unit: 'gallon', locationId: 'loc-1' },
          parseMetadata: guessedMeta,
        }),
        makeAddRow({
          id: 'row-2',
          addData: { name: 'Eggs', quantity: 1, unit: 'each', locationId: 'loc-1' },
        }),
      ]

      const { result, rerender } = renderHook(
        ({ rows, inv }: { rows: BatchReviewRow[]; inv: Item[] }) =>
          useBatchReview('add', rows, inv),
        { initialProps: { rows: initialRows, inv: inventory } },
      )

      act(() => {
        result.current.confirmGuess('row-1')
      })

      rerender({
        rows: [
          makeAddRow({
            id: 'row-1',
            addData: { name: 'Milk', quantity: 1, unit: 'gallon', locationId: 'loc-1' },
            parseMetadata: guessedMeta,
          }),
          makeAddRow({
            id: 'row-2',
            addData: { name: 'Eggs', quantity: 1, unit: 'each', locationId: 'loc-2' },
          }),
        ],
        inv: inventory,
      })

      const row1 = result.current.state.rows.find((row) => row.id === 'row-1')
      const row2 = result.current.state.rows.find((row) => row.id === 'row-2')
      expect(row1?.addData?.quantity).toBe(3)
      expect(row1?.addData?.name).toBe('Milk')
      expect(row1?.addData?.locationId).toBe('loc-1')
      expect(row1?.parseMetadata?.isUncertain).toBe(false)
      expect(row1?.addMatch?.kind).toBe('join')
      if (row1?.addMatch?.kind === 'join') {
        expect(row1.addMatch.itemId).toBe('lot-milk')
      }
      expect(row2?.addData?.locationId).toBe('loc-2')
    })
  })

  describe('selectRemoveMatch', () => {
    it('allows user to override auto-selected remove match', () => {
      const candidates = [
        {
          item: { id: 'item-1', name: 'Cheddar', quantity: 1, unit: 'block', locationId: 'loc-1' },
          score: 0.7,
        },
        {
          item: { id: 'item-2', name: 'Swiss', quantity: 2, unit: 'block', locationId: 'loc-1' },
          score: 0.3,
        },
      ]

      const rows = [
        makeRemoveRow({
          id: 'row-1',
          removeData: {
            type: 'unresolved',
            requestedName: 'cheese',
            removeQuantity: 1,
            candidates,
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('remove', rows, [], true))

      act(() => {
        result.current.selectRemoveMatch('row-1', 'item-2')
      })

      const updatedRow = result.current.state.rows.find((r) => r.id === 'row-1')
      expect(updatedRow!.status).toBe('ready')
      expect(updatedRow!.removeData!.type).toBe('resolved')
      if (updatedRow!.removeData!.type === 'resolved') {
        expect(updatedRow!.removeData!.matchedItemId).toBe('item-2')
      }
    })

    it('keeps a user-picked matchedItemId on live refresh and refreshes currentQuantity', () => {
      const candidates = [
        {
          item: { id: 'item-1', name: 'Cheddar', quantity: 1, unit: 'block', locationId: 'loc-1' },
          score: 0.7,
        },
        {
          item: { id: 'item-2', name: 'Swiss', quantity: 2, unit: 'block', locationId: 'loc-1' },
          score: 0.3,
        },
      ]
      const rows = [
        makeRemoveRow({
          id: 'row-1',
          status: 'ambiguous_match',
          removeData: {
            type: 'unresolved',
            requestedName: 'cheese',
            removeQuantity: 1,
            candidates,
          },
        }),
      ]

      const { result, rerender } = renderHook(
        ({ inventory, isLoading }: { inventory: Item[]; isLoading: boolean }) =>
          useBatchReview('remove', rows, inventory, isLoading),
        { initialProps: { inventory: [] as Item[], isLoading: true } },
      )

      act(() => {
        result.current.selectRemoveMatch('row-1', 'item-2')
      })

      rerender({
        inventory: [
          makeItem({ id: 'item-2', name: 'Swiss', quantity: 9, unit: 'block' }),
          makeItem({ id: 'item-1', name: 'Cheddar', quantity: 1, unit: 'block' }),
          makeItem({ id: 'item-3', name: 'cheese', quantity: 5, unit: 'block' }),
        ],
        isLoading: false,
      })

      const row = result.current.state.rows[0]
      expect(row.status).toBe('ready')
      expect(row.removeData?.type).toBe('resolved')
      if (row.removeData?.type === 'resolved') {
        expect(row.removeData.matchedItemId).toBe('item-2')
        expect(row.removeData.currentQuantity).toBe(9)
      }
    })
  })

  describe('add lot matching', () => {
    const joinMatch = {
      kind: 'join' as const,
      itemId: 'lot-1',
      currentQuantity: 2,
      name: 'beans',
      unit: 'cans',
    }

    it('returns false canConfirm when an add row is lot_choice', () => {
      const rows = [
        makeAddRow({
          status: 'lot_choice',
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: {
            kind: 'lot_choice',
            candidate: {
              itemId: 'lot-1',
              name: 'beans',
              locationId: 'loc-1',
              quantity: 2,
              unit: 'cans',
              expirationDate: '2026-09-10',
            },
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, []))

      expect(result.current.canConfirm).toBe(false)
    })

    it('returns false canConfirm when an add row is ambiguous_match', () => {
      const rows = [
        makeAddRow({
          status: 'ambiguous_match',
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: {
            kind: 'ambiguous',
            candidates: [
              {
                itemId: 'clone-a',
                name: 'beans',
                locationId: 'loc-1',
                quantity: 2,
                unit: 'cans',
              },
              {
                itemId: 'clone-b',
                name: 'beans',
                locationId: 'loc-1',
                quantity: 4,
                unit: 'cans',
              },
            ],
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, []))

      expect(result.current.canConfirm).toBe(false)
    })

    it('selectAddLot with an item id joins that lot and sets ready', () => {
      const inventory = [
        makeItem({ id: 'lot-1', name: 'beans', quantity: 2, expirationDate: '2026-09-10' }),
      ]
      const rows = [
        makeAddRow({
          status: 'lot_choice',
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: {
            kind: 'lot_choice',
            candidate: {
              itemId: 'lot-1',
              name: 'beans',
              locationId: 'loc-1',
              quantity: 2,
              unit: 'cans',
              expirationDate: '2026-09-10',
            },
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))

      act(() => {
        result.current.selectAddLot('row-1', 'lot-1')
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.status).toBe('ready')
      expect(updatedRow.addMatch).toEqual(joinMatch)
      expect(result.current.canConfirm).toBe(true)
    })

    it('selectAddLot with null creates a new lot and sets ready', () => {
      const rows = [
        makeAddRow({
          status: 'lot_choice',
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: {
            kind: 'lot_choice',
            candidate: {
              itemId: 'lot-1',
              name: 'beans',
              locationId: 'loc-1',
              quantity: 2,
              unit: 'cans',
              expirationDate: '2026-09-10',
            },
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, []))

      act(() => {
        result.current.selectAddLot('row-1', null)
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.status).toBe('ready')
      expect(updatedRow.addMatch).toEqual({ kind: 'new_lot' })
      expect(result.current.canConfirm).toBe(true)
    })

    it('keeps missing_quantity after selectAddLot join when quantity is 0', () => {
      const inventory = [
        makeItem({ id: 'lot-1', name: 'beans', quantity: 2, expirationDate: '2026-09-10' }),
      ]
      const rows = [
        makeAddRow({
          status: 'lot_choice',
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: {
            kind: 'lot_choice',
            candidate: {
              itemId: 'lot-1',
              name: 'beans',
              locationId: 'loc-1',
              quantity: 2,
              unit: 'cans',
              expirationDate: '2026-09-10',
            },
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))

      act(() => {
        result.current.updateRowQuantity('row-1', 0)
      })
      act(() => {
        result.current.selectAddLot('row-1', 'lot-1')
      })

      expect(result.current.state.rows[0].status).toBe('missing_quantity')
      expect(result.current.state.rows[0].addMatch?.kind).toBe('join')
      expect(result.current.canConfirm).toBe(false)
    })

    it('keeps missing_quantity after selectAddLot new lot when quantity is 0', () => {
      const rows = [
        makeAddRow({
          status: 'lot_choice',
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: {
            kind: 'lot_choice',
            candidate: {
              itemId: 'lot-1',
              name: 'beans',
              locationId: 'loc-1',
              quantity: 2,
              unit: 'cans',
              expirationDate: '2026-09-10',
            },
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, []))

      act(() => {
        result.current.updateRowQuantity('row-1', 0)
      })
      act(() => {
        result.current.selectAddLot('row-1', null)
      })

      expect(result.current.state.rows[0].status).toBe('missing_quantity')
      expect(result.current.state.rows[0].addMatch).toEqual({ kind: 'new_lot' })
      expect(result.current.canConfirm).toBe(false)
    })

    it('selectAddLot clone pick joins the chosen id and sets ready', () => {
      const inventory = [
        makeItem({ id: 'clone-a', name: 'beans', quantity: 2 }),
        makeItem({ id: 'clone-b', name: 'beans', quantity: 4 }),
      ]
      const rows = [
        makeAddRow({
          status: 'ambiguous_match',
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: {
            kind: 'ambiguous',
            candidates: [
              {
                itemId: 'clone-a',
                name: 'beans',
                locationId: 'loc-1',
                quantity: 2,
                unit: 'cans',
              },
              {
                itemId: 'clone-b',
                name: 'beans',
                locationId: 'loc-1',
                quantity: 4,
                unit: 'cans',
              },
            ],
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))

      act(() => {
        result.current.selectAddLot('row-1', 'clone-b')
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.status).toBe('ready')
      expect(updatedRow.addMatch).toEqual({
        kind: 'join',
        itemId: 'clone-b',
        currentQuantity: 4,
        name: 'beans',
        unit: 'cans',
      })
      expect(result.current.canConfirm).toBe(true)
    })

    it('rematches on location change so a join can become a new lot', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans', quantity: 2, locationId: 'loc-1' })]
      const rows = [
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: joinMatch,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))

      act(() => {
        result.current.updateRowLocation('row-1', 'loc-2')
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.addData?.locationId).toBe('loc-2')
      expect(updatedRow.status).toBe('ready')
      expect(updatedRow.addMatch).toEqual({ kind: 'new_lot' })
    })

    it('rematches on location change so a join can become lot_choice', () => {
      const inventory = [
        makeItem({ id: 'lot-1', name: 'beans', quantity: 2, locationId: 'loc-1' }),
        makeItem({
          id: 'lot-dated',
          name: 'beans',
          quantity: 3,
          locationId: 'loc-2',
          expirationDate: '2026-09-10',
        }),
      ]
      const rows = [
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: joinMatch,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))

      act(() => {
        result.current.updateRowLocation('row-1', 'loc-2')
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.status).toBe('lot_choice')
      expect(updatedRow.addMatch?.kind).toBe('lot_choice')
      expect(result.current.canConfirm).toBe(false)
    })

    it('replaceRow that clears expiry rematches a dated join into undated lot_choice', () => {
      const inventory = [
        makeItem({
          id: 'lot-1',
          name: 'beans',
          quantity: 2,
          expirationDate: '2026-09-10',
        }),
      ]
      const rows = [
        makeAddRow({
          addData: {
            name: 'beans',
            quantity: 1,
            unit: 'cans',
            locationId: 'loc-1',
            expirationDate: '2026-09-10',
          },
          addMatch: joinMatch,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))

      act(() => {
        result.current.replaceRow(
          'row-1',
          makeAddRow({
            addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
            addMatch: joinMatch,
          }),
        )
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.status).toBe('lot_choice')
      expect(updatedRow.addMatch?.kind).toBe('lot_choice')
    })

    it('replaceRow that changes name rematches a join into a new lot', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans', quantity: 2 })]
      const rows = [
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: joinMatch,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))

      act(() => {
        result.current.replaceRow(
          'row-1',
          makeAddRow({
            addData: { name: 'rice', quantity: 1, unit: 'cans', locationId: 'loc-1' },
            addMatch: joinMatch,
          }),
        )
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.status).toBe('ready')
      expect(updatedRow.addMatch).toEqual({ kind: 'new_lot' })
    })

    it('replaceRow that changes unit rematches', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans', quantity: 2, unit: 'cans' })]
      const rows = [
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: joinMatch,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))

      act(() => {
        result.current.replaceRow(
          'row-1',
          makeAddRow({
            addData: { name: 'beans', quantity: 1, unit: 'bags', locationId: 'loc-1' },
            addMatch: joinMatch,
          }),
        )
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.addMatch).toEqual({ kind: 'new_lot' })
    })

    it('quantity-only updateRowQuantity does not rematch', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans', quantity: 2 })]
      const rows = [
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: joinMatch,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))
      const originalMatch = result.current.state.rows[0].addMatch

      act(() => {
        result.current.updateRowQuantity('row-1', 9)
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.addData?.quantity).toBe(9)
      expect(updatedRow.addMatch).toBe(originalMatch)
      expect(updatedRow.status).toBe('ready')
    })

    it('keeps missing_quantity after inventory rematch when add quantity is 0', () => {
      const rows = [
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: joinMatch,
        }),
      ]
      const inventory = [makeItem({ id: 'lot-1', name: 'beans', quantity: 2 })]

      const { result, rerender } = renderHook(
        ({ inv }: { inv: Item[] }) => useBatchReview('add', rows, inv),
        { initialProps: { inv: inventory } },
      )

      act(() => {
        result.current.updateRowQuantity('row-1', 0)
      })

      expect(result.current.state.rows[0].status).toBe('missing_quantity')
      expect(result.current.canConfirm).toBe(false)

      rerender({
        inv: [makeItem({ id: 'lot-1', name: 'beans', quantity: 5 })],
      })

      expect(result.current.state.rows[0].status).toBe('missing_quantity')
      expect(result.current.canConfirm).toBe(false)
    })

    it('does not promote lot_choice to ready on inventory rematch', () => {
      const inventory = [
        makeItem({
          id: 'lot-1',
          name: 'beans',
          quantity: 2,
          expirationDate: '2026-09-10',
        }),
      ]
      const rows = [
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
        }),
      ]

      const { result, rerender } = renderHook(
        ({ inv }: { inv: Item[] }) => useBatchReview('add', rows, inv),
        { initialProps: { inv: inventory } },
      )

      expect(result.current.state.rows[0].status).toBe('lot_choice')
      expect(result.current.canConfirm).toBe(false)

      rerender({
        inv: [
          makeItem({
            id: 'lot-1',
            name: 'beans',
            quantity: 9,
            expirationDate: '2026-09-10',
          }),
        ],
      })

      expect(result.current.state.rows[0].status).toBe('lot_choice')
      expect(result.current.state.rows[0].addMatch?.kind).toBe('lot_choice')
      expect(result.current.canConfirm).toBe(false)
    })

    it('replaceRow that only changes quantity does not rematch', () => {
      const inventory = [makeItem({ id: 'lot-1', name: 'beans', quantity: 2 })]
      const rows = [
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: joinMatch,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))
      const originalMatch = result.current.state.rows[0].addMatch

      act(() => {
        result.current.replaceRow(
          'row-1',
          makeAddRow({
            addData: { name: 'beans', quantity: 99, unit: 'cans', locationId: 'loc-1' },
            addMatch: joinMatch,
          }),
        )
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.addData?.quantity).toBe(99)
      expect(updatedRow.addMatch).toBe(originalMatch)
    })

    it('rematches an undated add against a dated live lot into lot_choice, even after a parse-time join', () => {
      const inventory = [
        makeItem({
          id: 'lot-1',
          name: 'beans',
          quantity: 2,
          expirationDate: '2026-09-10',
        }),
      ]
      const rows = [
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: joinMatch,
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.status).toBe('lot_choice')
      expect(updatedRow.addMatch?.kind).toBe('lot_choice')
      if (updatedRow.addMatch?.kind === 'lot_choice') {
        expect(updatedRow.addMatch.candidate.itemId).toBe('lot-1')
        expect(updatedRow.addMatch.candidate.expirationDate).toBe('2026-09-10')
      }
      expect(result.current.canConfirm).toBe(false)
    })

    it('rematches a dated add against a same-date live lot into a join', () => {
      const inventory = [
        makeItem({
          id: 'lot-1',
          name: 'beans',
          quantity: 2,
          expirationDate: '2026-09-10',
        }),
      ]
      const rows = [
        makeAddRow({
          addData: {
            name: 'beans',
            quantity: 1,
            unit: 'cans',
            locationId: 'loc-1',
            expirationDate: '2026-09-10',
          },
          addMatch: { kind: 'new_lot' },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('add', rows, inventory))

      expect(result.current.state.rows[0].status).toBe('ready')
      expect(result.current.state.rows[0].addMatch).toEqual(joinMatch)
      expect(result.current.canConfirm).toBe(true)
    })

    it('rematches when live inventory arrives after a dateless parse-time match', () => {
      const rows = [
        makeAddRow({
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: joinMatch,
        }),
      ]

      const { result, rerender } = renderHook(
        ({ inv }: { inv: Item[] }) => useBatchReview('add', rows, inv),
        { initialProps: { inv: [] as Item[] } },
      )

      expect(result.current.state.rows[0].addMatch).toEqual(joinMatch)

      rerender({
        inv: [
          makeItem({
            id: 'lot-1',
            name: 'beans',
            quantity: 2,
            expirationDate: '2026-09-10',
          }),
        ],
      })

      expect(result.current.state.rows[0].status).toBe('lot_choice')
      expect(result.current.state.rows[0].addMatch?.kind).toBe('lot_choice')
    })

    it('does not overwrite a selectAddLot choice when inventory rematches later', () => {
      const inventory = [
        makeItem({
          id: 'lot-1',
          name: 'beans',
          quantity: 2,
          expirationDate: '2026-09-10',
        }),
      ]
      const rows = [
        makeAddRow({
          status: 'lot_choice',
          addData: { name: 'beans', quantity: 1, unit: 'cans', locationId: 'loc-1' },
          addMatch: {
            kind: 'lot_choice',
            candidate: {
              itemId: 'lot-1',
              name: 'beans',
              locationId: 'loc-1',
              quantity: 2,
              unit: 'cans',
              expirationDate: '2026-09-10',
            },
          },
        }),
      ]

      const { result, rerender } = renderHook(
        ({ inv }: { inv: Item[] }) => useBatchReview('add', rows, inv),
        { initialProps: { inv: inventory } },
      )

      act(() => {
        result.current.selectAddLot('row-1', null)
      })

      expect(result.current.state.rows[0].addMatch).toEqual({ kind: 'new_lot' })
      expect(result.current.state.rows[0].status).toBe('ready')

      rerender({
        inv: [
          makeItem({
            id: 'lot-1',
            name: 'beans',
            quantity: 9,
            expirationDate: '2026-09-10',
          }),
        ],
      })

      expect(result.current.state.rows[0].addMatch).toEqual({ kind: 'new_lot' })
      expect(result.current.state.rows[0].status).toBe('ready')
    })

    it('selectRemoveMatch still resolves a remove row when inventory is passed', () => {
      const candidates = [
        {
          item: { id: 'item-1', name: 'Cheddar', quantity: 1, unit: 'block', locationId: 'loc-1' },
          score: 0.7,
        },
        {
          item: { id: 'item-2', name: 'Swiss', quantity: 2, unit: 'block', locationId: 'loc-1' },
          score: 0.3,
        },
      ]
      const rows = [
        makeRemoveRow({
          status: 'ambiguous_match',
          removeData: {
            type: 'unresolved',
            requestedName: 'cheese',
            removeQuantity: 1,
            candidates,
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('remove', rows, [makeItem()], true))

      act(() => {
        result.current.selectRemoveMatch('row-1', 'item-2')
      })

      const updatedRow = result.current.state.rows[0]
      expect(updatedRow.status).toBe('ready')
      expect(updatedRow.removeData?.type).toBe('resolved')
      if (updatedRow.removeData?.type === 'resolved') {
        expect(updatedRow.removeData.matchedItemId).toBe('item-2')
      }
    })
  })

  describe('remove rematch', () => {
    it('keeps a resolved id and refreshes currentQuantity from the live list', () => {
      const rows = [
        makeRemoveRow({
          removeData: {
            type: 'resolved',
            matchedItemId: 'milk-1',
            matchedItemName: 'Milk',
            currentQuantity: 10,
            removeQuantity: 2,
            candidates: [],
          },
        }),
      ]
      const inventory = [makeItem({ id: 'milk-1', name: 'Milk', quantity: 3, unit: 'gallon' })]

      const { result } = renderHook(() => useBatchReview('remove', rows, inventory, false))

      const row = result.current.state.rows[0]
      expect(row.status).toBe('ready')
      expect(row.removeData?.type).toBe('resolved')
      if (row.removeData?.type === 'resolved') {
        expect(row.removeData.matchedItemId).toBe('milk-1')
        expect(row.removeData.currentQuantity).toBe(3)
        expect(row.removeData.removeQuantity).toBe(2)
      }
      expect(result.current.canConfirm).toBe(true)
    })

    it('rematches a gone id to the live same-name row', () => {
      const rows = [
        makeRemoveRow({
          removeData: {
            type: 'resolved',
            matchedItemId: 'gone-id',
            matchedItemName: 'Milk',
            currentQuantity: 10,
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ]
      const inventory = [makeItem({ id: 'live-milk', name: 'Milk', quantity: 4, unit: 'gallon' })]

      const { result } = renderHook(() => useBatchReview('remove', rows, inventory, false))

      const row = result.current.state.rows[0]
      expect(row.status).toBe('ready')
      expect(row.removeData?.type).toBe('resolved')
      if (row.removeData?.type === 'resolved') {
        expect(row.removeData.matchedItemId).toBe('live-milk')
        expect(row.removeData.matchedItemId).not.toBe('gone-id')
        expect(row.removeData.currentQuantity).toBe(4)
      }
    })

    it('marks every remove row no_match when the live list is empty and not loading', () => {
      const rows = [
        makeRemoveRow({
          id: 'row-1',
          removeData: {
            type: 'resolved',
            matchedItemId: 'milk-1',
            matchedItemName: 'Milk',
            currentQuantity: 10,
            removeQuantity: 1,
            candidates: [
              {
                item: {
                  id: 'milk-1',
                  name: 'Milk',
                  quantity: 10,
                  unit: 'gallon',
                  locationId: 'loc-1',
                },
                score: 1,
              },
            ],
          },
        }),
        makeRemoveRow({
          id: 'row-2',
          status: 'ambiguous_match',
          removeData: {
            type: 'unresolved',
            requestedName: 'cheese',
            removeQuantity: 1,
            candidates: [
              {
                item: { id: 'i1', name: 'Cheddar', quantity: 1, unit: 'each', locationId: 'loc-1' },
                score: 0.5,
              },
            ],
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('remove', rows, [], false))

      expect(result.current.state.rows).toHaveLength(2)
      for (const row of result.current.state.rows) {
        expect(row.status).toBe('no_match')
        expect(row.removeData?.type).toBe('unresolved')
        if (row.removeData?.type === 'unresolved') {
          expect(row.removeData.candidates).toEqual([])
        }
      }
      expect(result.current.canConfirm).toBe(false)
    })

    it('does not apply empty-house rematch while isLoading even if items are []', () => {
      const rows = [
        makeRemoveRow({
          removeData: {
            type: 'resolved',
            matchedItemId: 'milk-1',
            matchedItemName: 'Milk',
            currentQuantity: 10,
            removeQuantity: 2,
            candidates: [],
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('remove', rows, [], true))

      const row = result.current.state.rows[0]
      expect(row.status).toBe('ready')
      expect(row.removeData?.type).toBe('resolved')
      if (row.removeData?.type === 'resolved') {
        expect(row.removeData.matchedItemId).toBe('milk-1')
        expect(row.removeData.currentQuantity).toBe(10)
      }
    })

    it('replaceRow that changes the remove name always rematches and does not keep Milk', () => {
      const rows = [
        makeRemoveRow({
          removeData: {
            type: 'resolved',
            matchedItemId: 'milk-1',
            matchedItemName: 'Milk',
            currentQuantity: 3,
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ]
      const inventory = [
        makeItem({ id: 'milk-1', name: 'Milk', quantity: 3, unit: 'gallon' }),
        makeItem({ id: 'eggs-1', name: 'Eggs', quantity: 12, unit: 'each' }),
      ]

      const { result } = renderHook(() => useBatchReview('remove', rows, inventory, false))

      act(() => {
        result.current.replaceRow(
          'row-1',
          makeRemoveRow({
            removeData: {
              type: 'resolved',
              matchedItemId: 'milk-1',
              matchedItemName: 'Eggs',
              currentQuantity: 3,
              removeQuantity: 1,
              candidates: [],
            },
          }),
        )
      })

      const row = result.current.state.rows[0]
      expect(row.status).toBe('ready')
      expect(row.removeData?.type).toBe('resolved')
      if (row.removeData?.type === 'resolved') {
        expect(row.removeData.matchedItemId).toBe('eggs-1')
        expect(row.removeData.matchedItemName).toBe('Eggs')
        expect(row.removeData.matchedItemId).not.toBe('milk-1')
      }
    })

    it('name replaceRow while loading rematches to Eggs after inventory loads', () => {
      const rows = [
        makeRemoveRow({
          removeData: {
            type: 'resolved',
            matchedItemId: 'milk-1',
            matchedItemName: 'Milk',
            currentQuantity: 10,
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ]

      const { result, rerender } = renderHook(
        ({ inventory, isLoading }: { inventory: Item[]; isLoading: boolean }) =>
          useBatchReview('remove', rows, inventory, isLoading),
        { initialProps: { inventory: [] as Item[], isLoading: true } },
      )

      act(() => {
        result.current.replaceRow(
          'row-1',
          makeRemoveRow({
            removeData: {
              type: 'resolved',
              matchedItemId: 'milk-1',
              matchedItemName: 'Eggs',
              currentQuantity: 10,
              removeQuantity: 1,
              candidates: [],
            },
          }),
        )
      })

      const loadingRow = result.current.state.rows[0]
      expect(loadingRow.status).not.toBe('no_match')
      expect(loadingRow.removeData?.type).toBe('resolved')
      if (loadingRow.removeData?.type === 'resolved') {
        expect(loadingRow.removeData.matchedItemName).toBe('Eggs')
        expect(loadingRow.removeData.matchedItemId).toBe('milk-1')
      }

      rerender({
        inventory: [
          makeItem({ id: 'milk-1', name: 'Milk', quantity: 3, unit: 'gallon' }),
          makeItem({ id: 'eggs-1', name: 'Eggs', quantity: 12, unit: 'each' }),
        ],
        isLoading: false,
      })

      const row = result.current.state.rows[0]
      expect(row.status).toBe('ready')
      expect(row.removeData?.type).toBe('resolved')
      if (row.removeData?.type === 'resolved') {
        expect(row.removeData.matchedItemId).toBe('eggs-1')
        expect(row.removeData.matchedItemName).toBe('Eggs')
        expect(row.removeData.matchedItemId).not.toBe('milk-1')
      }
    })

    it('quantity-only updateRowQuantity does not rematch', () => {
      const rows = [
        makeRemoveRow({
          removeData: {
            type: 'resolved',
            matchedItemId: 'milk-1',
            matchedItemName: 'Milk',
            currentQuantity: 3,
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ]
      const inventory = [makeItem({ id: 'milk-1', name: 'Milk', quantity: 3, unit: 'gallon' })]

      const { result } = renderHook(() => useBatchReview('remove', rows, inventory, false))
      const originalId =
        result.current.state.rows[0].removeData?.type === 'resolved'
          ? result.current.state.rows[0].removeData.matchedItemId
          : null

      act(() => {
        result.current.updateRowQuantity('row-1', 2)
      })

      const row = result.current.state.rows[0]
      expect(row.removeData?.removeQuantity).toBe(2)
      expect(row.status).toBe('ready')
      if (row.removeData?.type === 'resolved') {
        expect(row.removeData.matchedItemId).toBe(originalId)
        expect(row.removeData.matchedItemId).toBe('milk-1')
        expect(row.removeData.currentQuantity).toBe(3)
      }
    })

    it('keeps missing_quantity after live refresh when remove quantity is 0', () => {
      const rows = [
        makeRemoveRow({
          removeData: {
            type: 'resolved',
            matchedItemId: 'milk-1',
            matchedItemName: 'Milk',
            currentQuantity: 3,
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ]
      const inventory = [makeItem({ id: 'milk-1', name: 'Milk', quantity: 3, unit: 'gallon' })]

      const { result, rerender } = renderHook(
        ({ inv }: { inv: Item[] }) => useBatchReview('remove', rows, inv, false),
        { initialProps: { inv: inventory } },
      )

      act(() => {
        result.current.updateRowQuantity('row-1', 0)
      })

      expect(result.current.state.rows[0].status).toBe('missing_quantity')
      expect(result.current.canConfirm).toBe(false)

      rerender({
        inv: [makeItem({ id: 'milk-1', name: 'Milk', quantity: 8, unit: 'gallon' })],
      })

      expect(result.current.state.rows[0].status).toBe('missing_quantity')
      expect(result.current.canConfirm).toBe(false)
      expect(result.current.state.rows[0].removeData?.type).toBe('resolved')
    })
  })
})
