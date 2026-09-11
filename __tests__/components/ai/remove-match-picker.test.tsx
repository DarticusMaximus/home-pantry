import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RemoveMatchPicker } from '@/components/ai/remove-match-picker'
import type { BatchReviewRow } from '@/types/batch-review'

const milkId = 'item-milk'

function makeUnresolvedRow(): BatchReviewRow {
  return {
    id: 'row-1',
    operation: 'remove',
    status: 'ambiguous_match',
    source: { source: 'ai_text', raw: 'Milk' },
    removeData: {
      type: 'unresolved',
      requestedName: 'Milk',
      removeQuantity: 1,
      candidates: [
        {
          item: {
            id: milkId,
            name: 'Milk',
            quantity: 2,
            unit: 'L',
            locationId: 'loc-1',
          },
          score: 0.9,
        },
        {
          item: {
            id: 'item-bread',
            name: 'Bread',
            quantity: 1,
            unit: 'each',
            locationId: 'loc-1',
          },
          score: 0.8,
        },
      ],
    },
  }
}

describe('RemoveMatchPicker', () => {
  it('renders unresolved candidates as named buttons without option or listbox roles', () => {
    render(
      <RemoveMatchPicker open row={makeUnresolvedRow()} onSelect={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: /Milk.*2 L/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bread.*1 each/ })).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('calls onSelect for Milk on click and Enter', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    const { unmount } = render(
      <RemoveMatchPicker open row={makeUnresolvedRow()} onSelect={onSelect} onCancel={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /Milk.*2 L/ }))
    expect(onSelect).toHaveBeenCalledWith('row-1', milkId)

    unmount()
    onSelect.mockClear()

    render(
      <RemoveMatchPicker open row={makeUnresolvedRow()} onSelect={onSelect} onCancel={vi.fn()} />,
    )

    screen.getByRole('button', { name: /Milk.*2 L/ }).focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('row-1', milkId)
  })
})
