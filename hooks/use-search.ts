'use client'

import Fuse from 'fuse.js'
import { useCallback, useMemo } from 'react'
import { useSearchMode } from '@/contexts/search-mode-context'
import { isExpiringSoon } from '@/lib/utils/expiration'
import type { Item } from '@/types/item'

interface UseSearchItemsReturn {
  filteredItems: Item[]
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedLocationId: string | null
  setSelectedLocationId: (id: string | null) => void
  selectedCategoryId: string | null
  setSelectedCategoryId: (id: string | null) => void
  expiringOnly: boolean
  setExpiringOnly: (value: boolean) => void
  clearFilters: () => void
  isSearching: boolean
}

const FUSE_CONFIG = {
  keys: [
    { name: 'name', weight: 0.7 },
    { name: 'notes', weight: 0.2 },
    { name: 'unit', weight: 0.1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
}

export function useSearchItems(items: Item[]): UseSearchItemsReturn {
  const {
    searchQuery = '',
    setSearchQuery,
    selectedLocationId = null,
    setSelectedLocationId,
    selectedCategoryId = null,
    setSelectedCategoryId,
    expiringOnly = false,
    setExpiringOnly,
  } = useSearchMode()

  const fuse = useMemo(() => new Fuse(items, FUSE_CONFIG), [items])

  const filteredItems = useMemo(() => {
    let result: Item[]

    if (searchQuery.length >= 2) {
      result = fuse.search(searchQuery).map((result) => result.item)
    } else {
      result = [...items]
    }

    if (selectedLocationId) {
      result = result.filter((i) => i.locationId === selectedLocationId)
    }

    if (selectedCategoryId) {
      result = result.filter((i) => i.categoryId === selectedCategoryId)
    }

    if (expiringOnly) {
      result = result.filter((i) => isExpiringSoon(i.expirationDate))
    }

    return result
  }, [items, searchQuery, fuse, selectedLocationId, selectedCategoryId, expiringOnly])

  const clearFilters = useCallback(() => {
    setSearchQuery?.('')
    setSelectedLocationId?.(null)
    setSelectedCategoryId?.(null)
    setExpiringOnly?.(false)
  }, [setSearchQuery, setSelectedLocationId, setSelectedCategoryId, setExpiringOnly])

  const isSearching =
    searchQuery.length > 0 ||
    selectedLocationId !== null ||
    selectedCategoryId !== null ||
    expiringOnly

  return {
    filteredItems,
    searchQuery,
    setSearchQuery: setSearchQuery ?? (() => {}),
    selectedLocationId,
    setSelectedLocationId: setSelectedLocationId ?? (() => {}),
    selectedCategoryId,
    setSelectedCategoryId: setSelectedCategoryId ?? (() => {}),
    expiringOnly,
    setExpiringOnly: setExpiringOnly ?? (() => {}),
    clearFilters,
    isSearching,
  }
}
