import { AppwriteException } from 'appwrite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BatchReviewRow } from '@/types/batch-review'
import type { CreateItemInput, Item } from '@/types/item'

vi.mock('@/lib/appwrite/items', () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getItemById: vi.fn(),
}))

import { createItem, deleteItem, getItemById, updateItem } from '@/lib/appwrite/items'
import { submitBatch } from '@/lib/batch/submit-batch'

const mockCreateItem = vi.mocked(createItem)
const mockUpdateItem = vi.mocked(updateItem)
const mockDeleteItem = vi.mocked(deleteItem)
const mockGetItemById = vi.mocked(getItemById)

const makeItem = (id: string): Item => ({
  id,
  name: 'Milk',
  quantity: 2,
  unit: 'each',
  locationId: 'loc-1',
  createdById: 'user-1',
  createdAt: '2026-12-01T00:00:00.000Z',
  updatedAt: '2026-12-01T00:00:00.000Z',
})

const makeAddRow = (overrides: Partial<BatchReviewRow> = {}): BatchReviewRow => ({
  id: 'row-1',
  operation: 'add',
  status: 'ready',
  source: { source: 'ai_text', raw: 'milk' },
  addData: {
    name: 'Milk',
    quantity: 2,
    unit: 'each',
    locationId: 'loc-1',
  },
  ...overrides,
})

const makeJoinRow = (overrides: Partial<BatchReviewRow> = {}): BatchReviewRow =>
  makeAddRow({
    addMatch: {
      kind: 'join',
      itemId: 'item-1',
      currentQuantity: 2,
      name: 'Milk',
      unit: 'each',
    },
    ...overrides,
  })

const makeRemoveRow = (overrides: Partial<BatchReviewRow> = {}): BatchReviewRow => ({
  id: 'row-r1',
  operation: 'remove',
  status: 'ready',
  source: { source: 'ai_text', raw: 'milk' },
  removeData: {
    type: 'resolved',
    matchedItemId: 'item-1',
    matchedItemName: 'Milk',
    currentQuantity: 5,
    removeQuantity: 2,
    candidates: [],
  },
  ...overrides,
})

const photoSource = { source: 'ai_image' as const, raw: 'milk photo' }

afterEach(() => {
  for (const [, data] of mockUpdateItem.mock.calls) {
    if (data && typeof data.quantity === 'number') {
      expect(data.quantity).toBeGreaterThan(0)
    }
  }
  vi.clearAllMocks()
})

