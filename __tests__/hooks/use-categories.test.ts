import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCategories } from '@/hooks/use-categories'

vi.mock('@/lib/appwrite/categories', () => ({
  getCategories: vi.fn(),
}))

import { getCategories } from '@/lib/appwrite/categories'

const mockedGetCategories = vi.mocked(getCategories)

describe('useCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('starts with loading state as true', () => {
    mockedGetCategories.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useCategories())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.categories).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('returns data after successful fetch', async () => {
    const mockCategories = [
      {
        id: '1',
        name: 'Meat',
        sortOrder: 1,
        color: '#ef4444',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        name: 'Dairy',
        sortOrder: 2,
        color: '#f97316',
        createdAt: '',
        updatedAt: '',
      },
    ]
    mockedGetCategories.mockResolvedValue(mockCategories)

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.categories).toEqual(mockCategories)
    expect(result.current.error).toBeNull()
  })

  it('returns error on fetch failure', async () => {
    mockedGetCategories.mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.categories).toEqual([])
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Failed to fetch')
  })

  it('refetch triggers new fetch', async () => {
    const mockCategories = [
      {
        id: '1',
        name: 'Meat',
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      },
    ]
    mockedGetCategories.mockResolvedValue(mockCategories)

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const newCategories = [
      {
        id: '1',
        name: 'Meat',
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        name: 'Dairy',
        sortOrder: 2,
        createdAt: '',
        updatedAt: '',
      },
    ]
    mockedGetCategories.mockResolvedValue(newCategories)

    result.current.refetch()

    await waitFor(() => {
      expect(result.current.categories).toHaveLength(2)
    })
  })

  it('calls getCategories without an activeOnly argument', async () => {
    mockedGetCategories.mockResolvedValue([])

    renderHook(() => useCategories())

    await waitFor(() => {
      expect(mockedGetCategories).toHaveBeenCalledWith()
    })
  })
})
