import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddLotPicker } from '@/components/ai/add-lot-picker'
import type { BatchReviewRow } from '@/types/batch-review'

const locations = [
  { id: 'loc-1', name: 'Fridge' },
  { id: 'loc-2', name: 'Pantry' },
]

function makeAmbiguousRow(overrides: Partial<BatchReviewRow> = {}): BatchReviewRow {
  return {
    id: 'row-1',
    operation: 'add',
    status: 'ambiguous_match',
    source: { source: 'ai_text', raw: '2 cans beans' },
    addData: {
      name: 'beans',
      quantity: 2,
      unit: 'cans',
      locationId: 'loc-1',
    },
    addMatch: {
      kind: 'ambiguous',
      candidates: [
        {
          itemId: 'lot-a',
          name: 'beans',
          locationId: 'loc-1',
          quantity: 2,
          unit: 'cans',
          expirationDate: '2026-09-10',
        },
        {
          itemId: 'lot-b',
          name: 'beans',
          locationId: 'loc-1',
          quantity: 3,
          unit: 'cans',
        },
      ],
    },
    ...overrides,
  }
}

describe('AddLotPicker', () => {
  it('lists each clone lot with name, place, qty, and date when present, plus New lot', () => {
    render(
      <AddLotPicker
        open
        row={makeAmbiguousRow()}
        locations={locations}
        onSelectLot={vi.fn()}
        onNewLot={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: /beans.*Fridge.*2 cans.*2026-09-10/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /beans.*Fridge.*3 cans/ })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /beans.*Fridge.*3 cans.*2026/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New lot' })).toBeInTheDocument()
  })

  it('names the dialog from the heading and does not present options without a listbox', () => {
    render(
      <AddLotPicker
        open
        row={makeAmbiguousRow()}
        locations={locations}
        onSelectLot={vi.fn()}
        onNewLot={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const heading = screen.getByRole('heading', { name: 'Choose lot' })
    const headingId = heading.getAttribute('id')
    expect(headingId).toBeTruthy()
    const dialog = screen.getByRole('dialog', { name: 'Choose lot' })
    expect(dialog).toHaveAttribute('aria-labelledby', headingId)
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /beans.*Fridge.*2 cans.*2026-09-10/ }),
    ).toBeInTheDocument()
  })

  it('calls onSelectLot with the picked lot id', async () => {
    const user = userEvent.setup()
    const onSelectLot = vi.fn()

    render(
      <AddLotPicker
        open
        row={makeAmbiguousRow()}
        locations={locations}
        onSelectLot={onSelectLot}
        onNewLot={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /2 cans.*2026-09-10/ }))

    expect(onSelectLot).toHaveBeenCalledWith('row-1', 'lot-a')
  })

  it('calls onNewLot when New lot is tapped', async () => {
    const user = userEvent.setup()
    const onNewLot = vi.fn()

    render(
      <AddLotPicker
        open
        row={makeAmbiguousRow()}
        locations={locations}
        onSelectLot={vi.fn()}
        onNewLot={onNewLot}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New lot' }))

    expect(onNewLot).toHaveBeenCalledWith('row-1')
  })

  it('uses 44px touch targets on clone lots and New lot', () => {
    render(
      <AddLotPicker
        open
        row={makeAmbiguousRow()}
        locations={locations}
        onSelectLot={vi.fn()}
        onNewLot={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /2 cans.*2026-09-10/ })).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('button', { name: /3 cans/ })).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('button', { name: 'New lot' })).toHaveClass('min-h-[44px]')
  })
})
