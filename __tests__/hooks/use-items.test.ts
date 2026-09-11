import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useItem, useItems, useItemsByCategory, useItemsByLocation } from '@/hooks/use-items'
import * as itemsService from '@/lib/appwrite/items'
import { PantryUnreachableError } from '@/lib/pantry-reachability'
import type { Item } from '@/types/item'

vi.mock('@/lib/appwrite/items', () => ({
  getItems: vi.fn(),
  getItemById: vi.fn(),
  getItemsByLocation: vi.fn(),
  getItemsByCategory: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item1',
    name: 'Test Item',
    locationId: 'loc1',
    quantity: 1,
    unit: 'each',
    createdById: 'user1',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  }
}

describe('useItems', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns loading state initially and then items', async () => {
    const mockItems = [createItem({ id: '1', name: 'Milk' })]
    vi.mocked(itemsService.getItems).mockResolvedValue(mockItems)

    const { result } = renderHook(() => useItems())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.items).toEqual(mockItems)
    expect(result.current.error).toBeNull()
  })

  it('returns error state on failure', async () => {
    vi.mocked(itemsService.getItems).mockRejectedValue(new Error('Fetch failed'))

    const { result } = renderHook(() => useItems())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.items).toEqual([])
  })

  it('calls getItems without an activeOnly argument', async () => {
    vi.mocked(itemsService.getItems).mockResolvedValue([])

    renderHook(() => useItems())

    await waitFor(() => {
      expect(itemsService.getItems).toHaveBeenCalledWith()
    })
  })

  it('settles as PantryUnreachableError when getItems never settles', async () => {
    vi.useFakeTimers()
    vi.mocked(itemsService.getItems).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useItems())

    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(8000)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeInstanceOf(PantryUnreachableError)
  })
})

describe('useItem', () => {
  it('fetches single item', async () => {
    const mockItem = createItem({ id: '1', name: 'Milk' })
    vi.mocked(itemsService.getItemById).mockResolvedValue(mockItem)

    const { result } = renderHook(() => useItem('1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.item).toEqual(mockItem)
  })

  it('returns null when no id provided', async () => {
    const { result } = renderHook(() => useItem(''))

    await waitFor(() => {
      expect(result.current.item).toBeNull()
    })
  })

  it('settles not-loading with no fetch when id is empty', async () => {
    vi.mocked(itemsService.getItemById).mockClear()

    const { result } = renderHook(() => useItem(''))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.item).toBeNull()
    expect(result.current.error).toBeNull()
    expect(itemsService.getItemById).not.toHaveBeenCalled()
  })

  it('handles errors', async () => {
    vi.mocked(itemsService.getItemById).mockRejectedValue(new Error('Not found'))

    const { result } = renderHook(() => useItem('invalid'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('keeps newer results when the item id changes during a fetch', async () => {
    const itemA = deferred<Item>()
    const itemB = deferred<Item>()
    const resultA = createItem({ id: 'a', name: 'Item A' })
    const resultB = createItem({ id: 'b', name: 'Item B' })
    vi.mocked(itemsService.getItemById).mockImplementation((id) =>
      id === 'a' ? itemA.promise : itemB.promise,
    )

    const { result, rerender } = renderHook(({ id }) => useItem(id), {
      initialProps: { id: 'a' },
    })

    await waitFor(() => {
      expect(itemsService.getItemById).toHaveBeenCalledWith('a')
    })

    rerender({ id: 'b' })

    await waitFor(() => {
      expect(itemsService.getItemById).toHaveBeenCalledWith('b')
    })

    await act(async () => {
      itemB.resolve(resultB)
    })

    expect(result.current.item).toEqual(resultB)

    await act(async () => {
      itemA.resolve(resultA)
    })

    expect(result.current.item).toEqual(resultB)
  })
})

describe('useItemsByLocation', () => {
  it('fetches items by location', async () => {
    const mockItems = [createItem({ id: '1', name: 'Milk', locationId: 'loc1' })]
    vi.mocked(itemsService.getItemsByLocation).mockResolvedValue(mockItems)

    const { result } = renderHook(() => useItemsByLocation('loc1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.items).toEqual(mockItems)
    expect(itemsService.getItemsByLocation).toHaveBeenCalledWith('loc1')
  })

  it('returns empty array when no locationId', async () => {
    const { result } = renderHook(() => useItemsByLocation(''))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.items).toEqual([])
  })

  it('handles errors', async () => {
    vi.mocked(itemsService.getItemsByLocation).mockRejectedValue(new Error('Failed'))

    const { result } = renderHook(() => useItemsByLocation('loc1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('keeps newer results when the location changes during a fetch', async () => {
    const locationAItems = deferred<Item[]>()
    const locationBItems = deferred<Item[]>()
    const itemsA = [createItem({ id: 'a', name: 'Location A Milk', locationId: 'a' })]
    const itemsB = [createItem({ id: 'b', name: 'Location B Milk', locationId: 'b' })]
    vi.mocked(itemsService.getItemsByLocation).mockImplementation((locationId) =>
      locationId === 'a' ? locationAItems.promise : locationBItems.promise,
    )

    const { result, rerender } = renderHook(({ locationId }) => useItemsByLocation(locationId), {
      initialProps: { locationId: 'a' },
    })

    await waitFor(() => {
      expect(itemsService.getItemsByLocation).toHaveBeenCalledWith('a')
    })

    rerender({ locationId: 'b' })

    await waitFor(() => {
      expect(itemsService.getItemsByLocation).toHaveBeenCalledWith('b')
    })

    await act(async () => {
      locationBItems.resolve(itemsB)
    })

    expect(result.current.items).toEqual(itemsB)

    await act(async () => {
      locationAItems.resolve(itemsA)
    })

    expect(result.current.items).toEqual(itemsB)
  })
})

describe('useItemsByCategory', () => {
  it('fetches items by category', async () => {
    const mockItems = [createItem({ id: '1', name: 'Milk', categoryId: 'cat1' })]
    vi.mocked(itemsService.getItemsByCategory).mockResolvedValue(mockItems)

    const { result } = renderHook(() => useItemsByCategory('cat1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.items).toEqual(mockItems)
    expect(itemsService.getItemsByCategory).toHaveBeenCalledWith('cat1')
  })

  it('returns empty array when no categoryId', async () => {
    const { result } = renderHook(() => useItemsByCategory(''))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.items).toEqual([])
  })
})
