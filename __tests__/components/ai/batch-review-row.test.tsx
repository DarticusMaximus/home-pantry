import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BatchReviewRow } from '@/components/ai/batch-review-row'
import type { BatchReviewRow as BatchReviewRowType } from '@/types/batch-review'

const locations = [
  { id: 'loc-1', name: 'Fridge' },
  { id: 'loc-2', name: 'Pantry' },
]

const noopHandlers = {
  onQuantityChange: vi.fn(),
  onLocationChange: vi.fn(),
  onEditDetails: vi.fn(),
  onChangeMatch: vi.fn(),
  onRemoveRow: vi.fn(),
}

function makeAddRow(overrides: Partial<BatchReviewRowType> = {}): BatchReviewRowType {
  return {
    id: 'row-1',
    operation: 'add',
    status: 'ready',
    source: { source: 'ai_text', raw: '2 gallons milk' },
    addData: {
      name: 'Milk',
      quantity: 2,
      unit: 'gallon',
      locationId: 'loc-1',
      expirationDate: '2026-05-01',
    },
    ...overrides,
  }
}

function makeRemoveRow(overrides: Partial<BatchReviewRowType> = {}): BatchReviewRowType {
  return {
    id: 'row-r1',
    operation: 'remove',
    status: 'ready',
    source: { source: 'ai_text', raw: 'milk' },
    removeData: {
      type: 'resolved',
      matchedItemId: 'item-1',
      matchedItemName: 'Milk',
      currentQuantity: 3,
      removeQuantity: 3,
      candidates: [],
    },
    ...overrides,
  }
}

