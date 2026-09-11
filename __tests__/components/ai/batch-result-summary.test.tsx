import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BatchResultSummary } from '@/components/ai/batch-result-summary'
import type { BatchReviewRow, BatchSubmitSummary } from '@/types/batch-review'

const makeAddRow = (overrides: Partial<BatchReviewRow> = {}): BatchReviewRow => ({
  id: 'row-1',
  operation: 'add',
  status: 'ready',
  source: { source: 'ai_text', raw: 'milk' },
  addData: {
    name: 'Milk',
    quantity: 1,
    unit: 'each',
    locationId: 'loc-1',
  },
  ...overrides,
})

const addSuccess: BatchSubmitSummary = {
  total: 1,
  succeeded: 1,
  failed: 0,
  failures: [],
}

const removeSuccess: BatchSubmitSummary = {
  total: 1,
  succeeded: 1,
  failed: 0,
  failures: [],
}

const partialSummary: BatchSubmitSummary = {
  total: 2,
  succeeded: 1,
  failed: 1,
  failures: [{ rowId: 'row-2', error: 'Failed to create item' }],
}

const partialRows: BatchReviewRow[] = [
  makeAddRow({ id: 'row-1' }),
  makeAddRow({
    id: 'row-2',
    addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
  }),
]

describe('BatchResultSummary', () => {
  it('shows add success copy without added successfully', () => {
    render(
      <BatchResultSummary
        summary={addSuccess}
        operation="add"
        rows={[makeAddRow()]}
        onDone={vi.fn()}
      />,
    )

    expect(screen.getByText('1 item added')).toBeInTheDocument()
    expect(screen.queryByText(/added successfully/i)).not.toBeInTheDocument()
  })

  it('pluralizes add success copy', () => {
    render(
      <BatchResultSummary
        summary={{ ...addSuccess, total: 2, succeeded: 2 }}
        operation="add"
        rows={[makeAddRow(), makeAddRow({ id: 'row-2' })]}
        onDone={vi.fn()}
      />,
    )

    expect(screen.getByText('2 items added')).toBeInTheDocument()
  })

  it('shows remove success copy instead of added', () => {
    render(
      <BatchResultSummary
        summary={removeSuccess}
        operation="remove"
        rows={[makeAddRow()]}
        onDone={vi.fn()}
      />,
    )

    expect(screen.getByText('1 item removed')).toBeInTheDocument()
    expect(screen.queryByText(/added/i)).not.toBeInTheDocument()
  })

  it('pluralizes remove success copy', () => {
    render(
      <BatchResultSummary
        summary={{ ...removeSuccess, total: 2, succeeded: 2 }}
        operation="remove"
        rows={[makeAddRow(), makeAddRow({ id: 'row-2' })]}
        onDone={vi.fn()}
      />,
    )

    expect(screen.getByText('2 items removed')).toBeInTheDocument()
  })

  it('lists partial failures as name plus pinned error', () => {
    render(
      <BatchResultSummary
        summary={partialSummary}
        operation="add"
        rows={partialRows}
        onRetry={vi.fn()}
        onDone={vi.fn()}
      />,
    )

    expect(screen.getByText('1 of 2 items processed successfully')).toBeInTheDocument()
    expect(screen.getByText('1 item could not be processed')).toBeInTheDocument()
    expect(screen.getByText('Bread: Failed to create item')).toBeInTheDocument()
  })

  it('calls onDone from Done and Continue, and onRetry from Retry', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()

    const { rerender } = render(
      <BatchResultSummary
        summary={addSuccess}
        operation="add"
        rows={[makeAddRow()]}
        onDone={onDone}
      />,
    )

    const done = screen.getByRole('button', { name: 'Done' })
    expect(done).toHaveClass('min-h-[44px]')
    await user.click(done)
    expect(onDone).toHaveBeenCalledOnce()

    const onRetry = vi.fn()
    const onContinue = vi.fn()
    rerender(
      <BatchResultSummary
        summary={partialSummary}
        operation="add"
        rows={partialRows}
        onRetry={onRetry}
        onDone={onContinue}
      />,
    )

    const retry = screen.getByRole('button', { name: /retry failed items/i })
    const cont = screen.getByRole('button', { name: /continue/i })
    expect(retry).toHaveClass('min-h-[44px]')
    expect(cont).toHaveClass('min-h-[44px]')

    await user.click(retry)
    await user.click(cont)
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('disables Retry while a submit is in flight', () => {
    const onRetry = vi.fn()

    render(
      <BatchResultSummary
        summary={partialSummary}
        operation="add"
        rows={partialRows}
        onRetry={onRetry}
        onDone={vi.fn()}
        isSubmitting
      />,
    )

    expect(screen.getByRole('button', { name: /retry failed items/i })).toBeDisabled()
  })
})
