import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from '@/app/(app)/page'
import type { Item } from '@/types/item'
import type { Location } from '@/types/location'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-items', () => ({
  useItems: vi.fn(),
}))

vi.mock('@/hooks/use-locations', () => ({
  useLocations: vi.fn(),
}))

vi.mock('@/hooks/use-categories', () => ({
  useCategories: vi.fn(),
}))

vi.mock('@/hooks/use-item-mutations', () => ({
  useUpdateItem: vi.fn(),
  useDeleteItem: vi.fn(),
}))

vi.mock('@/hooks/use-search', () => ({
  useSearchItems: vi.fn(),
}))

vi.mock('@/hooks/use-quantity', () => ({
  useQuantity: vi.fn(),
}))

vi.mock('@/hooks/use-delayed-loading', () => ({
  useDelayedLoading: vi.fn((isLoading: boolean) => isLoading),
}))

vi.mock('@/contexts/search-mode-context', () => ({
  useSearchMode: vi.fn(),
}))

vi.mock('@/lib/appwrite/items', () => ({
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

import { useAuth } from '@/contexts/auth-context'
import { useSearchMode } from '@/contexts/search-mode-context'
import { useCategories } from '@/hooks/use-categories'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { useDeleteItem, useUpdateItem } from '@/hooks/use-item-mutations'
import { useItems } from '@/hooks/use-items'
import { useLocations } from '@/hooks/use-locations'
import { useQuantity } from '@/hooks/use-quantity'
import { useSearchItems } from '@/hooks/use-search'
import { deleteItem, updateItem } from '@/lib/appwrite/items'
import { CANNOT_REACH_PANTRY_COPY } from '@/lib/pantry-reachability'

const mockUseAuth = vi.mocked(useAuth)
const mockUseItems = vi.mocked(useItems)
const mockUseLocations = vi.mocked(useLocations)
const mockUseCategories = vi.mocked(useCategories)
const mockUseUpdateItem = vi.mocked(useUpdateItem)
const mockUseDeleteItem = vi.mocked(useDeleteItem)
const mockUseSearchItems = vi.mocked(useSearchItems)
const mockUseDelayedLoading = vi.mocked(useDelayedLoading)
const mockUseQuantity = vi.mocked(useQuantity)
const mockUseSearchMode = vi.mocked(useSearchMode)
const mockDeleteItem = vi.mocked(deleteItem)
const mockUpdateItem = vi.mocked(updateItem)
const mockCancelPendingWrites = vi.fn()
const mockRestorePendingWrites = vi.fn()
const mockClearPatchesOnRefetch = vi.fn()

function localYmd(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: 'Milk',
    quantity: 1,
    unit: 'gal',
    locationId: 'loc1',
    createdById: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'loc1',
    name: 'Fridge',
    icon: 'snowflake',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function useStatefulSearchMode() {
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [expiringOnly, setExpiringOnly] = useState(false)
  return {
    isSearching,
    setIsSearching,
    registerClearFilters: vi.fn(),
    focusField: false,
    openSearch: vi.fn(),
    exitSearch: vi.fn(),
    clearFocusField: vi.fn(),
    searchQuery,
    setSearchQuery,
    selectedLocationId,
    setSelectedLocationId,
    selectedCategoryId,
    setSelectedCategoryId,
    expiringOnly,
    setExpiringOnly,
  }
}

function quantityMockReturn(options?: { onZeroIntent?: (item: Item) => void }) {
  return {
    incrementQuantity: vi.fn(),
    decrementQuantity: vi.fn((item: Item) => {
      if (item.quantity - 1 <= 0) {
        options?.onZeroIntent?.(item)
      }
    }),
    partialUse: vi.fn((item: Item, amount: number) => {
      if (item.quantity - amount <= 0) {
        options?.onZeroIntent?.(item)
      }
      return Promise.resolve()
    }),
    setQuantity: vi.fn().mockResolvedValue(undefined),
    cancelPendingWrites: mockCancelPendingWrites,
    restorePendingWrites: mockRestorePendingWrites,
    getOptimisticQuantity: (item: { quantity: number }) => item.quantity,
    patchItem: (item: Item) => item,
    patchItems: (items: Item[]) => items,
    clearPatchesOnRefetch: mockClearPatchesOnRefetch,
    isFlushing: false,
    error: null,
  }
}

function renderSearchingHome(item: Item) {
  const refetch = vi.fn()
  mockUseSearchMode.mockReturnValue({
    isSearching: true,
    setIsSearching: vi.fn(),
    registerClearFilters: vi.fn(),
    focusField: false,
    openSearch: vi.fn(),
    exitSearch: vi.fn(),
    clearFocusField: vi.fn(),
  })
  mockUseItems.mockReturnValue({
    items: [item],
    isLoading: false,
    error: null,
    refetch,
  })
  mockUseSearchItems.mockReturnValue({
    filteredItems: [item],
    searchQuery: '',
    setSearchQuery: vi.fn(),
    selectedLocationId: null,
    setSelectedLocationId: vi.fn(),
    selectedCategoryId: null,
    setSelectedCategoryId: vi.fn(),
    expiringOnly: false,
    setExpiringOnly: vi.fn(),
    clearFilters: vi.fn(),
    isSearching: true,
  })
  render(<HomePage />)
  return { refetch }
}

describe('HomePage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        $id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      } as never,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    mockUseItems.mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    mockUseLocations.mockReturnValue({
      locations: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    mockUseUpdateItem.mockReturnValue({
      mutateWithId: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    mockUseDeleteItem.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    mockUseSearchMode.mockImplementation(useStatefulSearchMode)

    mockUseSearchItems.mockReturnValue({
      filteredItems: [],
      searchQuery: '',
      setSearchQuery: vi.fn(),
      selectedLocationId: null,
      setSelectedLocationId: vi.fn(),
      selectedCategoryId: null,
      setSelectedCategoryId: vi.fn(),
      expiringOnly: false,
      setExpiringOnly: vi.fn(),
      clearFilters: vi.fn(),
      isSearching: false,
    })

    mockUseQuantity.mockImplementation((_onSuccess, options) => quantityMockReturn(options))
    mockDeleteItem.mockResolvedValue(undefined)
    mockUpdateItem.mockResolvedValue({} as Item)
    mockUseDelayedLoading.mockImplementation((isLoading: boolean) => isLoading)
  })

  describe('when user is authenticated', () => {
    it('renders dashboard launchpad with item count', () => {
      mockUseItems.mockReturnValue({
        items: [
          {
            id: '1',
            name: 'Steak',
            quantity: 4,
            unit: 'each',
            locationId: 'loc1',
          } as never,
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<HomePage />)

      expect(screen.getByText('1 item')).toBeInTheDocument()
    })

    it('renders locations as cards', () => {
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      mockUseLocations.mockReturnValue({
        locations: [
          {
            id: 'loc1',
            name: 'Large Freezer',
            icon: 'snowflake',
            sortOrder: 1,
          } as never,
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<HomePage />)

      expect(screen.getByText('Large Freezer')).toBeInTheDocument()
    })
  })

  describe('location browse', () => {
    it('shows loc1 items and hides loc2 items after tapping the loc1 card', async () => {
      const { useSearchItems: actualUseSearchItems } =
        await vi.importActual<typeof import('@/hooks/use-search')>('@/hooks/use-search')
      mockUseSearchItems.mockImplementation(actualUseSearchItems)

      const loc1Item = makeItem({ id: 'item-loc1', name: 'Fridge Milk', locationId: 'loc1' })
      const loc2Item = makeItem({
        id: 'item-loc2',
        name: 'Pantry Beans',
        locationId: 'loc2',
      })

      mockUseItems.mockReturnValue({
        items: [loc1Item, loc2Item],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })
      mockUseLocations.mockReturnValue({
        locations: [
          makeLocation({ id: 'loc1', name: 'Fridge' }),
          makeLocation({ id: 'loc2', name: 'Pantry', icon: 'box', sortOrder: 2 }),
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<HomePage />)

      fireEvent.click(screen.getByRole('button', { name: 'Fridge, 1 item' }))

      expect(screen.getByText('Fridge Milk')).toBeInTheDocument()
      expect(screen.queryByText('Pantry Beans')).not.toBeInTheDocument()
    })
  })

  describe('expiring browse', () => {
    it('shows soon and expired names after tapping the expiring button', async () => {
      const { useSearchItems: actualUseSearchItems } =
        await vi.importActual<typeof import('@/hooks/use-search')>('@/hooks/use-search')
      mockUseSearchItems.mockImplementation(actualUseSearchItems)

      const expiredItem = makeItem({
        id: 'expired',
        name: 'Expired Yogurt',
        expirationDate: localYmd(-2),
      })
      const soonItem = makeItem({
        id: 'soon',
        name: 'Soon Cheese',
        expirationDate: localYmd(3),
      })
      const farItem = makeItem({
        id: 'far',
        name: 'Far Pasta',
        expirationDate: localYmd(8),
      })
      const undatedItem = makeItem({
        id: 'undated',
        name: 'Undated Rice',
      })

      mockUseItems.mockReturnValue({
        items: [expiredItem, soonItem, farItem, undatedItem],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })
      mockUseLocations.mockReturnValue({
        locations: [makeLocation({ id: 'loc1', name: 'Fridge' })],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<HomePage />)

      fireEvent.click(screen.getByRole('button', { name: '2 items expiring soon. Tap to filter.' }))

      expect(screen.getByText('Expired Yogurt')).toBeInTheDocument()
      expect(screen.getByText('Soon Cheese')).toBeInTheDocument()
      expect(screen.queryByText('Far Pasta')).not.toBeInTheDocument()
      expect(screen.queryByText('Undated Rice')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Expiring soon \(2\)/ })).toBeInTheDocument()
    })
  })

  describe('when loading', () => {
    it('shows loading state', () => {
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      mockUseLocations.mockReturnValue({
        locations: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      const { container } = render(<HomePage />)

      const skeletons = container.querySelectorAll('.animate-shimmer')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('shows skeletons and no unreachable copy when all three lists are loading', () => {
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })
      mockUseLocations.mockReturnValue({
        locations: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })
      mockUseCategories.mockReturnValue({
        categories: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      const { container } = render(<HomePage />)

      expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(0)
      expect(screen.queryByText(CANNOT_REACH_PANTRY_COPY)).not.toBeInTheDocument()
    })
  })

  describe('when pantry is unreachable', () => {
    it('shows named copy on dead-host first load with empty items and no 0 items', () => {
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: false,
        error: new Error('fail'),
        refetch: vi.fn(),
      })

      render(<HomePage />)

      expect(screen.getByText(CANNOT_REACH_PANTRY_COPY)).toBeInTheDocument()
      expect(screen.queryByText('0 items')).not.toBeInTheDocument()
      expect(screen.queryByText('All good')).not.toBeInTheDocument()
    })

    it('shows named copy instead of leftover rows', () => {
      mockUseItems.mockReturnValue({
        items: [makeItem({ name: 'Milk' })],
        isLoading: false,
        error: new Error('fail'),
        refetch: vi.fn(),
      })
      mockUseLocations.mockReturnValue({
        locations: [makeLocation()],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<HomePage />)

      expect(screen.getByText(CANNOT_REACH_PANTRY_COPY)).toBeInTheDocument()
      expect(screen.queryByText('Milk')).not.toBeInTheDocument()
      expect(screen.queryByText('1 item')).not.toBeInTheDocument()
    })

    it('shows named copy when locations fail and hides a live item row', () => {
      mockUseItems.mockReturnValue({
        items: [makeItem({ name: 'Milk' })],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })
      mockUseLocations.mockReturnValue({
        locations: [],
        isLoading: false,
        error: new Error('fail'),
        refetch: vi.fn(),
      })

      render(<HomePage />)

      expect(screen.getByText(CANNOT_REACH_PANTRY_COPY)).toBeInTheDocument()
      expect(screen.queryByText('Milk')).not.toBeInTheDocument()
      expect(screen.queryByText('1 item')).not.toBeInTheDocument()
    })

    it('shows named copy immediately when one fetch errors while another is still loading', () => {
      mockUseItems.mockReturnValue({
        items: [makeItem({ name: 'Milk' })],
        isLoading: false,
        error: new Error('fail'),
        refetch: vi.fn(),
      })
      mockUseLocations.mockReturnValue({
        locations: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })
      mockUseCategories.mockReturnValue({
        categories: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      const { container } = render(<HomePage />)

      expect(screen.getByText(CANNOT_REACH_PANTRY_COPY)).toBeInTheDocument()
      expect(screen.queryByText('Milk')).not.toBeInTheDocument()
      expect(container.querySelectorAll('.animate-shimmer').length).toBe(0)
    })

    it('keeps the empty-house launchpad when items are empty and all errors are null', () => {
      render(<HomePage />)

      expect(screen.getByText('0 items')).toBeInTheDocument()
      expect(screen.queryByText(CANNOT_REACH_PANTRY_COPY)).not.toBeInTheDocument()
    })

    it('retries items, locations, and categories together', () => {
      const refetchItems = vi.fn()
      const refetchLocations = vi.fn()
      const refetchCategories = vi.fn()
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: false,
        error: new Error('fail'),
        refetch: refetchItems,
      })
      mockUseLocations.mockReturnValue({
        locations: [],
        isLoading: false,
        error: null,
        refetch: refetchLocations,
      })
      mockUseCategories.mockReturnValue({
        categories: [],
        isLoading: false,
        error: null,
        refetch: refetchCategories,
      })

      render(<HomePage />)
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

      expect(refetchItems).toHaveBeenCalled()
      expect(refetchLocations).toHaveBeenCalled()
      expect(refetchCategories).toHaveBeenCalled()
    })

    it('keeps named line while leftover items are in flight after Try again', () => {
      mockUseDelayedLoading.mockReturnValue(false)
      const leftover = makeItem({ name: 'Milk' })
      const fridge = makeLocation()
      const refetchItems = vi.fn()
      const refetchLocations = vi.fn()
      const refetchCategories = vi.fn()

      mockUseItems.mockReturnValue({
        items: [leftover],
        isLoading: false,
        error: new Error('fail'),
        refetch: refetchItems,
      })
      mockUseLocations.mockReturnValue({
        locations: [fridge],
        isLoading: false,
        error: null,
        refetch: refetchLocations,
      })
      mockUseCategories.mockReturnValue({
        categories: [],
        isLoading: false,
        error: null,
        refetch: refetchCategories,
      })

      const { rerender } = render(<HomePage />)

      expect(screen.getByText(CANNOT_REACH_PANTRY_COPY)).toBeInTheDocument()
      expect(screen.queryByText('Milk')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

      mockUseItems.mockReturnValue({
        items: [leftover],
        isLoading: true,
        error: null,
        refetch: refetchItems,
      })
      mockUseLocations.mockReturnValue({
        locations: [fridge],
        isLoading: true,
        error: null,
        refetch: refetchLocations,
      })
      mockUseCategories.mockReturnValue({
        categories: [],
        isLoading: true,
        error: null,
        refetch: refetchCategories,
      })
      rerender(<HomePage />)

      expect(screen.getByText(CANNOT_REACH_PANTRY_COPY)).toBeInTheDocument()
      expect(screen.queryByText('Milk')).not.toBeInTheDocument()
      expect(screen.queryByText('1 item')).not.toBeInTheDocument()
      expect(screen.queryByText('0 items')).not.toBeInTheDocument()
      expect(screen.queryByText('Fridge')).not.toBeInTheDocument()
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()

      mockUseItems.mockReturnValue({
        items: [leftover],
        isLoading: false,
        error: null,
        refetch: refetchItems,
      })
      mockUseLocations.mockReturnValue({
        locations: [fridge],
        isLoading: false,
        error: null,
        refetch: refetchLocations,
      })
      mockUseCategories.mockReturnValue({
        categories: [],
        isLoading: false,
        error: null,
        refetch: refetchCategories,
      })
      rerender(<HomePage />)

      expect(screen.queryByText(CANNOT_REACH_PANTRY_COPY)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Fridge, 1 item' })).toBeInTheDocument()
    })

    it('keeps named line while empty leftover items are in flight after Try again', () => {
      mockUseDelayedLoading.mockReturnValue(false)
      const liveRow = makeItem({ name: 'Milk' })
      const fridge = makeLocation()
      const refetchItems = vi.fn()
      const refetchLocations = vi.fn()
      const refetchCategories = vi.fn()

      mockUseItems.mockReturnValue({
        items: [],
        isLoading: false,
        error: new Error('fail'),
        refetch: refetchItems,
      })
      mockUseLocations.mockReturnValue({
        locations: [fridge],
        isLoading: false,
        error: null,
        refetch: refetchLocations,
      })
      mockUseCategories.mockReturnValue({
        categories: [],
        isLoading: false,
        error: null,
        refetch: refetchCategories,
      })

      const { rerender } = render(<HomePage />)

      expect(screen.getByText(CANNOT_REACH_PANTRY_COPY)).toBeInTheDocument()
      expect(screen.queryByText('0 items')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

      mockUseItems.mockReturnValue({
        items: [],
        isLoading: true,
        error: null,
        refetch: refetchItems,
      })
      mockUseLocations.mockReturnValue({
        locations: [fridge],
        isLoading: true,
        error: null,
        refetch: refetchLocations,
      })
      mockUseCategories.mockReturnValue({
        categories: [],
        isLoading: true,
        error: null,
        refetch: refetchCategories,
      })
      rerender(<HomePage />)

      expect(screen.getByText(CANNOT_REACH_PANTRY_COPY)).toBeInTheDocument()
      expect(screen.queryByText('Milk')).not.toBeInTheDocument()
      expect(screen.queryByText('0 items')).not.toBeInTheDocument()
      expect(screen.queryByText('Fridge')).not.toBeInTheDocument()
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()

      mockUseItems.mockReturnValue({
        items: [liveRow],
        isLoading: false,
        error: null,
        refetch: refetchItems,
      })
      mockUseLocations.mockReturnValue({
        locations: [fridge],
        isLoading: false,
        error: null,
        refetch: refetchLocations,
      })
      mockUseCategories.mockReturnValue({
        categories: [],
        isLoading: false,
        error: null,
        refetch: refetchCategories,
      })
      rerender(<HomePage />)

      expect(screen.queryByText(CANNOT_REACH_PANTRY_COPY)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Fridge, 1 item' })).toBeInTheDocument()
    })
  })

  describe('when searching', () => {
    it('does not offer Show used', () => {
      mockUseSearchMode.mockReturnValue({
        isSearching: true,
        setIsSearching: vi.fn(),
        registerClearFilters: vi.fn(),
        focusField: false,
        openSearch: vi.fn(),
        exitSearch: vi.fn(),
        clearFocusField: vi.fn(),
      })

      render(<HomePage />)

      expect(screen.queryByText(/show used/i)).not.toBeInTheDocument()
      expect(screen.queryByText('Status')).not.toBeInTheDocument()
    })
  })

  describe('zero-quantity confirm', () => {
    it('shows pinned copy when decreasing from 1', () => {
      renderSearchingHome(makeItem({ quantity: 1 }))

      fireEvent.click(screen.getByLabelText('Decrease quantity'))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Remove Milk?')).toBeInTheDocument()
      expect(
        screen.getByText('This will remove Milk from the pantry. This cannot be undone.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByTestId('quantity-badge')).toHaveTextContent('1 gal')
    })

    it('does not delete when Cancel is clicked and keeps quantity at 1', () => {
      renderSearchingHome(makeItem({ quantity: 1 }))

      fireEvent.click(screen.getByLabelText('Decrease quantity'))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(mockRestorePendingWrites).toHaveBeenCalledWith('item-1')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByTestId('quantity-badge')).toHaveTextContent('1 gal')
    })

    it('calls deleteItem then refetches when Remove is clicked', async () => {
      const { refetch } = renderSearchingHome(makeItem({ quantity: 1 }))

      fireEvent.click(screen.getByLabelText('Decrease quantity'))
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      })
      expect(mockCancelPendingWrites).toHaveBeenCalledWith('item-1')
      expect(mockCancelPendingWrites.mock.invocationCallOrder[0]).toBeLessThan(
        mockDeleteItem.mock.invocationCallOrder[0],
      )
      expect(refetch).toHaveBeenCalled()
      expect(mockClearPatchesOnRefetch).toHaveBeenCalledWith()
    })

    it('calls deleteItem once when Remove is double-tapped while delete is in flight', async () => {
      let resolveDelete = () => {}
      let callCount = 0
      mockDeleteItem.mockImplementation(() => {
        callCount += 1
        if (callCount === 1) {
          return new Promise<void>((resolve) => {
            resolveDelete = resolve
          })
        }
        return Promise.reject(new Error('Document not found'))
      })

      renderSearchingHome(makeItem({ quantity: 1 }))
      fireEvent.click(screen.getByLabelText('Decrease quantity'))

      const remove = screen.getByRole('button', { name: 'Remove' })
      fireEvent.click(remove)
      fireEvent.click(remove)

      expect(mockDeleteItem).toHaveBeenCalledTimes(1)
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockCancelPendingWrites).toHaveBeenCalledWith('item-1')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled()
      })
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

      resolveDelete()
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(screen.queryByText('Failed to update. Try again.')).not.toBeInTheDocument()
    })

    it('does not open the dialog when decreasing from 2', () => {
      renderSearchingHome(makeItem({ quantity: 2 }))

      fireEvent.click(screen.getByLabelText('Decrease quantity'))

      expect(screen.queryByText('Remove Milk?')).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(mockDeleteItem).not.toHaveBeenCalled()
    })

    it('opens the same dialog when partial use would reach zero', () => {
      renderSearchingHome(makeItem({ quantity: 1 }))

      fireEvent.click(screen.getByLabelText('Open partial use slider'))
      fireEvent.change(screen.getByLabelText('Amount to remove'), { target: { value: '1' } })
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

      expect(screen.getByText('Remove Milk?')).toBeInTheDocument()
      expect(mockDeleteItem).not.toHaveBeenCalled()
    })
  })

  describe('quantity overlay after write', () => {
    it('refetches on write success without clearing overlays first', () => {
      const item = makeItem({ quantity: 4 })
      const refetch = vi.fn()
      let onSuccess: (() => void) | undefined
      mockUseQuantity.mockImplementation((cb, options) => {
        onSuccess = cb
        return quantityMockReturn(options)
      })
      mockUseItems.mockReturnValue({
        items: [item],
        isLoading: false,
        error: null,
        refetch,
      })

      render(<HomePage />)

      expect(mockClearPatchesOnRefetch).toHaveBeenCalledWith([item])
      mockClearPatchesOnRefetch.mockClear()
      refetch.mockClear()

      onSuccess?.()
      expect(refetch).toHaveBeenCalled()
      expect(mockClearPatchesOnRefetch).not.toHaveBeenCalled()
    })

    it('clears matching overlays when fetched items update', () => {
      const item = makeItem({ quantity: 4 })
      const refetch = vi.fn()
      mockUseItems.mockReturnValue({
        items: [item],
        isLoading: false,
        error: null,
        refetch,
      })

      const { rerender } = render(<HomePage />)
      mockClearPatchesOnRefetch.mockClear()

      const updated = makeItem({ quantity: 5 })
      mockUseItems.mockReturnValue({
        items: [updated],
        isLoading: false,
        error: null,
        refetch,
      })
      rerender(<HomePage />)

      expect(mockClearPatchesOnRefetch).toHaveBeenCalledWith([updated])
    })
  })

  describe('zero-quantity confirm with real useQuantity', () => {
    beforeEach(async () => {
      const { useQuantity: actualUseQuantity } =
        await vi.importActual<typeof import('@/hooks/use-quantity')>('@/hooks/use-quantity')
      mockUseQuantity.mockImplementation(actualUseQuantity)
    })

    it('opens confirm after two rapid decreases from 2, then Remove deletes once without updateItem', async () => {
      renderSearchingHome(makeItem({ quantity: 2 }))

      const decrease = screen.getByLabelText('Decrease quantity')
      fireEvent.click(decrease)
      fireEvent.click(decrease)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Remove Milk?')).toBeInTheDocument()
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(mockDeleteItem).toHaveBeenCalledTimes(1)
      })
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).not.toHaveBeenCalled()

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
      })
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).toHaveBeenCalledTimes(1)
    })
  })
})