describe('BatchReviewRow', () => {
  it('shows name, qty, unit, location control, and expiry text when expirationDate is set', () => {
    render(<BatchReviewRow row={makeAddRow()} locations={locations} {...noopHandlers} />)

    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('gallon')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Select location' })).toHaveTextContent('Fridge')
    expect(screen.getByText(/2026-05-01/)).toBeInTheDocument()
  })

  it('shows Uncertain copy on ready guessed rows and does not use known-ready styling', () => {
    const { container } = render(
      <BatchReviewRow
        row={makeAddRow({
          parseMetadata: {
            parseWarnings: ['Uncertain: quantity guessed'],
            isUncertain: true,
            uncertaintyReason: 'quantity guessed',
          },
        })}
        locations={locations}
        {...noopHandlers}
      />,
    )

    expect(screen.getAllByText(/Uncertain:/)).toHaveLength(1)
    expect(container.firstChild).toHaveClass('border-amber-200')
    expect(container.firstChild).not.toHaveClass('border-gray-100')
  })

  describe('Looks right', () => {
    const guessedRow = makeAddRow({
      parseMetadata: {
        parseWarnings: ['Uncertain: quantity guessed'],
        isUncertain: true,
        uncertaintyReason: 'quantity guessed',
      },
    })

    it('shows a 44px Looks right control on unlocked guessed rows', () => {
      render(<BatchReviewRow row={guessedRow} locations={locations} {...noopHandlers} />)

      const looksRight = screen.getByRole('button', { name: 'Looks right' })
      expect(looksRight).toHaveClass('min-h-[44px]')
      expect(looksRight).toHaveClass('min-w-[44px]')
    })

    it('calls onConfirmGuess when Looks right is clicked', async () => {
      const user = userEvent.setup()
      const onConfirmGuess = vi.fn()

      render(
        <BatchReviewRow
          row={guessedRow}
          locations={locations}
          {...noopHandlers}
          onConfirmGuess={onConfirmGuess}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Looks right' }))

      expect(onConfirmGuess).toHaveBeenCalledWith('row-1')
    })

    it('does not show Looks right on known-ready rows', () => {
      render(<BatchReviewRow row={makeAddRow()} locations={locations} {...noopHandlers} />)

      expect(screen.queryByRole('button', { name: 'Looks right' })).not.toBeInTheDocument()
    })

    it('does not show Looks right on locked rows', () => {
      render(<BatchReviewRow row={guessedRow} locations={locations} {...noopHandlers} isLocked />)

      expect(screen.queryByRole('button', { name: 'Looks right' })).not.toBeInTheDocument()
    })

    it('looks known-ready after the guess is confirmed', () => {
      const { rerender, container } = render(
        <BatchReviewRow row={guessedRow} locations={locations} {...noopHandlers} />,
      )

      expect(screen.getByRole('button', { name: 'Looks right' })).toBeInTheDocument()
      expect(container.firstChild).toHaveClass('border-amber-200')

      rerender(
        <BatchReviewRow
          row={makeAddRow({
            parseMetadata: {
              parseWarnings: ['Uncertain: quantity guessed'],
              isUncertain: false,
            },
          })}
          locations={locations}
          {...noopHandlers}
        />,
      )

      expect(screen.queryByRole('button', { name: 'Looks right' })).not.toBeInTheDocument()
      expect(screen.queryByText(/Uncertain:/)).not.toBeInTheDocument()
      expect(container.firstChild).toHaveClass('border-gray-100')
      expect(container.firstChild).not.toHaveClass('border-amber-200')
    })
  })

  it('does not show Uncertain copy on known ready rows', () => {
    const { container } = render(
      <BatchReviewRow
        row={makeAddRow({
          parseMetadata: {
            parseWarnings: ['Uncertain: quantity guessed'],
            isUncertain: false,
          },
        })}
        locations={locations}
        {...noopHandlers}
      />,
    )

    expect(screen.queryByText(/Uncertain:/)).not.toBeInTheDocument()
    expect(container.firstChild).toHaveClass('border-gray-100')
    expect(container.firstChild).not.toHaveClass('border-amber-200')
  })

  it('shows the pinned join note for a compatible add', () => {
    render(
      <BatchReviewRow
        row={makeAddRow({
          addData: {
            name: 'beans',
            quantity: 2,
            unit: 'cans',
            locationId: 'loc-1',
          },
          addMatch: {
            kind: 'join',
            itemId: 'lot-beans',
            currentQuantity: 2,
            name: 'beans',
            unit: 'cans',
          },
        })}
        locations={locations}
        {...noopHandlers}
      />,
    )

    expect(screen.getByText('Fridge beans, 2 cans → 4 cans')).toBeInTheDocument()
  })

  it('updates the join note when quantity changes without rematching identity', async () => {
    const user = userEvent.setup()
    const onQuantityChange = vi.fn()
    const addMatch = {
      kind: 'join' as const,
      itemId: 'lot-beans',
      currentQuantity: 2,
      name: 'beans',
      unit: 'cans',
    }
    const addData = {
      name: 'beans',
      quantity: 2,
      unit: 'cans',
      locationId: 'loc-1',
    }

    const { rerender } = render(
      <BatchReviewRow
        row={makeAddRow({ addData, addMatch })}
        locations={locations}
        {...noopHandlers}
        onQuantityChange={onQuantityChange}
      />,
    )

    expect(screen.getByText('Fridge beans, 2 cans → 4 cans')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Increment quantity' }))

    expect(onQuantityChange).toHaveBeenCalledWith('row-1', 3)
    expect(addMatch.itemId).toBe('lot-beans')

    rerender(
      <BatchReviewRow
        row={makeAddRow({ addData: { ...addData, quantity: 3 }, addMatch })}
        locations={locations}
        {...noopHandlers}
        onQuantityChange={onQuantityChange}
      />,
    )

    expect(screen.getByText('Fridge beans, 2 cans → 5 cans')).toBeInTheDocument()
    expect(addMatch.itemId).toBe('lot-beans')
  })

  it('shows lot_choice copy and 44px actions without a join note or known-ready styling', () => {
    const { container } = render(
      <BatchReviewRow
        row={makeAddRow({
          status: 'lot_choice',
          addData: {
            name: 'beans',
            quantity: 2,
            unit: 'cans',
            locationId: 'loc-1',
          },
          addMatch: {
            kind: 'lot_choice',
            candidate: {
              itemId: 'lot-beans',
              name: 'beans',
              locationId: 'loc-1',
              quantity: 2,
              unit: 'cans',
              expirationDate: '2026-09-10',
            },
          },
        })}
        locations={locations}
        {...noopHandlers}
      />,
    )

    expect(screen.getByText('Already in Fridge · use by 2026-09-10')).toBeInTheDocument()
    expect(screen.getByText('Choose lot')).toBeInTheDocument()
    expect(screen.queryByText(/→/)).not.toBeInTheDocument()
    expect(container.firstChild).toHaveClass('border-amber-200')
    expect(container.firstChild).not.toHaveClass('border-gray-100')

    const addToLot = screen.getByRole('button', { name: 'Add to that lot' })
    const newLot = screen.getByRole('button', { name: 'New lot' })
    expect(addToLot).toHaveClass('min-h-[44px]')
    expect(newLot).toHaveClass('min-h-[44px]')
  })

  it('shows the join note after Add to that lot and leaves the matched lot date unchanged', async () => {
    const user = userEvent.setup()
    const onAddToLot = vi.fn()
    const candidate = {
      itemId: 'lot-beans',
      name: 'beans',
      locationId: 'loc-1',
      quantity: 2,
      unit: 'cans',
      expirationDate: '2026-09-10',
    }
    const addData = {
      name: 'beans',
      quantity: 2,
      unit: 'cans',
      locationId: 'loc-1',
    }

    const { rerender } = render(
      <BatchReviewRow
        row={makeAddRow({
          status: 'lot_choice',
          addData,
          addMatch: { kind: 'lot_choice', candidate },
        })}
        locations={locations}
        {...noopHandlers}
        onAddToLot={onAddToLot}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Add to that lot' }))

    expect(onAddToLot).toHaveBeenCalledWith('row-1', 'lot-beans')
    expect(onAddToLot.mock.calls[0]).toHaveLength(2)
    expect(candidate.expirationDate).toBe('2026-09-10')
    expect('expirationDate' in addData).toBe(false)

    rerender(
      <BatchReviewRow
        row={makeAddRow({
          status: 'ready',
          addData,
          addMatch: {
            kind: 'join',
            itemId: 'lot-beans',
            currentQuantity: 2,
            name: 'beans',
            unit: 'cans',
          },
        })}
        locations={locations}
        {...noopHandlers}
        onAddToLot={onAddToLot}
      />,
    )

    expect(screen.getByText('Fridge beans, 2 cans → 4 cans')).toBeInTheDocument()
    expect(screen.queryByText(/Already in Fridge/)).not.toBeInTheDocument()
    expect(candidate.expirationDate).toBe('2026-09-10')
    expect('expirationDate' in addData).toBe(false)
  })

  it('does not show a join note after New lot', async () => {
    const user = userEvent.setup()
    const onNewLot = vi.fn()
    const addData = {
      name: 'beans',
      quantity: 2,
      unit: 'cans',
      locationId: 'loc-1',
    }

    const { rerender } = render(
      <BatchReviewRow
        row={makeAddRow({
          status: 'lot_choice',
          addData,
          addMatch: {
            kind: 'lot_choice',
            candidate: {
              itemId: 'lot-beans',
              name: 'beans',
              locationId: 'loc-1',
              quantity: 2,
              unit: 'cans',
              expirationDate: '2026-09-10',
            },
          },
        })}
        locations={locations}
        {...noopHandlers}
        onNewLot={onNewLot}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New lot' }))

    expect(onNewLot).toHaveBeenCalledWith('row-1')

    rerender(
      <BatchReviewRow
        row={makeAddRow({
          status: 'ready',
          addData,
          addMatch: { kind: 'new_lot' },
        })}
        locations={locations}
        {...noopHandlers}
        onNewLot={onNewLot}
      />,
    )

    expect(screen.queryByText(/→/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Already in Fridge/)).not.toBeInTheDocument()
  })

  it('does not show a join note when ready with no match', () => {
    render(<BatchReviewRow row={makeAddRow()} locations={locations} {...noopHandlers} />)

    expect(screen.queryByText(/→/)).not.toBeInTheDocument()
  })

  describe('gone tell', () => {
    it('shows Will be gone on a resolved take-all remove', () => {
      render(<BatchReviewRow row={makeRemoveRow()} locations={locations} {...noopHandlers} />)

      expect(screen.getByText('Will be gone')).toBeInTheDocument()
    })

    it('hides Will be gone on a partial take and keeps in-stock copy', () => {
      render(
        <BatchReviewRow
          row={makeRemoveRow({
            removeData: {
              type: 'resolved',
              matchedItemId: 'item-1',
              matchedItemName: 'Milk',
              currentQuantity: 3,
              removeQuantity: 2,
              candidates: [],
            },
          })}
          locations={locations}
          {...noopHandlers}
        />,
      )

      expect(screen.queryByText('Will be gone')).not.toBeInTheDocument()
      expect(screen.getByText(/3 in stock/)).toBeInTheDocument()
    })

    it('shows Will be gone on an over-remove', () => {
      render(
        <BatchReviewRow
          row={makeRemoveRow({
            removeData: {
              type: 'resolved',
              matchedItemId: 'item-1',
              matchedItemName: 'Milk',
              currentQuantity: 2,
              removeQuantity: 5,
              candidates: [],
            },
          })}
          locations={locations}
          {...noopHandlers}
        />,
      )

      expect(screen.getByText('Will be gone')).toBeInTheDocument()
    })

    it('does not show Will be gone on an unresolved remove', () => {
      render(
        <BatchReviewRow
          row={makeRemoveRow({
            status: 'no_match',
            removeData: {
              type: 'unresolved',
              requestedName: 'Milk',
              removeQuantity: 3,
              candidates: [],
            },
          })}
          locations={locations}
          {...noopHandlers}
        />,
      )

      expect(screen.queryByText('Will be gone')).not.toBeInTheDocument()
    })

    it('does not show Will be gone on an add row', () => {
      render(<BatchReviewRow row={makeAddRow()} locations={locations} {...noopHandlers} />)

      expect(screen.queryByText('Will be gone')).not.toBeInTheDocument()
    })

    it('hides Will be gone after a quantity-only edit that leaves remaining', () => {
      const takeAll = makeRemoveRow({
        removeData: {
          type: 'resolved',
          matchedItemId: 'item-1',
          matchedItemName: 'Milk',
          currentQuantity: 3,
          removeQuantity: 3,
          candidates: [],
        },
      })
      const { rerender } = render(
        <BatchReviewRow row={takeAll} locations={locations} {...noopHandlers} />,
      )

      expect(screen.getByText('Will be gone')).toBeInTheDocument()

      rerender(
        <BatchReviewRow
          row={makeRemoveRow({
            removeData: {
              type: 'resolved',
              matchedItemId: 'item-1',
              matchedItemName: 'Milk',
              currentQuantity: 3,
              removeQuantity: 1,
              candidates: [],
            },
          })}
          locations={locations}
          {...noopHandlers}
        />,
      )

      expect(screen.queryByText('Will be gone')).not.toBeInTheDocument()
    })
  })

  describe('empty-house no_match', () => {
    const unresolvedMilk = makeRemoveRow({
      status: 'no_match',
      removeData: {
        type: 'unresolved',
        requestedName: 'Milk',
        removeQuantity: 3,
        candidates: [],
      },
    })

    it('hides Choose item and No matching item found when the house is empty', () => {
      render(
        <BatchReviewRow row={unresolvedMilk} locations={locations} emptyHouse {...noopHandlers} />,
      )

      expect(screen.queryByText('No matching item found')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Choose item' })).not.toBeInTheDocument()
    })

    it('still offers Choose item on non-empty no_match', () => {
      render(<BatchReviewRow row={unresolvedMilk} locations={locations} {...noopHandlers} />)

      expect(screen.getByText('No matching item found')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Choose item' })).toBeInTheDocument()
    })
  })

  describe('Drop line', () => {
    it('labels the action Drop line with a 44px target', () => {
      render(<BatchReviewRow row={makeAddRow()} locations={locations} {...noopHandlers} />)

      const drop = screen.getByRole('button', { name: 'Drop line' })
      expect(drop).toHaveClass('min-h-[44px]')
      expect(drop).toHaveClass('min-w-[44px]')
      expect(screen.queryByRole('button', { name: 'Remove row' })).not.toBeInTheDocument()
    })

    it('drops the row immediately without a confirm dialog', async () => {
      const user = userEvent.setup()
      const onRemoveRow = vi.fn()

      render(
        <BatchReviewRow
          row={makeAddRow()}
          locations={locations}
          {...noopHandlers}
          onRemoveRow={onRemoveRow}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Drop line' }))

      expect(onRemoveRow).toHaveBeenCalledWith('row-1')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
