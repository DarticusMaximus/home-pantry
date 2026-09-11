import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterChips } from '@/components/home/filter-chips'
import { SearchBar } from '@/components/home/search-bar'

const fridgeLocation = {
  id: 'fridge',
  name: 'Fridge',
  icon: 'snowflake',
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
}

const pantryLocation = {
  id: 'pantry',
  name: 'Pantry',
  icon: 'package',
  sortOrder: 1,
  createdAt: '',
  updatedAt: '',
}

const dairyCategory = {
  id: 'dairy',
  name: 'Dairy',
  color: '#fff',
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
}

describe('search controls', () => {
  it('gives the search clear button a 44px target without reducing input space', () => {
    render(
      <SearchBar
        query="milk"
        onQueryChange={vi.fn()}
        onClear={vi.fn()}
        onCollapse={vi.fn()}
        isExpanded
      />,
    )

    expect(screen.getByRole('button', { name: 'Clear search' })).toHaveClass('h-11', 'w-11')
    expect(screen.getByRole('textbox', { name: 'Search items' })).toHaveClass('pr-12')
  })

  it('uses 16px type on the search field so iOS does not zoom on focus', () => {
    render(
      <SearchBar
        query=""
        onQueryChange={vi.fn()}
        onClear={vi.fn()}
        onCollapse={vi.fn()}
        isExpanded
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Search items' })
    expect(input).toHaveClass('text-base')
    expect(input).not.toHaveClass('text-sm')
  })

  it('does not focus the field when expanded without focusOnExpand', () => {
    const { rerender } = render(
      <SearchBar
        query="milk"
        onQueryChange={vi.fn()}
        onClear={vi.fn()}
        onCollapse={vi.fn()}
        isExpanded
      />,
    )

    const omitted = screen.getByRole('textbox', { name: 'Search items' })
    expect(omitted).toBeInTheDocument()
    expect(omitted).not.toHaveFocus()
    expect(omitted).not.toHaveAttribute('autoFocus')
    expect(omitted).not.toHaveAttribute('autofocus')

    rerender(
      <SearchBar
        query="milk"
        onQueryChange={vi.fn()}
        onClear={vi.fn()}
        onCollapse={vi.fn()}
        isExpanded
        focusOnExpand={false}
      />,
    )

    const explicitFalse = screen.getByRole('textbox', { name: 'Search items' })
    expect(explicitFalse).toBeInTheDocument()
    expect(explicitFalse).not.toHaveFocus()
    expect(explicitFalse).not.toHaveAttribute('autoFocus')
    expect(explicitFalse).not.toHaveAttribute('autofocus')
  })

  it('focuses the field once when expanded with focusOnExpand and notifies', () => {
    const onFocusApplied = vi.fn()

    render(
      <SearchBar
        query="milk"
        onQueryChange={vi.fn()}
        onClear={vi.fn()}
        onCollapse={vi.fn()}
        isExpanded
        focusOnExpand
        onFocusApplied={onFocusApplied}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Search items' })).toHaveFocus()
    expect(onFocusApplied).toHaveBeenCalledTimes(1)
  })

  describe('debounce on collapse', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not emit a typed query after Escape within the debounce window', () => {
      const onQueryChange = vi.fn()
      const onClear = vi.fn()
      const onCollapse = vi.fn()

      render(
        <SearchBar
          query=""
          onQueryChange={onQueryChange}
          onClear={onClear}
          onCollapse={onCollapse}
          isExpanded
        />,
      )

      fireEvent.change(screen.getByRole('textbox', { name: 'Search items' }), {
        target: { value: 'milk' },
      })
      expect(onQueryChange).not.toHaveBeenCalled()

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClear).toHaveBeenCalledTimes(1)
      expect(onCollapse).toHaveBeenCalledTimes(1)

      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(onQueryChange).not.toHaveBeenCalled()
    })

    it('does not emit a typed query after unmount within the debounce window', () => {
      const onQueryChange = vi.fn()

      const { unmount } = render(
        <SearchBar
          query=""
          onQueryChange={onQueryChange}
          onClear={vi.fn()}
          onCollapse={vi.fn()}
          isExpanded
        />,
      )

      fireEvent.change(screen.getByRole('textbox', { name: 'Search items' }), {
        target: { value: 'milk' },
      })

      unmount()

      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(onQueryChange).not.toHaveBeenCalled()
    })

    it('clears and collapses without emitting a stale query when the X button is tapped', () => {
      const onQueryChange = vi.fn()
      const onClear = vi.fn()
      const onCollapse = vi.fn()

      render(
        <SearchBar
          query=""
          onQueryChange={onQueryChange}
          onClear={onClear}
          onCollapse={onCollapse}
          isExpanded
        />,
      )

      fireEvent.change(screen.getByRole('textbox', { name: 'Search items' }), {
        target: { value: 'milk' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
      expect(onClear).toHaveBeenCalledTimes(1)
      expect(onCollapse).toHaveBeenCalledTimes(1)

      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(onQueryChange).not.toHaveBeenCalled()
    })
  })

  it('gives every filter chip a 44px minimum height', () => {
    render(
      <FilterChips
        locations={[
          {
            id: 'fridge',
            name: 'Fridge',
            icon: 'snowflake',
            sortOrder: 0,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        categories={[
          {
            id: 'dairy',
            name: 'Dairy',
            color: '#fff',
            sortOrder: 0,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    for (const chip of screen.getAllByRole('button')) {
      expect(chip).toHaveClass('min-h-[44px]')
    }
  })

  it('does not render a Show used status chip', () => {
    render(
      <FilterChips
        locations={[]}
        categories={[]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    expect(screen.queryByText(/show used/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Status')).not.toBeInTheDocument()
  })

  it('labels the expiring chip with a count when expiringCount is greater than 0', () => {
    render(
      <FilterChips
        locations={[]}
        categories={[]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={3}
      />,
    )

    const chip = screen.getByRole('button', { name: 'Expiring soon (3)' })
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveClass('min-h-[44px]')
  })

  it('labels the expiring chip without a count when expiringCount is 0', () => {
    render(
      <FilterChips
        locations={[]}
        categories={[]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    expect(screen.getByRole('button', { name: 'Expiring soon' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Expiring soon \(/ })).not.toBeInTheDocument()
  })

  it('toggles expiringOnly when the expiring chip is tapped', () => {
    const onExpiringChange = vi.fn()
    const { rerender } = render(
      <FilterChips
        locations={[]}
        categories={[]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={onExpiringChange}
        expiringCount={3}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expiring soon (3)' }))
    expect(onExpiringChange).toHaveBeenCalledWith(true)

    rerender(
      <FilterChips
        locations={[]}
        categories={[]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={true}
        onExpiringChange={onExpiringChange}
        expiringCount={3}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expiring soon (3)' }))
    expect(onExpiringChange).toHaveBeenCalledWith(false)
  })

  it('renders three filter buttons without chip rows or overflow', () => {
    const { container } = render(
      <FilterChips
        locations={[fridgeLocation]}
        categories={[dairyCategory]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    expect(screen.getByRole('button', { name: 'Location' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Category' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expiring soon' })).toBeInTheDocument()
    expect(screen.queryByText('Fridge')).not.toBeInTheDocument()
    expect(screen.queryByText('Dairy')).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain('overflow-x-auto')

    for (const name of ['Location', 'Category', 'Expiring soon']) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-[44px]')
    }
  })

  it('opens a location picker, applies a location, and clears it', () => {
    const onLocationChange = vi.fn()
    const { rerender } = render(
      <FilterChips
        locations={[fridgeLocation]}
        categories={[dairyCategory]}
        selectedLocationId={null}
        onLocationChange={onLocationChange}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Location' }))

    const listbox = screen.getByRole('listbox', { name: 'Locations' })
    expect(within(listbox).getByRole('option', { name: 'Any location' })).toBeInTheDocument()
    const fridgeOption = within(listbox).getByRole('option', { name: 'Fridge' })
    expect(fridgeOption).not.toHaveAttribute('aria-selected', 'true')

    fireEvent.click(fridgeOption)
    expect(onLocationChange).toHaveBeenCalledWith('fridge')
    expect(screen.queryByRole('listbox', { name: 'Locations' })).not.toBeInTheDocument()

    rerender(
      <FilterChips
        locations={[fridgeLocation]}
        categories={[dairyCategory]}
        selectedLocationId="fridge"
        onLocationChange={onLocationChange}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    const fridgeButton = screen.getByRole('button', { name: 'Fridge' })
    expect(fridgeButton).toHaveClass('border-emerald-300', 'bg-emerald-100', 'text-emerald-700')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.click(fridgeButton)
    fireEvent.click(screen.getByRole('option', { name: 'Fridge' }))
    expect(onLocationChange).toHaveBeenCalledWith(null)

    fireEvent.click(screen.getByRole('button', { name: 'Fridge' }))
    fireEvent.click(screen.getByRole('option', { name: 'Any location' }))
    expect(onLocationChange).toHaveBeenLastCalledWith(null)
  })

  it('opens a category picker, shows Dairy selected on first paint, and clears it', () => {
    const onCategoryChange = vi.fn()
    const { rerender } = render(
      <FilterChips
        locations={[fridgeLocation]}
        categories={[dairyCategory]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId="dairy"
        onCategoryChange={onCategoryChange}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    const dairyButton = screen.getByRole('button', { name: 'Dairy' })
    expect(dairyButton).toHaveClass('border-emerald-300', 'bg-emerald-100', 'text-emerald-700')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    rerender(
      <FilterChips
        locations={[fridgeLocation]}
        categories={[dairyCategory]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={onCategoryChange}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Category' }))

    const listbox = screen.getByRole('listbox', { name: 'Categories' })
    expect(within(listbox).getByRole('option', { name: 'Any category' })).toBeInTheDocument()
    const dairyOption = within(listbox).getByRole('option', { name: 'Dairy' })
    expect(dairyOption).not.toHaveAttribute('aria-selected', 'true')
    expect(dairyOption.querySelector('span')).toHaveStyle({ backgroundColor: '#fff' })

    fireEvent.click(dairyOption)
    expect(onCategoryChange).toHaveBeenCalledWith('dairy')
    expect(screen.queryByRole('listbox', { name: 'Categories' })).not.toBeInTheDocument()

    rerender(
      <FilterChips
        locations={[fridgeLocation]}
        categories={[dairyCategory]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId="dairy"
        onCategoryChange={onCategoryChange}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dairy' }))
    fireEvent.click(screen.getByRole('option', { name: 'Dairy' }))
    expect(onCategoryChange).toHaveBeenCalledWith(null)

    fireEvent.click(screen.getByRole('button', { name: 'Dairy' }))
    fireEvent.click(screen.getByRole('option', { name: 'Any category' }))
    expect(onCategoryChange).toHaveBeenLastCalledWith(null)
  })

  it('keeps one picker open, closes it on Expiring, and closes on outside pointerdown', () => {
    const onLocationChange = vi.fn()
    const onExpiringChange = vi.fn()

    render(
      <FilterChips
        locations={[fridgeLocation]}
        categories={[dairyCategory]}
        selectedLocationId={null}
        onLocationChange={onLocationChange}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={onExpiringChange}
        expiringCount={0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Location' }))
    expect(screen.getByRole('listbox', { name: 'Locations' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Category' }))
    expect(screen.queryByRole('listbox', { name: 'Locations' })).not.toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: 'Categories' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Location' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expiring soon' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onExpiringChange).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByRole('button', { name: 'Location' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onLocationChange).not.toHaveBeenCalled()
  })

  it('gives location picker options a 44px minimum height', () => {
    render(
      <FilterChips
        locations={[fridgeLocation]}
        categories={[dairyCategory]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Location' }))
    expect(screen.getByRole('option', { name: 'Any location' })).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('option', { name: 'Fridge' })).toHaveClass('min-h-[44px]')
  })

  it('shows only Any location when the location list is empty', () => {
    render(
      <FilterChips
        locations={[]}
        categories={[]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Location' }))

    const listbox = screen.getByRole('listbox', { name: 'Locations' })
    const options = within(listbox).getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveAccessibleName('Any location')
    expect(options[0]).toHaveClass('min-h-[44px]')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Location' })).toHaveAttribute(
      'aria-controls',
      listbox.id,
    )
  })

  it('shows only Any category when the category list is empty', () => {
    render(
      <FilterChips
        locations={[]}
        categories={[]}
        selectedLocationId={null}
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Category' }))

    const listbox = screen.getByRole('listbox', { name: 'Categories' })
    const options = within(listbox).getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveAccessibleName('Any category')
    expect(options[0]).toHaveClass('min-h-[44px]')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Category' })).toHaveAttribute(
      'aria-controls',
      listbox.id,
    )
  })

  it('selects Fridge from the location listbox with ArrowDown and Enter', () => {
    const onLocationChange = vi.fn()
    render(
      <FilterChips
        locations={[fridgeLocation]}
        categories={[dairyCategory]}
        selectedLocationId={null}
        onLocationChange={onLocationChange}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Location' }))
    const listbox = screen.getByRole('listbox', { name: 'Locations' })
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: 'Enter' })

    expect(onLocationChange).toHaveBeenCalledWith('fridge')
    expect(screen.queryByRole('listbox', { name: 'Locations' })).not.toBeInTheDocument()
  })

  it('highlights the keyboard-active location and selects it with Enter', () => {
    const onLocationChange = vi.fn()
    render(
      <FilterChips
        locations={[fridgeLocation, pantryLocation]}
        categories={[dairyCategory]}
        selectedLocationId={null}
        onLocationChange={onLocationChange}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Location' })
    fireEvent.click(trigger)
    const listbox = screen.getByRole('listbox', { name: 'Locations' })
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })

    const pantryOption = screen.getByRole('option', { name: 'Pantry' })
    expect(pantryOption).toHaveClass('bg-emerald-50')
    expect(trigger).toHaveAttribute('aria-activedescendant', pantryOption.id)

    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onLocationChange).toHaveBeenCalledWith('pantry')
  })

  it('closes the open location picker on Escape without changing location', () => {
    const onLocationChange = vi.fn()
    render(
      <FilterChips
        locations={[fridgeLocation, pantryLocation]}
        categories={[dairyCategory]}
        selectedLocationId={null}
        onLocationChange={onLocationChange}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Location' }))
    const listbox = screen.getByRole('listbox', { name: 'Locations' })
    fireEvent.keyDown(listbox, { key: 'Escape' })

    expect(screen.queryByRole('listbox', { name: 'Locations' })).not.toBeInTheDocument()
    expect(onLocationChange).not.toHaveBeenCalled()
  })

  it('ellipsizes a long selected location name without horizontal scroll', () => {
    const longName = 'Very Long Location Name That Exceeds Forty'
    const { container } = render(
      <FilterChips
        locations={[{ ...fridgeLocation, name: longName }]}
        categories={[dairyCategory]}
        selectedLocationId="fridge"
        onLocationChange={vi.fn()}
        selectedCategoryId={null}
        onCategoryChange={vi.fn()}
        expiringOnly={false}
        onExpiringChange={vi.fn()}
        expiringCount={0}
      />,
    )

    const trigger = screen.getByRole('button', { name: longName })
    expect(trigger.className).toMatch(/max-w-\[45%\]|flex-1/)
    expect(trigger).toHaveClass('min-w-0')
    expect(trigger.querySelector('span')).toHaveClass('truncate')
    expect(container.innerHTML).not.toContain('overflow-x-auto')
    expect(container.querySelector('.flex-wrap')).toBeTruthy()
  })
})