describe('submitBatch', () => {
  describe('add batches', () => {
    it('calls createItem once per resolved add row', async () => {
      const rows = [
        makeAddRow({
          id: 'row-1',
          addData: { name: 'Milk', quantity: 2, unit: 'each', locationId: 'loc-1' },
        }),
        makeAddRow({
          id: 'row-2',
          addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-2' },
        }),
      ]

      mockCreateItem.mockResolvedValue(makeItem('new-1'))

      const result = await submitBatch('add', rows, 'user-1')

      expect(mockCreateItem).toHaveBeenCalledTimes(2)
      expect(mockCreateItem).toHaveBeenCalledWith({
        name: 'Milk',
        quantity: 2,
        unit: 'each',
        locationId: 'loc-1',
        createdById: 'user-1',
      })
      expect(mockCreateItem).toHaveBeenCalledWith({
        name: 'Bread',
        quantity: 1,
        unit: 'each',
        locationId: 'loc-2',
        createdById: 'user-1',
      })
      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.failures).toHaveLength(0)
    })

    it('reports partial failures with sanitized messages', async () => {
      const rows = [
        makeAddRow({
          id: 'row-1',
          addData: { name: 'Milk', quantity: 2, unit: 'each', locationId: 'loc-1' },
        }),
        makeAddRow({
          id: 'row-2',
          addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-2' },
        }),
      ]

      const error = new Error('AppwriteException: Document creation failed with code 409')
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockCreateItem.mockResolvedValueOnce(makeItem('new-1')).mockRejectedValueOnce(error)

      const result = await submitBatch('add', rows, 'user-1')

      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0].rowId).toBe('row-2')
      expect(result.failures[0].error).toBe('Failed to create item')
      expect(result.failures[0].error).not.toContain('AppwriteException')
      expect(consoleError).toHaveBeenCalledWith(
        'Batch row submission failed',
        { operation: 'add', rowId: 'row-2' },
        error,
      )
    })

    it('forwards every optional add field to createItem', async () => {
      const row = makeAddRow({
        addData: {
          name: 'Milk',
          quantity: 2,
          unit: 'each',
          locationId: 'loc-1',
          templateId: 'template-1',
          categoryId: 'category-1',
          expirationDate: '2026-12-31',
          purchaseDate: '2026-12-01',
          notes: 'Keep cold',
        },
      })
      mockCreateItem.mockResolvedValue(makeItem('new-1'))

      await submitBatch('add', [row], 'user-1')

      expect(mockCreateItem).toHaveBeenCalledWith({
        name: 'Milk',
        quantity: 2,
        unit: 'each',
        locationId: 'loc-1',
        templateId: 'template-1',
        categoryId: 'category-1',
        expirationDate: '2026-12-31',
        purchaseDate: '2026-12-01',
        notes: 'Keep cold',
        createdById: 'user-1',
      })
    })

    it('omits review-only pasteExpirationDate from createItem', async () => {
      const row = makeAddRow({
        source: photoSource,
        addData: {
          name: 'Yellow Potatoes',
          quantity: 1,
          unit: 'each',
          locationId: 'loc-1',
          purchaseDate: '2026-09-08',
          pasteExpirationDate: null,
        },
      })
      mockCreateItem.mockResolvedValue(makeItem('new-1'))

      await submitBatch('add', [row], 'user-1')

      expect(mockCreateItem).toHaveBeenCalledTimes(1)
      expect(mockCreateItem.mock.calls[0][0]).toEqual({
        name: 'Yellow Potatoes',
        quantity: 1,
        unit: 'each',
        locationId: 'loc-1',
        purchaseDate: '2026-09-08',
        createdById: 'user-1',
      })
      expect(mockCreateItem.mock.calls[0][0]).not.toHaveProperty('pasteExpirationDate')
    })

    it('omits a certain pasteExpirationDate while keeping expirationDate', async () => {
      const row = makeAddRow({
        addData: {
          name: 'Milk',
          quantity: 2,
          unit: 'gal',
          locationId: 'loc-1',
          expirationDate: '2026-05-01',
          pasteExpirationDate: '2026-05-01',
        },
      })
      mockCreateItem.mockResolvedValue(makeItem('new-1'))

      await submitBatch('add', [row], 'user-1')

      expect(mockCreateItem).toHaveBeenCalledWith({
        name: 'Milk',
        quantity: 2,
        unit: 'gal',
        locationId: 'loc-1',
        expirationDate: '2026-05-01',
        createdById: 'user-1',
      })
      expect(mockCreateItem.mock.calls[0][0]).not.toHaveProperty('pasteExpirationDate')
    })

    it('reports non-ready add rows without creating items', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const row = makeAddRow({ id: 'missing-location', status: 'missing_location' })

      const result = await submitBatch('add', [row], 'user-1')

      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(result).toEqual({
        total: 1,
        succeeded: 0,
        failed: 1,
        failures: [{ rowId: 'missing-location', error: 'Failed to create item' }],
      })
      expect(consoleError).toHaveBeenCalledWith(
        'Batch row submission failed',
        { operation: 'add', rowId: 'missing-location' },
        expect.any(Error),
      )
    })

    it('joins by re-reading the lot and updating quantity only', async () => {
      const row = makeJoinRow({
        addData: {
          name: 'Milk',
          quantity: 2,
          unit: 'each',
          locationId: 'loc-1',
          categoryId: 'dairy',
          notes: 'Do not write me',
          purchaseDate: '2026-12-01',
          expirationDate: '2026-12-31',
        },
      })
      mockGetItemById.mockResolvedValue(makeItem('item-1'))
      mockUpdateItem.mockResolvedValue(makeItem('item-1'))

      const result = await submitBatch('add', [row], 'user-1')

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).toHaveBeenCalledTimes(1)
      expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 4 })
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('creates when the joined lot is gone', async () => {
      const row = makeJoinRow({
        addData: {
          name: 'Milk',
          quantity: 2,
          unit: 'each',
          locationId: 'loc-1',
          pasteExpirationDate: null,
        },
      })
      mockGetItemById.mockRejectedValue(
        new AppwriteException('Document with the requested ID could not be found.', 404),
      )
      mockCreateItem.mockResolvedValue(makeItem('new-1'))

      const result = await submitBatch('add', [row], 'user-1')

      expect(mockCreateItem).toHaveBeenCalledWith({
        name: 'Milk',
        quantity: 2,
        unit: 'each',
        locationId: 'loc-1',
        createdById: 'user-1',
      })
      expect(mockCreateItem.mock.calls[0][0]).not.toHaveProperty('pasteExpirationDate')
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('does not clone a join when the live read returns 500', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetItemById.mockRejectedValue(new AppwriteException('Server error', 500))

      const result = await submitBatch('add', [makeJoinRow()], 'user-1')

      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].error).toBe('Failed to update item')
      expect(consoleError).toHaveBeenCalled()
    })

    it('does not clone a join when the live read is a network error', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetItemById.mockRejectedValue(new Error('Network error'))

      const result = await submitBatch('add', [makeJoinRow()], 'user-1')

      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].error).toBe('Failed to update item')
      expect(consoleError).toHaveBeenCalled()
    })

    it('creates new lots without re-reading inventory', async () => {
      const rows = [
        makeAddRow({
          id: 'row-new',
          addMatch: { kind: 'new_lot' },
        }),
        makeAddRow({
          id: 'row-bare',
          addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-2' },
        }),
      ]
      mockCreateItem.mockResolvedValue(makeItem('new-1'))

      await submitBatch('add', rows, 'user-1')

      expect(mockGetItemById).not.toHaveBeenCalled()
      expect(mockCreateItem).toHaveBeenCalledTimes(2)
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })

    it('stacks sequential joins to the same lot from live quantity', async () => {
      let liveQuantity = 2
      mockGetItemById.mockImplementation(async () => ({
        ...makeItem('item-1'),
        quantity: liveQuantity,
      }))
      mockUpdateItem.mockImplementation(async (_id, data) => {
        if (data.quantity != null) liveQuantity = data.quantity
        return { ...makeItem('item-1'), quantity: liveQuantity }
      })

      const rows = [
        makeJoinRow({
          id: 'row-1',
          addData: { name: 'Milk', quantity: 2, unit: 'each', locationId: 'loc-1' },
        }),
        makeJoinRow({
          id: 'row-2',
          addData: { name: 'Milk', quantity: 1, unit: 'each', locationId: 'loc-1' },
        }),
      ]

      const result = await submitBatch('add', rows, 'user-1')

      expect(mockUpdateItem.mock.calls).toEqual([
        ['item-1', { quantity: 4 }],
        ['item-1', { quantity: 5 }],
      ])
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(2)
    })

    it('reports join update failures without Appwrite text', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('AppwriteException: Document update failed with code 409')
      mockGetItemById.mockResolvedValue(makeItem('item-1'))
      mockUpdateItem.mockRejectedValue(error)

      const result = await submitBatch('add', [makeJoinRow()], 'user-1')

      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].rowId).toBe('row-1')
      expect(result.failures[0].error).toBe('Failed to update item')
      expect(result.failures[0].error).not.toContain('AppwriteException')
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalledWith(
        'Batch row submission failed',
        { operation: 'add', rowId: 'row-1' },
        expect.any(Error),
      )
    })

    it('does not write unready join rows', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const row = makeJoinRow({ id: 'unready-join', status: 'missing_location' })

      const result = await submitBatch('add', [row], 'user-1')

      expect(mockGetItemById).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(result.failed).toBe(1)
      expect(result.failures[0].error).toBe('Failed to create item')
      expect(consoleError).toHaveBeenCalled()
    })

    it('does not create an add with quantity 0 even if status is ready', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const row = makeAddRow({
        id: 'zero-qty',
        status: 'ready',
        addData: { name: 'Milk', quantity: 0, unit: 'each', locationId: 'loc-1' },
      })

      const result = await submitBatch('add', [row], 'user-1')

      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].rowId).toBe('zero-qty')
      expect(result.failures[0].error).toBe('Failed to create item')
      expect(consoleError).toHaveBeenCalled()
    })

    it('does not write a ready+uncertain add for paste or photo', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const parseMetadata = {
        parseWarnings: [],
        isUncertain: true,
        uncertaintyReason: 'guessed quantity',
      }

      for (const source of [
        { source: 'ai_text' as const, raw: 'milk' },
        { source: 'ai_image' as const, raw: 'milk photo' },
      ]) {
        mockCreateItem.mockClear()
        mockUpdateItem.mockClear()
        mockGetItemById.mockClear()
        const row = makeAddRow({
          id: `guessed-${source.source}`,
          status: 'ready',
          source,
          parseMetadata,
        })

        const result = await submitBatch('add', [row], 'user-1')

        expect(mockCreateItem).not.toHaveBeenCalled()
        expect(mockUpdateItem).not.toHaveBeenCalled()
        expect(mockGetItemById).not.toHaveBeenCalled()
        expect(result.succeeded).toBe(0)
        expect(result.failed).toBe(1)
        expect(result.failures[0].rowId).toBe(`guessed-${source.source}`)
      }
      expect(consoleError).toHaveBeenCalled()
    })

    it('writes only the known ready sibling when another is still a guess', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const rows = [
        makeAddRow({
          id: 'known-row',
          addData: { name: 'Milk', quantity: 2, unit: 'each', locationId: 'loc-1' },
        }),
        makeAddRow({
          id: 'guessed-row',
          addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-2' },
          parseMetadata: {
            parseWarnings: [],
            isUncertain: true,
            uncertaintyReason: 'blurry',
          },
        }),
      ]
      mockCreateItem.mockResolvedValue(makeItem('new-1'))

      const result = await submitBatch('add', rows, 'user-1')

      expect(mockCreateItem).toHaveBeenCalledTimes(1)
      expect(mockCreateItem).toHaveBeenCalledWith({
        name: 'Milk',
        quantity: 2,
        unit: 'each',
        locationId: 'loc-1',
        createdById: 'user-1',
      })
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.failures[0].rowId).toBe('guessed-row')
      expect(consoleError).toHaveBeenCalled()
    })

    it('writes only the ready add when a sibling is unready', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const rows = [
        makeAddRow({
          id: 'ready-row',
          addData: { name: 'Milk', quantity: 2, unit: 'each', locationId: 'loc-1' },
        }),
        makeAddRow({
          id: 'unready-row',
          status: 'missing_location',
          addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: '' },
        }),
      ]
      mockCreateItem.mockResolvedValue(makeItem('new-1'))

      const result = await submitBatch('add', rows, 'user-1')

      expect(mockCreateItem).toHaveBeenCalledTimes(1)
      expect(mockCreateItem).toHaveBeenCalledWith({
        name: 'Milk',
        quantity: 2,
        unit: 'each',
        locationId: 'loc-1',
        createdById: 'user-1',
      })
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.failures[0].rowId).toBe('unready-row')
      expect(consoleError).toHaveBeenCalled()
    })
  })

  describe('remove batches', () => {
    it('re-reads live quantity and ignores snapshot currentQuantity', async () => {
      const rows = [
        makeRemoveRow({
          id: 'row-r1',
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-1',
            matchedItemName: 'Milk',
            currentQuantity: 10,
            removeQuantity: 2,
            candidates: [],
          },
        }),
      ]

      mockGetItemById.mockResolvedValue({ ...makeItem('item-1'), quantity: 5 })
      mockUpdateItem.mockResolvedValue(makeItem('item-1'))

      const result = await submitBatch('remove', rows, 'user-1')

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).toHaveBeenCalledTimes(1)
      expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 3 })
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('deletes when live remaining is zero', async () => {
      const rows = [
        makeRemoveRow({
          id: 'row-r1',
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-1',
            matchedItemName: 'Milk',
            currentQuantity: 10,
            removeQuantity: 2,
            candidates: [],
          },
        }),
      ]

      mockGetItemById.mockResolvedValue({ ...makeItem('item-1'), quantity: 2 })
      mockDeleteItem.mockResolvedValue(undefined)

      await submitBatch('remove', rows, 'user-1')

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })

    it('does not write when the item is already gone', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetItemById.mockRejectedValue(
        new AppwriteException('Document with the requested ID could not be found.', 404),
      )

      const result = await submitBatch('remove', [makeRemoveRow()], 'user-1')

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].rowId).toBe('row-r1')
      expect(result.failures[0].error).toBe('That item is already gone.')
      expect(result.failures[0].error).not.toContain('Appwrite')
      expect(consoleError).toHaveBeenCalledWith(
        'Batch row submission failed',
        { operation: 'remove', rowId: 'row-r1' },
        expect.any(Error),
      )
    })

    it('does not treat a live-read 500 as already gone', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetItemById.mockRejectedValue(new AppwriteException('Server error', 500))

      const result = await submitBatch('remove', [makeRemoveRow()], 'user-1')

      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].error).toBe('Failed to update item')
      expect(result.failures[0].error).not.toBe('That item is already gone.')
      expect(consoleError).toHaveBeenCalled()
    })

    it('does not treat a network error as already gone', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetItemById.mockRejectedValue(new Error('Network error'))

      const result = await submitBatch('remove', [makeRemoveRow()], 'user-1')

      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].error).toBe('Failed to update item')
      expect(result.failures[0].error).not.toBe('That item is already gone.')
      expect(consoleError).toHaveBeenCalled()
    })

    it('stacks sequential removes of the same id from live quantity', async () => {
      let liveQuantity = 5
      mockGetItemById.mockImplementation(async () => ({
        ...makeItem('item-1'),
        quantity: liveQuantity,
      }))
      mockUpdateItem.mockImplementation(async (_id, data) => {
        if (data.quantity != null) liveQuantity = data.quantity
        return { ...makeItem('item-1'), quantity: liveQuantity }
      })

      const rows = [
        makeRemoveRow({
          id: 'row-r1',
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-1',
            matchedItemName: 'Milk',
            currentQuantity: 5,
            removeQuantity: 2,
            candidates: [],
          },
        }),
        makeRemoveRow({
          id: 'row-r2',
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-1',
            matchedItemName: 'Milk',
            currentQuantity: 5,
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ]

      const result = await submitBatch('remove', rows, 'user-1')

      expect(mockGetItemById).toHaveBeenNthCalledWith(1, 'item-1')
      expect(mockGetItemById).toHaveBeenNthCalledWith(2, 'item-1')
      expect(mockUpdateItem.mock.calls).toEqual([
        ['item-1', { quantity: 3 }],
        ['item-1', { quantity: 2 }],
      ])
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('does not write unready remove rows', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const row = makeRemoveRow({
        id: 'unready-remove',
        status: 'no_match',
        removeData: {
          type: 'unresolved',
          requestedName: 'Milk',
          removeQuantity: 2,
          candidates: [],
        },
      })

      const result = await submitBatch('remove', [row], 'user-1')

      expect(mockGetItemById).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].rowId).toBe('unready-remove')
      expect(result.failures[0].error).toBe('Failed to update item')
      expect(consoleError).toHaveBeenCalledWith(
        'Batch row submission failed',
        { operation: 'remove', rowId: 'unready-remove' },
        expect.any(Error),
      )
    })

    it('does not write a ready+uncertain remove', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const row = makeRemoveRow({
        id: 'guessed-remove',
        status: 'ready',
        parseMetadata: {
          parseWarnings: [],
          isUncertain: true,
          uncertaintyReason: 'guessed match',
        },
      })

      const result = await submitBatch('remove', [row], 'user-1')

      expect(mockGetItemById).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].rowId).toBe('guessed-remove')
      expect(consoleError).toHaveBeenCalled()
    })

    it('does not write a remove with quantity 0 even if status is ready', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const row = makeRemoveRow({
        id: 'zero-remove',
        status: 'ready',
        removeData: {
          type: 'resolved',
          matchedItemId: 'item-1',
          matchedItemName: 'Milk',
          currentQuantity: 5,
          removeQuantity: 0,
          candidates: [],
        },
      })

      const result = await submitBatch('remove', [row], 'user-1')

      expect(mockGetItemById).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].rowId).toBe('zero-remove')
      expect(result.failures[0].error).toBe('Failed to update item')
      expect(consoleError).toHaveBeenCalled()
    })

    it('deletes on over-remove and never writes quantity 0 or negative', async () => {
      const rows = [
        makeRemoveRow({
          id: 'row-r1',
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-1',
            matchedItemName: 'Milk',
            currentQuantity: 2,
            removeQuantity: 5,
            candidates: [],
          },
        }),
      ]

      mockGetItemById.mockResolvedValue({ ...makeItem('item-1'), quantity: 2 })
      mockDeleteItem.mockResolvedValue(undefined)

      const result = await submitBatch('remove', rows, 'user-1')

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalledWith('item-1', { quantity: 0 })
      expect(mockUpdateItem).not.toHaveBeenCalledWith('item-1', { quantity: -3 })
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('reports partial failures for remove operations', async () => {
      const rows = [
        makeRemoveRow({
          id: 'row-r1',
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-1',
            matchedItemName: 'Milk',
            currentQuantity: 5,
            removeQuantity: 1,
            candidates: [],
          },
        }),
        makeRemoveRow({
          id: 'row-r2',
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-2',
            matchedItemName: 'Bread',
            currentQuantity: 3,
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ]

      mockGetItemById
        .mockResolvedValueOnce({ ...makeItem('item-1'), quantity: 5 })
        .mockResolvedValueOnce({ ...makeItem('item-2'), name: 'Bread', quantity: 3 })
      mockUpdateItem
        .mockResolvedValueOnce(makeItem('item-1'))
        .mockRejectedValueOnce(new Error('AppwriteException: Document not found (404)'))

      const result = await submitBatch('remove', rows, 'user-1')

      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.failures[0].rowId).toBe('row-r2')
      expect(result.failures[0].error).toBe('Failed to update item')
      expect(result.failures[0].error).not.toContain('AppwriteException')
    })
  })

  describe('photo save pins (ai_image)', () => {
    it('joins a photo add by re-reading the lot and updating quantity only', async () => {
      const row = makeJoinRow({
        source: photoSource,
        addData: { name: 'Milk', quantity: 2, unit: 'each', locationId: 'loc-1' },
      })
      mockGetItemById.mockResolvedValue(makeItem('item-1'))
      mockUpdateItem.mockResolvedValue(makeItem('item-1'))

      const result = await submitBatch('add', [row], 'user-1')

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).toHaveBeenCalledTimes(1)
      expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 4 })
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('does not clone a photo join when the live read blips', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const row = makeJoinRow({ source: photoSource })
      mockGetItemById.mockRejectedValue(new AppwriteException('Server error', 500))

      const result = await submitBatch('add', [row], 'user-1')

      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(result.failed).toBe(1)
      expect(result.failures[0].error).toBe('Failed to update item')
      expect(consoleError).toHaveBeenCalled()
    })

    it('creates a photo new lot without re-reading inventory', async () => {
      const row = makeAddRow({
        id: 'row-new',
        source: photoSource,
        addMatch: { kind: 'new_lot' },
        addData: {
          name: 'Milk',
          quantity: 2,
          unit: 'each',
          locationId: 'loc-1',
          pasteExpirationDate: null,
        },
      })
      mockCreateItem.mockResolvedValue(makeItem('new-1'))

      const result = await submitBatch('add', [row], 'user-1')

      expect(mockGetItemById).not.toHaveBeenCalled()
      expect(mockCreateItem).toHaveBeenCalledTimes(1)
      expect(mockCreateItem.mock.calls[0][0]).not.toHaveProperty('pasteExpirationDate')
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(1)
    })

    it('does not write a photo lot_choice or unready add', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const lotChoice = makeAddRow({
        id: 'lot-choice',
        status: 'lot_choice',
        source: photoSource,
        addMatch: {
          kind: 'lot_choice',
          candidate: {
            itemId: 'item-1',
            name: 'Milk',
            locationId: 'loc-1',
            quantity: 2,
            unit: 'each',
          },
        },
      })
      const unready = makeAddRow({
        id: 'unready-photo',
        status: 'missing_location',
        source: photoSource,
      })

      const result = await submitBatch('add', [lotChoice, unready], 'user-1')

      expect(mockGetItemById).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(2)
      expect(consoleError).toHaveBeenCalled()
    })

    it('updates remaining quantity for a photo remove from live stock', async () => {
      const row = makeRemoveRow({ source: photoSource })
      mockGetItemById.mockResolvedValue({ ...makeItem('item-1'), quantity: 5 })
      mockUpdateItem.mockResolvedValue(makeItem('item-1'))

      const result = await submitBatch('remove', [row], 'user-1')

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).toHaveBeenCalledTimes(1)
      expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 3 })
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('deletes a photo remove that takes the live lot to none', async () => {
      const row = makeRemoveRow({
        source: photoSource,
        removeData: {
          type: 'resolved',
          matchedItemId: 'item-1',
          matchedItemName: 'Milk',
          currentQuantity: 2,
          removeQuantity: 2,
          candidates: [],
        },
      })
      mockGetItemById.mockResolvedValue({ ...makeItem('item-1'), quantity: 2 })
      mockDeleteItem.mockResolvedValue(undefined)

      const result = await submitBatch('remove', [row], 'user-1')

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalledWith('item-1', { quantity: 0 })
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('does not write a photo remove when the item is already gone', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetItemById.mockRejectedValue(
        new AppwriteException('Document with the requested ID could not be found.', 404),
      )

      const result = await submitBatch('remove', [makeRemoveRow({ source: photoSource })], 'user-1')

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.failures[0].error).toBe('That item is already gone.')
      expect(consoleError).toHaveBeenCalled()
    })
  })

  describe('mixed mode rejection', () => {
    it('rejects mixed add/remove rows with clear error', async () => {
      const rows = [makeAddRow(), makeRemoveRow()]

      await expect(submitBatch('add', rows, 'user-1')).rejects.toThrow(
        'Mixed operations are not supported',
      )
    })
  })

  describe('total tracking', () => {
    it('returns total count matching input rows', async () => {
      const rows = [
        makeAddRow({ id: 'row-1' }),
        makeAddRow({ id: 'row-2' }),
        makeAddRow({ id: 'row-3' }),
      ]

      mockCreateItem.mockResolvedValue(makeItem('new'))

      const result = await submitBatch('add', rows, 'user-1')

      expect(result.total).toBe(3)
    })
  })

  describe('chunked processing', () => {
    it('processes rows in chunks when chunkSize is specified', async () => {
      const rows = Array.from({ length: 5 }, (_, i) =>
        makeAddRow({
          id: `row-${i + 1}`,
          addData: { name: `Item ${i + 1}`, quantity: 1, unit: 'each', locationId: 'loc-1' },
        }),
      )

      let resolveFirst: ((value: Item) => void) | undefined
      const firstCall = new Promise<Item>((resolve) => {
        resolveFirst = resolve
      })

      const callOrder: number[] = []
      mockCreateItem.mockImplementation(async (data: CreateItemInput) => {
        callOrder.push(parseInt(data.name.split(' ')[1], 10))
        if (callOrder.length === 1) {
          await firstCall
        }
        return makeItem('new')
      })

      const resultPromise = submitBatch('add', rows, 'user-1', { chunkSize: 2 })

      await new Promise((r) => setTimeout(r, 10))
      expect(callOrder.length).toBeLessThanOrEqual(2)

      if (!resolveFirst) throw new Error('Expected first call resolver')
      resolveFirst(makeItem('new'))
      const result = await resultPromise

      expect(result.succeeded).toBe(5)
      expect(result.total).toBe(5)
      expect(result.failed).toBe(0)
      expect(mockCreateItem).toHaveBeenCalledTimes(5)
    })

    it('fires onChunkComplete callback after each chunk', async () => {
      const rows = Array.from({ length: 7 }, (_, i) =>
        makeAddRow({
          id: `row-${i + 1}`,
          addData: { name: `Item ${i + 1}`, quantity: 1, unit: 'each', locationId: 'loc-1' },
        }),
      )

      mockCreateItem.mockResolvedValue(makeItem('new'))

      const progressCalls: Array<{ processed: number; total: number }> = []
      await submitBatch('add', rows, 'user-1', {
        chunkSize: 3,
        onChunkComplete: (processed, total) => {
          progressCalls.push({ processed, total })
        },
      })

      expect(progressCalls).toEqual([
        { processed: 3, total: 7 },
        { processed: 6, total: 7 },
        { processed: 7, total: 7 },
      ])
    })

    it('handles failures across chunks correctly', async () => {
      const rows = Array.from({ length: 4 }, (_, i) =>
        makeAddRow({
          id: `row-${i + 1}`,
          addData: { name: `Item ${i + 1}`, quantity: 1, unit: 'each', locationId: 'loc-1' },
        }),
      )

      mockCreateItem
        .mockResolvedValueOnce(makeItem('new-1'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(makeItem('new-3'))
        .mockRejectedValueOnce(new Error('fail'))

      const result = await submitBatch('add', rows, 'user-1', { chunkSize: 2 })

      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(2)
      expect(result.failures).toEqual([
        { rowId: 'row-2', error: 'Failed to create item' },
        { rowId: 'row-4', error: 'Failed to create item' },
      ])
    })

    it('uses default chunk size of 10 when no options provided', async () => {
      const rows = Array.from({ length: 25 }, (_, i) =>
        makeAddRow({
          id: `row-${i + 1}`,
          addData: { name: `Item ${i + 1}`, quantity: 1, unit: 'each', locationId: 'loc-1' },
        }),
      )

      mockCreateItem.mockResolvedValue(makeItem('new'))

      const result = await submitBatch('add', rows, 'user-1')

      expect(result.succeeded).toBe(25)
      expect(result.total).toBe(25)
      expect(result.failed).toBe(0)
    })
  })
})
