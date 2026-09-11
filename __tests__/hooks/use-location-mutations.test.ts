import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCreateLocation,
  useDeleteLocation,
  useUpdateLocation,
} from '@/hooks/use-location-mutations'

vi.mock('@/lib/appwrite/locations', () => ({
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn(),
}))

import { createLocation, deleteLocation, updateLocation } from '@/lib/appwrite/locations'

describe('useLocationMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('useCreateLocation', () => {
    it('sets loading state during mutation', async () => {
      const mockCreateLocation = vi.mocked(createLocation)
      mockCreateLocation.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useCreateLocation())

      await act(async () => {
        result.current.mutate({ name: 'Fridge', sortOrder: 1 })
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('calls createLocation and calls onSuccess on success', async () => {
      const mockCreateLocation = vi.mocked(createLocation)
      mockCreateLocation.mockResolvedValue({} as never)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useCreateLocation(onSuccess))

      await act(async () => {
        await result.current.mutate({
          name: 'Fridge',
          sortOrder: 1,
        })
      })

      expect(mockCreateLocation).toHaveBeenCalledWith({
        name: 'Fridge',
        sortOrder: 1,
      })
      expect(onSuccess).toHaveBeenCalled()
      expect(result.current.isSuccess).toBe(true)
    })

    it('sets error on failure', async () => {
      const mockCreateLocation = vi.mocked(createLocation)
      mockCreateLocation.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useCreateLocation())

      await act(async () => {
        await expect(
          result.current.mutate({
            name: 'Fridge',
            sortOrder: 1,
          }),
        ).rejects.toThrow()
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('reset clears error and isSuccess', async () => {
      const mockCreateLocation = vi.mocked(createLocation)
      mockCreateLocation.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useCreateLocation())

      await act(async () => {
        await expect(
          result.current.mutate({
            name: 'Fridge',
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

  describe('useUpdateLocation', () => {
    it('sets loading state during mutation', async () => {
      const mockUpdateLocation = vi.mocked(updateLocation)
      mockUpdateLocation.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useUpdateLocation('loc-1'))

      await act(async () => {
        result.current.mutate({ name: 'Fridge' })
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('calls updateLocation with required hook id and calls onSuccess on success', async () => {
      const mockUpdateLocation = vi.mocked(updateLocation)
      mockUpdateLocation.mockResolvedValue({} as never)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useUpdateLocation('loc-1', onSuccess))

      await act(async () => {
        await result.current.mutate({ name: 'Updated' })
      })

      expect(mockUpdateLocation).toHaveBeenCalledWith('loc-1', {
        name: 'Updated',
      })
      expect(onSuccess).toHaveBeenCalled()
      expect(result.current.isSuccess).toBe(true)
    })

    it('sets error on failure', async () => {
      const mockUpdateLocation = vi.mocked(updateLocation)
      mockUpdateLocation.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useUpdateLocation('loc-1'))

      await act(async () => {
        await expect(result.current.mutate({ name: 'Fridge' })).rejects.toThrow()
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('reset clears error and isSuccess', async () => {
      const mockUpdateLocation = vi.mocked(updateLocation)
      mockUpdateLocation.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useUpdateLocation('loc-1'))

      await act(async () => {
        await expect(result.current.mutate({ name: 'Fridge' })).rejects.toThrow()
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

  describe('useDeleteLocation', () => {
    it('sets loading state during mutation', async () => {
      const mockDeleteLocation = vi.mocked(deleteLocation)
      mockDeleteLocation.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useDeleteLocation())

      await act(async () => {
        result.current.mutate('loc-1')
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('calls deleteLocation and calls onSuccess on success', async () => {
      const mockDeleteLocation = vi.mocked(deleteLocation)
      mockDeleteLocation.mockResolvedValue({} as never)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useDeleteLocation(onSuccess))

      await act(async () => {
        await result.current.mutate('loc-1')
      })

      expect(mockDeleteLocation).toHaveBeenCalledWith('loc-1')
      expect(onSuccess).toHaveBeenCalled()
      expect(result.current.isSuccess).toBe(true)
    })

    it('sets error on failure', async () => {
      const mockDeleteLocation = vi.mocked(deleteLocation)
      mockDeleteLocation.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useDeleteLocation())

      await act(async () => {
        await expect(result.current.mutate('loc-1')).rejects.toThrow()
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('reset clears error and isSuccess', async () => {
      const mockDeleteLocation = vi.mocked(deleteLocation)
      mockDeleteLocation.mockRejectedValue(new Error('Failed'))

      const { result } = renderHook(() => useDeleteLocation())

      await act(async () => {
        await expect(result.current.mutate('loc-1')).rejects.toThrow()
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
