import { act, renderHook } from '@testing-library/react'
import { AppwriteException } from 'appwrite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuantity } from '@/hooks/use-quantity'
import * as itemsService from '@/lib/appwrite/items'
import type { Item } from '@/types/item'

vi.mock('@/lib/appwrite/items', () => ({
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}))

function createItem(overrides: Partial<{ id: string; quantity: number; unit: string }> = {}) {
  return {
    id: overrides.id ?? 'item1',
    name: 'Test Item',
    locationId: 'loc1',
    quantity: overrides.quantity ?? 4,
    unit: overrides.unit ?? 'each',
    createdById: 'user1',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

type UpdateItemResult = Awaited<ReturnType<typeof itemsService.updateItem>>

describe('useQuantity', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(itemsService.updateItem).mockReset()
    vi.mocked(itemsService.deleteItem).mockReset()
    vi.mocked(itemsService.updateItem).mockResolvedValue({} as Item)
    vi.mocked(itemsService.deleteItem).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('incrementQuantity', () => {
    it('calls updateItem with quantity only', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      const { result } = renderHook(() => useQuantity(onSuccess))

      act(() => {
        result.current.incrementQuantity(item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(5)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', {
        quantity: 5,
      })
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
    })
  })

  describe('decrementQuantity', () => {
    it('calls updateItem with quantity-1 when remaining is above 0', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 2 })
      const { result } = renderHook(() => useQuantity(onSuccess))

      act(() => {
        result.current.decrementQuantity(item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(1)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', {
        quantity: 1,
      })
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
    })

    it('writes remaining 0.5 when decrementing from 1.5', async () => {
      const item = createItem({ quantity: 1.5 })
      const { result } = renderHook(() => useQuantity())

      act(() => {
        result.current.decrementQuantity(item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(0.5)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', {
        quantity: 0.5,
      })
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
    })

    it('calls onZeroIntent and does not write when decrementing from 1', async () => {
      const onSuccess = vi.fn()
      const onZeroIntent = vi.fn()
      const item = createItem({ quantity: 1 })
      const { result } = renderHook(() => useQuantity(onSuccess, { onZeroIntent }))

      act(() => {
        result.current.decrementQuantity(item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(1)
      expect(onZeroIntent).toHaveBeenCalledTimes(1)
      expect(onZeroIntent).toHaveBeenCalledWith(item)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).not.toHaveBeenCalled()
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('calls onZeroIntent and does not write when decrementing a fractional leftover', async () => {
      const onZeroIntent = vi.fn()
      const item = createItem({ quantity: 0.5 })
      const { result } = renderHook(() => useQuantity(undefined, { onZeroIntent }))

      act(() => {
        result.current.decrementQuantity(item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(0.5)
      expect(onZeroIntent).toHaveBeenCalledWith(item)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).not.toHaveBeenCalled()
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
    })

    it('does not write remaining <= 0 when onZeroIntent is omitted', async () => {
      const item = createItem({ quantity: 1 })
      const { result } = renderHook(() => useQuantity())

      act(() => {
        result.current.decrementQuantity(item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(1)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).not.toHaveBeenCalled()
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
    })
  })

  describe('partialUse', () => {
    it('calls updateItem with the adjusted quantity when remaining is above 0', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      const { result } = renderHook(() => useQuantity(onSuccess))

      await act(async () => {
        result.current.partialUse(item, 2)
      })

      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', {
        quantity: 2,
      })
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })

    it('calls onZeroIntent and does not write when remaining is 0', async () => {
      const onSuccess = vi.fn()
      const onZeroIntent = vi.fn()
      const item = createItem({ quantity: 4 })
      const { result } = renderHook(() => useQuantity(onSuccess, { onZeroIntent }))

      await act(async () => {
        result.current.partialUse(item, 4)
      })

      expect(onZeroIntent).toHaveBeenCalledTimes(1)
      expect(onZeroIntent).toHaveBeenCalledWith(item)
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
      expect(itemsService.updateItem).not.toHaveBeenCalled()
      expect(onSuccess).not.toHaveBeenCalled()
      expect(result.current.getOptimisticQuantity(item)).toBe(4)
    })
  })

  describe('debounce', () => {
    it('rapid taps are debounced — multiple increments result in single server write with final quantity', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      const { result } = renderHook(() => useQuantity(onSuccess))

      act(() => {
        result.current.incrementQuantity(item)
      })
      act(() => {
        result.current.incrementQuantity(item)
      })
      act(() => {
        result.current.incrementQuantity(item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(7)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)
      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', {
        quantity: 7,
      })
    })
  })

  describe('mutation races', () => {
    it('flushes a pending increment when unmounted before the debounce elapses', async () => {
      const item = createItem({ quantity: 4 })
      const { result, unmount } = renderHook(() => useQuantity())

      act(() => {
        result.current.incrementQuantity(item)
        unmount()
      })

      await act(async () => {})

      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', {
        quantity: 5,
      })
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
    })

    it('does not write or call onZeroIntent on unmount after a would-be-zero decrement', async () => {
      const onZeroIntent = vi.fn()
      const item = createItem({ quantity: 1 })
      const { result, unmount } = renderHook(() => useQuantity(undefined, { onZeroIntent }))

      act(() => {
        result.current.decrementQuantity(item)
      })

      expect(onZeroIntent).toHaveBeenCalledTimes(1)

      act(() => {
        unmount()
      })

      await act(async () => {})

      expect(onZeroIntent).toHaveBeenCalledTimes(1)
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
      expect(itemsService.updateItem).not.toHaveBeenCalled()
    })

    it('does not write or call onZeroIntent on unmount after a would-be-zero partial use', async () => {
      const onZeroIntent = vi.fn()
      const item = createItem({ quantity: 4 })
      const { result, unmount } = renderHook(() => useQuantity(undefined, { onZeroIntent }))

      await act(async () => {
        result.current.partialUse(item, 4)
      })

      expect(onZeroIntent).toHaveBeenCalledTimes(1)

      act(() => {
        unmount()
      })

      await act(async () => {})

      expect(onZeroIntent).toHaveBeenCalledTimes(1)
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
      expect(itemsService.updateItem).not.toHaveBeenCalled()
    })

    it('bases a second debounced increment on the first resolved write', async () => {
      const item = createItem({ quantity: 4 })
      const firstWrite = deferred<UpdateItemResult>()
      vi.mocked(itemsService.updateItem).mockImplementationOnce(() => firstWrite.promise)
      let clearPatchesOnRefetch = () => {}
      const { result } = renderHook(() => {
        const quantity = useQuantity(() => clearPatchesOnRefetch())
        clearPatchesOnRefetch = quantity.clearPatchesOnRefetch
        return quantity
      })

      act(() => {
        result.current.incrementQuantity(item)
      })
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', {
        quantity: 5,
      })

      act(() => {
        result.current.incrementQuantity(item)
      })
      await act(async () => {
        firstWrite.resolve({} as Item)
      })
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenLastCalledWith('item1', {
        quantity: 6,
      })
    })

    it('serializes partial use behind an in-flight quantity flush', async () => {
      const item = createItem({ quantity: 4 })
      const firstWrite = deferred<UpdateItemResult>()
      vi.mocked(itemsService.updateItem).mockImplementationOnce(() => firstWrite.promise)
      const { result } = renderHook(() => useQuantity())

      act(() => {
        result.current.incrementQuantity(item)
      })
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      let partialUse: Promise<void>
      act(() => {
        partialUse = result.current.partialUse(item, 2)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)

      await act(async () => {
        firstWrite.resolve({} as Item)
        await partialUse
      })

      expect(itemsService.updateItem).toHaveBeenLastCalledWith('item1', {
        quantity: 3,
      })
      expect(result.current.patchItem(item).quantity).toBe(3)
    })

    it('serializes a debounced increment behind an in-flight partial use', async () => {
      const item = createItem({ quantity: 4 })
      const partialUseWrite = deferred<UpdateItemResult>()
      const incrementWrite = deferred<UpdateItemResult>()
      vi.mocked(itemsService.updateItem)
        .mockImplementationOnce(() => partialUseWrite.promise)
        .mockImplementationOnce(() => incrementWrite.promise)
      const { result } = renderHook(() => useQuantity())

      let partialUse: Promise<void>
      act(() => {
        partialUse = result.current.partialUse(item, 2)
        result.current.incrementQuantity(item)
      })
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)
      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', {
        quantity: 2,
      })

      await act(async () => {
        partialUseWrite.resolve({} as Item)
        await partialUse
      })

      expect(itemsService.updateItem).toHaveBeenLastCalledWith('item1', {
        quantity: 3,
      })

      await act(async () => {
        incrementWrite.resolve({} as Item)
      })

      expect(result.current.patchItem(item).quantity).toBe(3)
    })

    it('includes a pending increment in partial use before the debounce elapses', async () => {
      const item = createItem({ quantity: 4 })
      const { result } = renderHook(() => useQuantity())

      act(() => {
        result.current.incrementQuantity(item)
      })
      await act(async () => {
        await result.current.partialUse(item, 2)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)
      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', {
        quantity: 3,
      })
    })
  })

  describe('error handling', () => {
    it('on server failure, quantity rolls back to pre-tap value', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      vi.mocked(itemsService.updateItem).mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useQuantity(onSuccess))

      act(() => {
        result.current.incrementQuantity(item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(5)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(4)
    })

    it('on server failure in flushItem, sets error state', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      vi.mocked(itemsService.updateItem).mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useQuantity(onSuccess))

      act(() => {
        result.current.incrementQuantity(item)
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.error).toBe('Failed to update. Try again.')
    })

    it('on server failure in partialUse, sets error state', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      vi.mocked(itemsService.updateItem).mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useQuantity(onSuccess))

      await act(async () => {
        result.current.partialUse(item, 2)
      })

      expect(result.current.error).toBe('Failed to update. Try again.')
      expect(result.current.getOptimisticQuantity(item)).toBe(4)
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('on server failure in setQuantity, quantity rolls back and sets error state', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      vi.mocked(itemsService.updateItem).mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useQuantity(onSuccess))

      await act(async () => {
        await result.current.setQuantity(item, 7)
      })

      expect(result.current.error).toBe('Failed to update. Try again.')
      expect(result.current.getOptimisticQuantity(item)).toBe(4)
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('does not set flush error when decrementing would hit remaining <= 0', async () => {
      const onSuccess = vi.fn()
      const onZeroIntent = vi.fn()
      const item = createItem({ quantity: 1 })
      vi.mocked(itemsService.deleteItem).mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useQuantity(onSuccess, { onZeroIntent }))

      act(() => {
        result.current.decrementQuantity(item)
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(1)
      expect(result.current.error).toBeNull()
      expect(onSuccess).not.toHaveBeenCalled()
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
    })

    it('auto-clears error after timeout', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      vi.mocked(itemsService.updateItem).mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useQuantity(onSuccess))

      act(() => {
        result.current.incrementQuantity(item)
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.error).toBe('Failed to update. Try again.')

      await act(async () => {
        vi.advanceTimersByTime(4000)
      })

      expect(result.current.error).toBeNull()
    })

    it('starts with no error', () => {
      const onSuccess = vi.fn()
      const { result } = renderHook(() => useQuantity(onSuccess))

      expect(result.current.error).toBeNull()
    })

    it('treats document-not-found during flush as success', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      vi.mocked(itemsService.updateItem).mockRejectedValue(
        new AppwriteException('Document with the requested ID could not be found.', 404),
      )

      const { result } = renderHook(() => useQuantity(onSuccess))

      act(() => {
        result.current.incrementQuantity(item)
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)
      expect(result.current.error).toBeNull()
      expect(onSuccess).toHaveBeenCalled()
      expect(itemsService.deleteItem).not.toHaveBeenCalled()

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)
    })

    it('treats document-not-found during partialUse as success', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      vi.mocked(itemsService.updateItem).mockRejectedValue(
        new AppwriteException('Document with the requested ID could not be found.', 404),
      )

      const { result } = renderHook(() => useQuantity(onSuccess))

      await act(async () => {
        await result.current.partialUse(item, 2)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)
      expect(result.current.getOptimisticQuantity(item)).toBe(2)
      expect(result.current.error).toBeNull()
      expect(onSuccess).toHaveBeenCalled()
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
    })

    it('treats document-not-found during setQuantity as success', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      vi.mocked(itemsService.updateItem).mockRejectedValue(
        new AppwriteException('Document with the requested ID could not be found.', 404),
      )

      const { result } = renderHook(() => useQuantity(onSuccess))

      await act(async () => {
        await result.current.setQuantity(item, 7)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)
      expect(result.current.getOptimisticQuantity(item)).toBe(7)
      expect(result.current.error).toBeNull()
      expect(onSuccess).toHaveBeenCalled()
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
    })
  })

  describe('zero-intercept serialization', () => {
    it('multi-tap countdown from 2 intercepts once and does not flush after debounce', async () => {
      const onSuccess = vi.fn()
      const onZeroIntent = vi.fn()
      const item = createItem({ quantity: 2 })
      const { result } = renderHook(() => useQuantity(onSuccess, { onZeroIntent }))

      act(() => {
        result.current.decrementQuantity(item)
      })
      expect(result.current.getOptimisticQuantity(item)).toBe(1)

      act(() => {
        result.current.decrementQuantity(item)
      })

      expect(onZeroIntent).toHaveBeenCalledTimes(1)
      expect(onZeroIntent).toHaveBeenCalledWith(item)
      expect(result.current.getOptimisticQuantity(item)).toBe(1)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).not.toHaveBeenCalled()
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
      expect(onSuccess).not.toHaveBeenCalled()
      expect(result.current.error).toBeNull()
      expect(result.current.getOptimisticQuantity(item)).toBe(1)

      act(() => {
        result.current.cancelPendingWrites(item.id)
      })
    })

    it('partialUse with a pending increment keeps last-seen quantity and cancel-equivalent still flushes it', async () => {
      const onSuccess = vi.fn()
      const onZeroIntent = vi.fn()
      const item = createItem({ quantity: 4 })
      const { result } = renderHook(() => useQuantity(onSuccess, { onZeroIntent }))

      act(() => {
        result.current.incrementQuantity(item)
      })
      expect(result.current.getOptimisticQuantity(item)).toBe(5)

      await act(async () => {
        await result.current.partialUse(item, 5)
      })

      expect(onZeroIntent).toHaveBeenCalledTimes(1)
      expect(onZeroIntent).toHaveBeenCalledWith(item)
      expect(result.current.getOptimisticQuantity(item)).toBe(5)
      expect(itemsService.updateItem).not.toHaveBeenCalled()

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).not.toHaveBeenCalled()
      expect(result.current.getOptimisticQuantity(item)).toBe(5)

      act(() => {
        result.current.restorePendingWrites(item.id)
      })
      expect(result.current.getOptimisticQuantity(item)).toBe(5)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)
      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', { quantity: 5 })
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })

    it('cancelPendingWrites after intercept discards the pending delta so no later write occurs', async () => {
      const onSuccess = vi.fn()
      const onZeroIntent = vi.fn()
      const item = createItem({ quantity: 2 })
      const { result } = renderHook(() => useQuantity(onSuccess, { onZeroIntent }))

      act(() => {
        result.current.decrementQuantity(item)
        result.current.decrementQuantity(item)
      })

      expect(onZeroIntent).toHaveBeenCalledTimes(1)
      expect(result.current.getOptimisticQuantity(item)).toBe(1)

      act(() => {
        result.current.cancelPendingWrites(item.id)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(2)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).not.toHaveBeenCalled()
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
      expect(onSuccess).not.toHaveBeenCalled()
      expect(result.current.error).toBeNull()
    })
  })

  describe('in-flight flush overlay', () => {
    it('keeps increment quantity during an in-flight write', async () => {
      const item = createItem({ quantity: 4 })
      const write = deferred<UpdateItemResult>()
      vi.mocked(itemsService.updateItem).mockImplementation(() => write.promise)
      const { result } = renderHook(() => useQuantity())

      act(() => {
        result.current.incrementQuantity(item)
      })
      expect(result.current.getOptimisticQuantity(item)).toBe(5)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(5)
      expect(result.current.patchItem(item).quantity).toBe(5)

      await act(async () => {
        write.resolve({} as Item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(5)
      expect(result.current.patchItem(item).quantity).toBe(5)
    })

    it('keeps decrement quantity during an in-flight write', async () => {
      const item = createItem({ quantity: 4 })
      const write = deferred<UpdateItemResult>()
      vi.mocked(itemsService.updateItem).mockImplementation(() => write.promise)
      const { result } = renderHook(() => useQuantity())

      act(() => {
        result.current.decrementQuantity(item)
      })
      expect(result.current.getOptimisticQuantity(item)).toBe(3)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(3)
      expect(result.current.patchItem(item).quantity).toBe(3)

      await act(async () => {
        write.resolve({} as Item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(3)
      expect(result.current.patchItem(item).quantity).toBe(3)
    })

    it('keeps applied quantity during an in-flight partialUse after a pending increment', async () => {
      const item = createItem({ quantity: 4 })
      const write = deferred<UpdateItemResult>()
      vi.mocked(itemsService.updateItem).mockImplementation(() => write.promise)
      const { result } = renderHook(() => useQuantity())

      act(() => {
        result.current.incrementQuantity(item)
      })
      expect(result.current.getOptimisticQuantity(item)).toBe(5)

      act(() => {
        void result.current.partialUse(item, 2)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(3)
      expect(result.current.patchItem(item).quantity).toBe(3)

      await act(async () => {
        write.resolve({} as Item)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(3)
      expect(result.current.patchItem(item).quantity).toBe(3)
    })
  })

  describe('clearPatchesOnRefetch', () => {
    it('does not drop overlay for a stale fetched row; matching row and no-args do', async () => {
      const item = createItem({ quantity: 4 })
      const { result } = renderHook(() => useQuantity())

      act(() => {
        result.current.incrementQuantity(item)
      })
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.getOptimisticQuantity(item)).toBe(5)

      act(() => {
        result.current.clearPatchesOnRefetch([item])
      })
      expect(result.current.getOptimisticQuantity(item)).toBe(5)

      act(() => {
        result.current.clearPatchesOnRefetch()
      })
      expect(result.current.getOptimisticQuantity(item)).toBe(4)

      act(() => {
        result.current.incrementQuantity(item)
      })
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      const matching = { ...item, quantity: 5 }
      act(() => {
        result.current.clearPatchesOnRefetch([matching])
      })
      expect(result.current.getOptimisticQuantity(matching)).toBe(5)
    })
  })

  describe('setQuantity', () => {
    it('writes the typed quantity last when setQuantity follows a decrement inside the debounce window', async () => {
      const onSuccess = vi.fn()
      const item = createItem({ quantity: 4 })
      const { result } = renderHook(() => useQuantity(onSuccess))

      act(() => {
        result.current.decrementQuantity(item)
      })
      expect(result.current.getOptimisticQuantity(item)).toBe(3)
      expect(itemsService.updateItem).not.toHaveBeenCalled()

      await act(async () => {
        await result.current.setQuantity(item, 5)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)
      expect(itemsService.updateItem).toHaveBeenCalledWith('item1', { quantity: 5 })
      expect(result.current.getOptimisticQuantity(item)).toBe(5)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(itemsService.updateItem).toHaveBeenCalledTimes(1)
      expect(itemsService.updateItem).toHaveBeenLastCalledWith('item1', { quantity: 5 })
      expect(onSuccess).toHaveBeenCalled()
    })

    it('calls onZeroIntent and does not write when setQuantity would store <= 0', async () => {
      const onSuccess = vi.fn()
      const onZeroIntent = vi.fn()
      const item = createItem({ quantity: 4 })
      const { result } = renderHook(() => useQuantity(onSuccess, { onZeroIntent }))

      await act(async () => {
        await result.current.setQuantity(item, 0)
      })

      expect(onZeroIntent).toHaveBeenCalledTimes(1)
      expect(onZeroIntent).toHaveBeenCalledWith(item)
      expect(result.current.getOptimisticQuantity(item)).toBe(4)
      expect(itemsService.updateItem).not.toHaveBeenCalled()
      expect(itemsService.deleteItem).not.toHaveBeenCalled()
      expect(onSuccess).not.toHaveBeenCalled()
    })
  })
})
