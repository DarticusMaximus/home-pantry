'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface SearchModeContextValue {
  isSearching: boolean
  setIsSearching: (value: boolean) => void
  registerClearFilters: (fn: () => void) => void
  focusField: boolean
  openSearch: (options: { focusField: boolean }) => void
  exitSearch: () => void
  clearFocusField: () => void
  searchQuery?: string
  setSearchQuery?: (query: string) => void
  selectedLocationId?: string | null
  setSelectedLocationId?: (id: string | null) => void
  selectedCategoryId?: string | null
  setSelectedCategoryId?: (id: string | null) => void
  expiringOnly?: boolean
  setExpiringOnly?: (value: boolean) => void
}

const SearchModeContext = createContext<SearchModeContextValue | null>(null)

export function SearchModeProvider({ children }: { children: React.ReactNode }) {
  const [isSearching, setIsSearching] = useState(false)
  const [focusField, setFocusField] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [expiringOnly, setExpiringOnly] = useState(false)
  const clearFiltersRef = useRef<(() => void) | null>(null)

  const registerClearFilters = useCallback((fn: () => void) => {
    clearFiltersRef.current = fn
  }, [])

  const openSearch = useCallback(({ focusField: shouldFocus }: { focusField: boolean }) => {
    setIsSearching(true)
    setFocusField(shouldFocus)
  }, [])

  const exitSearch = useCallback(() => {
    setSearchQuery('')
    setSelectedLocationId(null)
    setSelectedCategoryId(null)
    setExpiringOnly(false)
    clearFiltersRef.current?.()
    setIsSearching(false)
    setFocusField(false)
  }, [])

  const clearFocusField = useCallback(() => {
    setFocusField(false)
  }, [])

  return (
    <SearchModeContext.Provider
      value={{
        isSearching,
        setIsSearching,
        registerClearFilters,
        focusField,
        openSearch,
        exitSearch,
        clearFocusField,
        searchQuery,
        setSearchQuery,
        selectedLocationId,
        setSelectedLocationId,
        selectedCategoryId,
        setSelectedCategoryId,
        expiringOnly,
        setExpiringOnly,
      }}
    >
      {children}
    </SearchModeContext.Provider>
  )
}

export function useSearchMode() {
  const context = useContext(SearchModeContext)
  if (!context) {
    throw new Error('useSearchMode must be used within a SearchModeProvider')
  }
  return context
}
