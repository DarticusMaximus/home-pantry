import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchModeProvider, useSearchMode } from '@/contexts/search-mode-context'

function TestChild({ clearFn }: { clearFn: () => void }) {
  const {
    isSearching,
    focusField,
    openSearch,
    exitSearch,
    clearFocusField,
    setIsSearching,
    registerClearFilters,
  } = useSearchMode()

  useEffect(() => {
    registerClearFilters(clearFn)
  }, [registerClearFilters, clearFn])

  return (
    <div>
      <span data-testid="is-searching">{String(isSearching)}</span>
      <span data-testid="focus-field">{String(focusField)}</span>
      <button type="button" onClick={() => openSearch({ focusField: true })}>
        Open focused
      </button>
      <button type="button" onClick={() => openSearch({ focusField: false })}>
        Open unfocused
      </button>
      <button type="button" onClick={exitSearch}>
        Exit
      </button>
      <button type="button" onClick={clearFocusField}>
        Clear focus
      </button>
      <button type="button" onClick={() => setIsSearching(true)}>
        Set searching
      </button>
    </div>
  )
}

function renderSearchMode(clearFn: () => void) {
  return render(
    <SearchModeProvider>
      <TestChild clearFn={clearFn} />
    </SearchModeProvider>,
  )
}

function PersistentProvider({ children }: { children: React.ReactNode }) {
  return <SearchModeProvider>{children}</SearchModeProvider>
}

function StoreConsumer() {
  const {
    isSearching,
    focusField,
    openSearch,
    exitSearch,
    searchQuery,
    setSearchQuery,
    selectedLocationId,
    setSelectedLocationId,
  } = useSearchMode()

  return (
    <div>
      <span data-testid="is-searching">{String(isSearching)}</span>
      <span data-testid="focus-field">{String(focusField)}</span>
      <span data-testid="query">{searchQuery}</span>
      <span data-testid="location">{selectedLocationId ?? 'null'}</span>
      <button type="button" onClick={() => openSearch({ focusField: false })}>
        Open unfocused
      </button>
      <button
        type="button"
        onClick={() => {
          setSearchQuery?.('milk')
          setSelectedLocationId?.('fridge')
        }}
      >
        Set filters
      </button>
      <button type="button" onClick={exitSearch}>
        Exit
      </button>
    </div>
  )
}

describe('SearchModeContext', () => {
  afterEach(() => {
    cleanup()
  })

  it('openSearch with focusField true opens search and does not clear filters', () => {
    const clearFn = vi.fn()
    renderSearchMode(clearFn)

    fireEvent.click(screen.getByRole('button', { name: 'Open focused' }))

    expect(screen.getByTestId('is-searching')).toHaveTextContent('true')
    expect(screen.getByTestId('focus-field')).toHaveTextContent('true')
    expect(clearFn).not.toHaveBeenCalled()
  })

  it('openSearch with focusField false opens search without focusing', () => {
    const clearFn = vi.fn()
    renderSearchMode(clearFn)

    fireEvent.click(screen.getByRole('button', { name: 'Open unfocused' }))

    expect(screen.getByTestId('is-searching')).toHaveTextContent('true')
    expect(screen.getByTestId('focus-field')).toHaveTextContent('false')
  })

  it('exitSearch closes search, clears focus, and runs the clear-filters callback', () => {
    const clearFn = vi.fn()
    renderSearchMode(clearFn)

    fireEvent.click(screen.getByRole('button', { name: 'Open focused' }))
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))

    expect(screen.getByTestId('is-searching')).toHaveTextContent('false')
    expect(screen.getByTestId('focus-field')).toHaveTextContent('false')
    expect(clearFn).toHaveBeenCalledTimes(1)
  })

  it('exitSearch twice does not throw and still clears filters', () => {
    const clearFn = vi.fn()
    renderSearchMode(clearFn)

    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
    }).not.toThrow()

    expect(screen.getByTestId('is-searching')).toHaveTextContent('false')
    expect(screen.getByTestId('focus-field')).toHaveTextContent('false')
    expect(clearFn).toHaveBeenCalledTimes(2)
  })

  it('clearFocusField drops the one-shot flag without leaving search', () => {
    const clearFn = vi.fn()
    renderSearchMode(clearFn)

    fireEvent.click(screen.getByRole('button', { name: 'Open focused' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear focus' }))

    expect(screen.getByTestId('focus-field')).toHaveTextContent('false')
    expect(screen.getByTestId('is-searching')).toHaveTextContent('true')
    expect(clearFn).not.toHaveBeenCalled()
  })

  it('setIsSearching true does not set focusField true', () => {
    const clearFn = vi.fn()
    renderSearchMode(clearFn)

    fireEvent.click(screen.getByRole('button', { name: 'Set searching' }))

    expect(screen.getByTestId('is-searching')).toHaveTextContent('true')
    expect(screen.getByTestId('focus-field')).toHaveTextContent('false')
  })

  it('keeps query and location across consumer remount, and exitSearch clears without a callback', () => {
    const { rerender } = render(
      <PersistentProvider>
        <StoreConsumer />
      </PersistentProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open unfocused' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set filters' }))

    expect(screen.getByTestId('query')).toHaveTextContent('milk')
    expect(screen.getByTestId('location')).toHaveTextContent('fridge')
    expect(screen.getByTestId('is-searching')).toHaveTextContent('true')
    expect(screen.getByTestId('focus-field')).toHaveTextContent('false')

    rerender(
      <PersistentProvider>
        <div data-testid="gap" />
      </PersistentProvider>,
    )
    expect(screen.queryByTestId('query')).not.toBeInTheDocument()

    rerender(
      <PersistentProvider>
        <StoreConsumer />
      </PersistentProvider>,
    )

    expect(screen.getByTestId('query')).toHaveTextContent('milk')
    expect(screen.getByTestId('location')).toHaveTextContent('fridge')
    expect(screen.getByTestId('is-searching')).toHaveTextContent('true')
    expect(screen.getByTestId('focus-field')).toHaveTextContent('false')

    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
    expect(screen.getByTestId('query')).toHaveTextContent('')
    expect(screen.getByTestId('location')).toHaveTextContent('null')
    expect(screen.getByTestId('is-searching')).toHaveTextContent('false')

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
    }).not.toThrow()
  })
})
