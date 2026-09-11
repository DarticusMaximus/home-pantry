import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchModeProvider } from '@/contexts/search-mode-context'
import { useSearchItems } from '@/hooks/use-search'
import type { Item } from '@/types/item'

function wrapper({ children }: { children: ReactNode }) {
  return createElement(SearchModeProvider, null, children)
}

function renderSearchItems(items: Item[]) {
  return renderHook(() => useSearchItems(items), { wrapper })
}

function localYmd(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const mockItems: Item[] = [
  {
    id: '1',
    name: 'Steak',
    locationId: 'loc1',
    categoryId: 'cat1',
    quantity: 2,
    unit: 'each',
    expirationDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    createdById: 'user1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: '2',
    name: 'Milk',
    locationId: 'loc1',
    categoryId: 'cat2',
    quantity: 1,
    unit: 'gallon',
    expirationDate: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
    createdById: 'user1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: '3',
    name: 'Frozen Pizza',
    locationId: 'loc2',
    categoryId: 'cat1',
    quantity: 3,
    unit: 'each',
    notes: 'Thin crust variety',
    expirationDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    createdById: 'user1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: '4',
    name: 'Apples',
    locationId: 'loc2',
    categoryId: 'cat3',
    quantity: 6,
    unit: 'each',
    createdById: 'user1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
]

describe('useSearchItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all items when no filters active', () => {
    const { result } = renderSearchItems(mockItems)
    expect(result.current.filteredItems).toHaveLength(4)
  })

  it('does not expose show used', () => {
    const { result } = renderSearchItems(mockItems)
    expect(result.current).not.toHaveProperty('showUsed')
    expect(result.current).not.toHaveProperty('setShowUsed')
  })

  it('filters by location when selectedLocationId set', () => {
    const { result } = renderSearchItems(mockItems)
    act(() => {
      result.current.setSelectedLocationId('loc1')
    })
    expect(result.current.filteredItems).toHaveLength(2)
    expect(result.current.filteredItems.every((i) => i.locationId === 'loc1')).toBe(true)
  })

  it('returns the full live list when location filter is cleared', () => {
    const { result } = renderSearchItems(mockItems)
    act(() => {
      result.current.setSelectedLocationId('loc1')
    })
    act(() => {
      result.current.setSelectedLocationId(null)
    })
    expect(result.current.filteredItems).toEqual(mockItems)
  })

  it('does not resurrect items that were not in the input array', () => {
    const liveOnly = mockItems.filter((item) => item.locationId === 'loc1')
    const { result } = renderSearchItems(liveOnly)
    act(() => {
      result.current.setSelectedLocationId('loc2')
    })
    expect(result.current.filteredItems).toEqual([])
    act(() => {
      result.current.setSelectedLocationId(null)
    })
    expect(result.current.filteredItems).toEqual(liveOnly)
    expect(result.current.filteredItems.some((item) => item.locationId === 'loc2')).toBe(false)
  })

  it('filters by category when selectedCategoryId set', () => {
    const { result } = renderSearchItems(mockItems)
    act(() => {
      result.current.setSelectedCategoryId('cat1')
    })
    expect(result.current.filteredItems).toHaveLength(2)
    expect(result.current.filteredItems.every((i) => i.categoryId === 'cat1')).toBe(true)
  })

  it('filters by expiring only when expiringOnly true', () => {
    const { result } = renderSearchItems(mockItems)
    act(() => {
      result.current.setExpiringOnly(true)
    })
    expect(result.current.filteredItems.length).toBeGreaterThan(0)
    expect(result.current.filteredItems.every((i) => i.expirationDate !== undefined)).toBe(true)
  })

  it('composes all filters with AND logic', () => {
    const { result } = renderSearchItems(mockItems)
    act(() => {
      result.current.setSelectedLocationId('loc1')
      result.current.setSelectedCategoryId('cat1')
      result.current.setExpiringOnly(true)
    })
    const filtered = result.current.filteredItems
    expect(filtered.every((i) => i.locationId === 'loc1')).toBe(true)
    expect(filtered.every((i) => i.categoryId === 'cat1')).toBe(true)
  })

  it('performs fuzzy search via Fuse.js on item name', () => {
    const { result } = renderSearchItems(mockItems)
    act(() => {
      result.current.setSearchQuery('piza')
    })
    expect(result.current.filteredItems.some((i) => i.name === 'Frozen Pizza')).toBe(true)
  })

  it('preserves Fuse relevance ordering', () => {
    const items = [
      { ...mockItems[0], id: 'whole-milk', name: 'Whole Milk' },
      { ...mockItems[1], id: 'milk', name: 'Milk' },
    ]
    const { result } = renderSearchItems(items)

    act(() => {
      result.current.setSearchQuery('milk')
    })

    expect(result.current.filteredItems.map((item) => item.id)).toEqual(['milk', 'whole-milk'])
  })

  it('clearFilters resets all filters to null/false', () => {
    const { result } = renderSearchItems(mockItems)
    act(() => {
      result.current.setSelectedLocationId('loc1')
      result.current.setSelectedCategoryId('cat1')
      result.current.setExpiringOnly(true)
      result.current.setSearchQuery('steak')
    })
    act(() => {
      result.current.clearFilters()
    })
    expect(result.current.selectedLocationId).toBeNull()
    expect(result.current.selectedCategoryId).toBeNull()
    expect(result.current.expiringOnly).toBe(false)
    expect(result.current.searchQuery).toBe('')
  })

  it('setSearchQuery updates query and triggers Fuse.js filtering', () => {
    const { result } = renderSearchItems(mockItems)
    act(() => {
      result.current.setSearchQuery('ste')
    })
    expect(result.current.searchQuery).toBe('ste')
    expect(result.current.filteredItems.some((i) => i.name === 'Steak')).toBe(true)
  })

  it('isSearching is true when any filter is active', () => {
    const { result } = renderSearchItems(mockItems)
    expect(result.current.isSearching).toBe(false)
    act(() => {
      result.current.setSearchQuery('steak')
    })
    expect(result.current.isSearching).toBe(true)
  })

  it('isSearching is true when expiringOnly is true', () => {
    const { result } = renderSearchItems(mockItems)
    act(() => {
      result.current.setExpiringOnly(true)
    })
    expect(result.current.isSearching).toBe(true)
  })

  describe('expiringOnly live list', () => {
    const liveExpiryItems: Item[] = [
      { ...mockItems[0], id: 'expired', name: 'Expired Yogurt', expirationDate: localYmd(-2) },
      { ...mockItems[1], id: 'soon', name: 'Soon Cheese', expirationDate: localYmd(3) },
      { ...mockItems[2], id: 'far', name: 'Far Pasta', expirationDate: localYmd(8) },
      { ...mockItems[3], id: 'undated', name: 'Undated Rice', expirationDate: undefined },
    ]

    it('keeps expired and soon items and drops missing and day-8 dates', () => {
      const { result } = renderSearchItems(liveExpiryItems)
      act(() => {
        result.current.setExpiringOnly(true)
      })
      expect(result.current.filteredItems.map((item) => item.id)).toEqual(['expired', 'soon'])
    })

    it('returns the full live input when expiringOnly is cleared', () => {
      const { result } = renderSearchItems(liveExpiryItems)
      act(() => {
        result.current.setExpiringOnly(true)
      })
      act(() => {
        result.current.setExpiringOnly(false)
      })
      expect(result.current.filteredItems).toEqual(liveExpiryItems)
    })

    it('does not resurrect items that were not in the input array', () => {
      const liveOnly = liveExpiryItems.filter((item) => item.id !== 'expired')
      const { result } = renderSearchItems(liveOnly)
      act(() => {
        result.current.setExpiringOnly(true)
      })
      expect(result.current.filteredItems.map((item) => item.id)).toEqual(['soon'])
      expect(result.current.filteredItems.some((item) => item.id === 'expired')).toBe(false)
      act(() => {
        result.current.clearFilters()
      })
      expect(result.current.filteredItems).toEqual(liveOnly)
      expect(result.current.filteredItems.some((item) => item.id === 'expired')).toBe(false)
    })

    it('ANDs location with expiringOnly', () => {
      const mixed: Item[] = [
        { ...liveExpiryItems[0], locationId: 'loc1' },
        { ...liveExpiryItems[1], locationId: 'loc2' },
        { ...liveExpiryItems[2], locationId: 'loc1' },
      ]
      const { result } = renderSearchItems(mixed)
      act(() => {
        result.current.setSelectedLocationId('loc1')
        result.current.setExpiringOnly(true)
      })
      expect(result.current.filteredItems.map((item) => item.id)).toEqual(['expired'])
    })
  })
})
