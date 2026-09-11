import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCreateItem, useDeleteItem, useUpdateItem } from '@/hooks/use-item-mutations'
import * as itemsService from '@/lib/appwrite/items'

vi.mock('@/lib/appwrite/items', () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}))

describe('useCreateItem', () => {
  it('calls createItem and onSuccess', async () => {
    const onSuccess = vi.fn()
    const mockInput = {
      name: 'Bread',
      locationId: 'loc1',
      quantity: 1,
      unit: 'loaf',
      createdById: 'user1',
    }
    vi.mocked(itemsService.createItem).mockResolvedValue({ id: '1', ...mockInput } as any)

    const { result } = renderHook(() => useCreateItem(onSuccess))

    await act(async () => {
      await result.current.mutate(mockInput as any)
    })

    expect(itemsService.createItem).toHaveBeenCalledWith(mockInput)
    expect(onSuccess).toHaveBeenCalled()
    expect(result.current.isSuccess).toBe(true)
  })

  it('handles errors', async () => {
    vi.mocked(itemsService.createItem).mockRejectedValue(new Error('Create failed'))

    const { result } = renderHook(() => useCreateItem())

    await act(async () => {
      try {
        await result.current.mutate({ name: 'Fail' } as any)
      } catch {
        // ignore
      }
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.isSuccess).toBe(false)
  })
})

describe('useUpdateItem', () => {
  it('calls updateItem', async () => {
    const onSuccess = vi.fn()
    vi.mocked(itemsService.updateItem).mockResolvedValue({
      id: '1',
      name: 'New Name',
    } as any)

    const { result } = renderHook(() => useUpdateItem(onSuccess))

    await act(async () => {
      await result.current.mutateWithId('1', { name: 'New Name' })
    })

    expect(itemsService.updateItem).toHaveBeenCalledWith('1', { name: 'New Name' })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('handles errors', async () => {
    vi.mocked(itemsService.updateItem).mockRejectedValue(new Error('Update failed'))

    const { result } = renderHook(() => useUpdateItem())

    await act(async () => {
      try {
        await result.current.mutateWithId('1', { name: 'Fail' } as any)
      } catch {
        // ignore
      }
    })

    expect(result.current.error).toBeInstanceOf(Error)
  })
})

describe('useDeleteItem', () => {
  it('calls deleteItem', async () => {
    const onSuccess = vi.fn()
    vi.mocked(itemsService.deleteItem).mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteItem(onSuccess))

    await act(async () => {
      await result.current.mutate('1')
    })

    expect(itemsService.deleteItem).toHaveBeenCalledWith('1')
    expect(onSuccess).toHaveBeenCalled()
  })

  it('handles errors', async () => {
    vi.mocked(itemsService.deleteItem).mockRejectedValue(new Error('Delete failed'))

    const { result } = renderHook(() => useDeleteItem())

    await act(async () => {
      try {
        await result.current.mutate('1')
      } catch {
        // ignore
      }
    })

    expect(result.current.error).toBeInstanceOf(Error)
  })
})
