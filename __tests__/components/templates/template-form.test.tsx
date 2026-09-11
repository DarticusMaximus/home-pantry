import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TemplateForm } from '@/components/templates/template-form'
import type { ItemTemplate } from '@/types/template'

describe('TemplateForm', () => {
  const mockCategories = [{ id: 'cat1', name: 'Dairy', sortOrder: 1, createdAt: '', updatedAt: '' }]
  const mockLocations = [{ id: 'loc1', name: 'Fridge', sortOrder: 1, createdAt: '', updatedAt: '' }]

  it('renders all form fields', () => {
    render(
      <TemplateForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Default Location/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Default Qty/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Unit/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Default Expiration Days/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Tags/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Partial Trackable/i)).not.toBeInTheDocument()
  })

  it('disables submit button when form is invalid', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <TemplateForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const submitButton = screen.getByRole('button', { name: /Add Template/i })
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText(/Name/i), 'Test Item')
    expect(submitButton).not.toBeDisabled()
  })

  it('submits with valid data', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <TemplateForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText(/Name/i), 'Bread')
    await user.selectOptions(screen.getByLabelText(/Category/i), 'cat1')
    await user.clear(screen.getByLabelText(/Default Qty/i))
    await user.type(screen.getByLabelText(/Default Qty/i), '2')

    await user.click(screen.getByRole('button', { name: /Add Template/i }))

    await waitFor(
      () => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Bread',
            categoryId: 'cat1',
            defaultQuantity: 2,
            defaultUnit: 'each',
          }),
        )
      },
      { timeout: 5000 },
    )
    const payload = onSubmit.mock.calls[0][0]
    expect(payload).not.toHaveProperty('tags')
    expect(payload).not.toHaveProperty('isPartialTrackable')
  })

  it('does not submit when default quantity is 0', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <TemplateForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText(/Name/i), 'Ghost')
    await user.clear(screen.getByLabelText(/Default Qty/i))
    await user.type(screen.getByLabelText(/Default Qty/i), '0')
    await user.click(screen.getByRole('button', { name: /Add Template/i }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-populates in edit mode', () => {
    const template: ItemTemplate = {
      id: '1',
      name: 'Milk',
      categoryId: 'cat1',
      defaultUnit: 'L',
      defaultQuantity: 1,
      createdAt: '',
      updatedAt: '',
    }

    render(
      <TemplateForm
        template={template}
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/Name/i)).toHaveValue('Milk')
    expect(screen.getByLabelText(/Category/i)).toHaveValue('cat1')
    expect(screen.queryByLabelText(/Tags/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Partial Trackable/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Update Template/i })).toBeInTheDocument()
  })

  it('calls onCancel when cancel clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <TemplateForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
