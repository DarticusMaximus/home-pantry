import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BatchRowEditor } from '@/components/ai/batch-row-editor'
import { deriveReviewRowStatus } from '@/lib/batch/review-row-status'
import type { BatchReviewRow } from '@/types/batch-review'

function makeRow(overrides: Partial<BatchReviewRow> = {}): BatchReviewRow {
  return {
    id: 'row-1',
    operation: 'add',
    status: 'missing_name',
    source: { source: 'ai_text', raw: 'milk' },
    addData: {
      name: '',
      quantity: 1,
      unit: 'each',
      locationId: 'loc-1',
    },
    ...overrides,
  }
}

function savedRow(onSave: ReturnType<typeof vi.fn>): BatchReviewRow {
  expect(onSave).toHaveBeenCalledOnce()
  return onSave.mock.calls[0][1] as BatchReviewRow
}

describe('BatchRowEditor', () => {
  it('disables Save changes while the name is empty or whitespace', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()

    render(<BatchRowEditor open row={makeRow()} onSave={onSave} onCancel={vi.fn()} />)

    const saveButton = screen.getByRole('button', { name: 'Save changes' })
    expect(saveButton).toBeDisabled()
    await user.click(saveButton)
    expect(onSave).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Name'), '   ')
    expect(saveButton).toBeDisabled()
    await user.click(saveButton)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects whitespace-only names without saving the missing_name row', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()

    render(<BatchRowEditor open row={makeRow()} onSave={onSave} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), '   ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves a trimmed name and leaves readiness to derive', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()

    render(<BatchRowEditor open row={makeRow()} onSave={onSave} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), ' Milk ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const saved = savedRow(onSave)
    expect(saved.addData?.name).toBe('Milk')
    expect(saved.status).not.toBe('ready')
    expect(deriveReviewRowStatus(saved)).toBe('ready')
  })

  it('does not write ready when a named add still has a blank unit', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    const row = makeRow({
      addData: {
        name: '',
        quantity: 1,
        unit: '',
        locationId: 'loc-1',
      },
    })

    render(<BatchRowEditor open row={row} onSave={onSave} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), ' Milk ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const saved = savedRow(onSave)
    expect(saved.addData?.name).toBe('Milk')
    expect(saved.status).not.toBe('ready')
    expect(deriveReviewRowStatus(saved)).toBe('missing_unit')
  })

  it('does not write ready when a named add still needs a lot choice', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    const row = makeRow({
      addMatch: {
        kind: 'lot_choice',
        candidate: {
          itemId: 'lot-1',
          name: 'Milk',
          locationId: 'loc-1',
          quantity: 2,
          unit: 'each',
        },
      },
    })

    render(<BatchRowEditor open row={row} onSave={onSave} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), ' Milk ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const saved = savedRow(onSave)
    expect(saved.addData?.name).toBe('Milk')
    expect(saved.status).not.toBe('ready')
    expect(deriveReviewRowStatus(saved)).toBe('lot_choice')
  })

  it('preserves existing row fields when correcting a missing name', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    const row = makeRow({
      source: { source: 'ai_image', raw: 'oatmeal details' },
      addData: {
        name: '',
        quantity: 2.5,
        unit: 'bag',
        locationId: 'loc-2',
        templateId: 'template-1',
        categoryId: 'category-1',
        expirationDate: '2026-12-31',
        purchaseDate: '2026-07-14',
        notes: 'Store in the pantry',
      },
      parseMetadata: {
        sourceLine: 'two bags oatmeal',
        parseWarnings: ['quantity inferred'],
        isUncertain: true,
        uncertaintyReason: 'Brand omitted',
      },
    })

    render(<BatchRowEditor open row={row} onSave={onSave} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), ' Oatmeal ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const saved = savedRow(onSave)
    expect(saved).toEqual({
      ...row,
      addData: { ...row.addData, name: 'Oatmeal' },
    })
    expect(saved.status).not.toBe('ready')
    expect(deriveReviewRowStatus(saved)).toBe('ready')
  })
})
