'use client'

import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface SearchBarProps {
  query: string
  onQueryChange: (q: string) => void
  onClear: () => void
  onCollapse: () => void
  isExpanded: boolean
  focusOnExpand?: boolean
  onFocusApplied?: () => void
}

export function SearchBar({
  query,
  onQueryChange,
  onClear,
  onCollapse,
  isExpanded,
  focusOnExpand = false,
  onFocusApplied,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localQuery, setLocalQuery] = useState(query)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalQuery(query)
  }, [query])

  useEffect(() => {
    if (isExpanded && focusOnExpand && inputRef.current) {
      inputRef.current.focus()
      onFocusApplied?.()
    }
  }, [isExpanded, focusOnExpand, onFocusApplied])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isExpanded) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
        onClear()
        onCollapse()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, onClear, onCollapse])

  const handleInputChange = useCallback(
    (value: string) => {
      setLocalQuery(value)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        onQueryChange(value)
      }, 300)
    },
    [onQueryChange],
  )

  const handleClear = useCallback(() => {
    setLocalQuery('')
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    onClear()
    onCollapse()
  }, [onClear, onCollapse])

  if (!isExpanded) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search items..."
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-12 text-base focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
          aria-label="Search items"
        />
        {localQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
