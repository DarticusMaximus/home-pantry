import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocations } from '@/hooks/use-locations'

vi.mock('@/lib/appwrite/locations', () => ({
  getLocations: vi.fn(),
}))

import { getLocations } from '@/lib/appwrite/locations'

const mockedGetLocations = vi.mocked(getLocations)

describe('useLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('starts with loading state as true', () => {
    mockedGetLocations.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useLocations())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.locations).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('returns data after successful fetch', async () => {
    const mockLocations = [
      {
        id: '1',
        name: 'Fridge',
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        name: 'Freezer',
        sortOrder: 2,
        createdAt: '',
        updatedAt: '',
      },
    ]
    mockedGetLocations.mockResolvedValue(mockLocations)

    const { result } = renderHook(() => useLocations())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.locations).toEqual(mockLocations)
    expect(result.current.error).toBeNull()
  })

  it('returns error on fetch failure', async () => {
    mockedGetLocations.mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useLocations())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.locations).toEqual([])
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Failed to fetch')
  })

  it('refetch triggers new fetch', async () => {
    const mockLocations = [
      {
        id: '1',
        name: 'Fridge',
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      },
    ]
    mockedGetLocations.mockResolvedValue(mockLocations)

    const { result } = renderHook(() => useLocations())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const newLocations = [
      {
        id: '1',
        name: 'Fridge',
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        name: 'Freezer',
        sortOrder: 2,
        createdAt: '',
        updatedAt: '',
      },
    ]
    mockedGetLocations.mockResolvedValue(newLocations)

    result.current.refetch()

    await waitFor(() => {
      expect(result.current.locations).toHaveLength(2)
    })
  })

  it('calls getLocations without an activeOnly argument', async () => {
    mockedGetLocations.mockResolvedValue([])

    renderHook(() => useLocations())

    await waitFor(() => {
      expect(mockedGetLocations).toHaveBeenCalledWith()
    })
  })
})
