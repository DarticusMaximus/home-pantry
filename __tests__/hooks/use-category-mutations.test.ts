import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/use-category-mutations'

vi.mock('@/lib/appwrite/categories', () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

import { createCategory, deleteCategory, updateCategory } from '@/lib/appwrite/categories'

describe('useCategoryMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('useCreateCategory', () => {
    it('sets loading state during mutation', async () => {
      const mockCreateCategory = vi.mocked(createCategory)
      mockCreateCategory.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useCreateCategory())

      await act(async () => {
        result.current.mutate({
          name: 'Test',
          color: '#fff',
          sortOrder: 1,
        })
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('calls createCategory and calls onSuccess on success', async () => {
      const mockCreateCategory = vi.mocked(createCategory)
      mockCreateCategory.mockResolvedValue({} as never)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useCreateCategory(onSuccess))

      await act(async () => {
        await result.current.mutate({
          name: 'Test',
          color: '#fff',
          sortOrder: 1,
        })
      })

      expect(mockCreateCategory).toHaveBeenCalledWith({
        name: 'Test',
        color: '#fff',
        sortOrder: 1,
      })
      expect(onSuccess).toHaveBeenCalled()
      expect(result.current.isSuccess).toBe(true)
    })

    it('sets error on failure', async () => {
      const mockCreateCategory = vi.mocked(createCategory)
      mockCreateCategory.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useCreateCategory())

      await act(async () => {
        await expect(
          result.current.mutate({
            name: 'Test',
            color: '#fff',
            sortOrder: 1,
          }),
        ).rejects.toThrow()
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('reset clears error and isSuccess', async () => {
      const mockCreateCategory = vi.mocked(createCategory)
      mockCreateCategory.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useCreateCategory())

      await act(async () => {
        await expect(
          result.current.mutate({
            name: 'Test',
            color: '#fff',
            sortOrder: 1,
          }),
        ).rejects.toThrow()
      })

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.isSuccess).toBe(false)

      act(() => {
        result.current.reset()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.isSuccess).toBe(false)
    })
  })

  describe('useUpdateCategory', () => {
    it('sets loading state during mutation', async () => {
      const mockUpdateCategory = vi.mocked(updateCategory)
      mockUpdateCategory.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useUpdateCategory('cat-1'))

      await act(async () => {
        result.current.mutate({ name: 'Test' })
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('calls updateCategory with required hook id and calls onSuccess on success', async () => {
      const mockUpdateCategory = vi.mocked(updateCategory)
      mockUpdateCategory.mockResolvedValue({} as never)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useUpdateCategory('cat-1', onSuccess))

      await act(async () => {
        await result.current.mutate({ name: 'Updated' })
      })

      expect(mockUpdateCategory).toHaveBeenCalledWith('cat-1', {
        name: 'Updated',
      })
      expect(onSuccess).toHaveBeenCalled()
      expect(result.current.isSuccess).toBe(true)
    })

    it('sets error on failure', async () => {
      const mockUpdateCategory = vi.mocked(updateCategory)
      mockUpdateCategory.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useUpdateCategory('cat-1'))

      await act(async () => {
        await expect(result.current.mutate({ name: 'Test' })).rejects.toThrow()
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('reset clears error and isSuccess', async () => {
      const mockUpdateCategory = vi.mocked(updateCategory)
      mockUpdateCategory.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useUpdateCategory('cat-1'))

      await act(async () => {
        await expect(result.current.mutate({ name: 'Test' })).rejects.toThrow()
      })

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.isSuccess).toBe(false)

      act(() => {
        result.current.reset()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.isSuccess).toBe(false)
    })
  })

  describe('useDeleteCategory', () => {
    it('sets loading state during mutation', async () => {
      const mockDeleteCategory = vi.mocked(deleteCategory)
      mockDeleteCategory.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useDeleteCategory())

      await act(async () => {
        result.current.mutate('cat-1')
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('calls deleteCategory and calls onSuccess on success', async () => {
      const mockDeleteCategory = vi.mocked(deleteCategory)
      mockDeleteCategory.mockResolvedValue({} as never)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useDeleteCategory(onSuccess))

      await act(async () => {
        await result.current.mutate('cat-1')
      })

      expect(mockDeleteCategory).toHaveBeenCalledWith('cat-1')
      expect(onSuccess).toHaveBeenCalled()
      expect(result.current.isSuccess).toBe(true)
    })

    it('sets error on failure', async () => {
      const mockDeleteCategory = vi.mocked(deleteCategory)
      mockDeleteCategory.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useDeleteCategory())

      await act(async () => {
        await expect(result.current.mutate('cat-1')).rejects.toThrow()
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('reset clears error and isSuccess', async () => {
      const mockDeleteCategory = vi.mocked(deleteCategory)
      mockDeleteCategory.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useDeleteCategory())

      await act(async () => {
        await expect(result.current.mutate('cat-1')).rejects.toThrow()
      })

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.isSuccess).toBe(false)

      act(() => {
        result.current.reset()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.isSuccess).toBe(false)
    })
  })
})
