import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemForm } from '@/components/items/item-form'
import { useTemplateSearch } from '@/hooks/use-templates'
import { itemDefaultsFromTemplate } from '@/lib/inventory/restock-from-template'
import type { Item } from '@/types/item'
import type { ItemTemplate } from '@/types/template'

vi.mock('@/hooks/use-templates', () => ({
  useTemplateSearch: vi.fn(() => ({ results: [], isLoading: false, error: null })),
}))

const mockUseTemplateSearch = vi.mocked(useTemplateSearch)

const mockCategories = [
  { id: 'cat1', name: 'Dairy', sortOrder: 1, createdAt: '', updatedAt: '' },
  { id: 'cat2', name: 'Bakery', sortOrder: 2, createdAt: '', updatedAt: '' },
]

const mockLocations = [
  { id: 'loc1', name: 'Fridge', sortOrder: 1, createdAt: '', updatedAt: '' },
  { id: 'loc2', name: 'Pantry', sortOrder: 2, createdAt: '', updatedAt: '' },
]

const templateA: ItemTemplate = {
  id: 'tpl-a',
  name: 'Whole Milk',
  defaultQuantity: 2,
  defaultUnit: 'gal',
  defaultStorageLocationId: 'loc1',
  categoryId: 'cat1',
  notes: 'Keep cold',
  defaultExpirationDays: 7,
  createdAt: '',
  updatedAt: '',
}

const templateB: ItemTemplate = {
  id: 'tpl-b',
  name: 'Plain Oats',
  defaultQuantity: 3,
  defaultUnit: 'bag',
  createdAt: '',
  updatedAt: '',
}

describe('ItemForm', () => {
  beforeEach(() => {
    mockUseTemplateSearch.mockReturnValue({ results: [], isLoading: false, error: null })
  })

  it('renders all form fields', () => {
    render(
      <ItemForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Location/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Quantity/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Unit/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Expiration Date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Purchase Date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument()
  })

  it('disables submit button when name is empty', () => {
    render(
      <ItemForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const submitButton = screen.getByRole('button', { name: /Add Item/i })
    expect(submitButton).toBeDisabled()
  })

  it('disables submit button when location is not selected', async () => {
    const user = userEvent.setup()
    render(
      <ItemForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText(/Name/i), 'Test Item')
    const submitButton = screen.getByRole('button', { name: /Add Item/i })
    expect(submitButton).toBeDisabled()
  })

  it('does not show quantity error immediately', async () => {
    const user = userEvent.setup()
    render(
      <ItemForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText(/Name/i), 'Test Item')
    await user.selectOptions(screen.getByLabelText(/Location/i), 'loc1')
    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '-5')

    expect(screen.queryByText('Quantity cannot be negative')).not.toBeInTheDocument()
  })

  it('submits with valid data', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <ItemForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText(/Name/i), 'Milk')
    await user.selectOptions(screen.getByLabelText(/Location/i), 'loc1')
    await user.selectOptions(screen.getByLabelText(/Category/i), 'cat1')
    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '2')
    await user.selectOptions(screen.getByLabelText(/Unit/i), 'bottle')

    await user.click(screen.getByRole('button', { name: /Add Item/i }))

    await waitFor(
      () => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Milk',
            locationId: 'loc1',
            categoryId: 'cat1',
            quantity: 2,
            unit: 'bottle',
          }),
        )
      },
      { timeout: 5000 },
    )
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('is' + 'Active')
  })

  it('rejects quantity 0 on add', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <ItemForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText(/Name/i), 'Milk')
    await user.selectOptions(screen.getByLabelText(/Location/i), 'loc1')
    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '0')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Item/i })).toBeDisabled()
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Remove Milk?')).not.toBeInTheDocument()
  })

  it('pre-populates in edit mode', () => {
    const item: Item = {
      id: '1',
      name: 'Milk',
      locationId: 'loc1',
      categoryId: 'cat1',
      quantity: 2,
      unit: 'L',
      createdById: 'user1',
      createdAt: '',
      updatedAt: '',
    }

    render(
      <ItemForm
        initialData={item}
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/Name/i)).toHaveValue('Milk')
    expect(screen.getByLabelText(/Location/i)).toHaveValue('loc1')
    expect(screen.getByLabelText(/Category/i)).toHaveValue('cat1')
    expect(screen.getByLabelText(/Quantity/i)).toHaveValue(2)
    expect(screen.getByRole('button', { name: /Update Item/i })).toBeInTheDocument()
  })

  it('disables submit button while loading', () => {
    render(
      <ItemForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isLoading={true}
      />,
    )

    const submitButton = screen.getByRole('button', { name: /Saving/i })
    expect(submitButton).toBeDisabled()
  })

  it('opens remove confirm on edit when quantity is 0 and does not submit until Remove', async () => {
    const onSubmit = vi.fn()
    const onRemove = vi.fn()
    const user = userEvent.setup()
    const item: Item = {
      id: '1',
      name: 'Milk',
      locationId: 'loc1',
      categoryId: 'cat1',
      quantity: 2,
      unit: 'L',
      createdById: 'user1',
      createdAt: '',
      updatedAt: '',
    }

    render(
      <ItemForm
        initialData={item}
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={onSubmit}
        onRemove={onRemove}
        onCancel={vi.fn()}
      />,
    )

    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '0')
    await user.click(screen.getByRole('button', { name: /Update Item/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Remove Milk?')
    expect(dialog).toHaveTextContent(
      'This will remove Milk from the pantry. This cannot be undone.',
    )
    expect(within(dialog).getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('restores initial quantity when edit zero confirm is cancelled', async () => {
    const onSubmit = vi.fn()
    const onRemove = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    const item: Item = {
      id: '1',
      name: 'Milk',
      locationId: 'loc1',
      categoryId: 'cat1',
      quantity: 2,
      unit: 'L',
      createdById: 'user1',
      createdAt: '',
      updatedAt: '',
    }

    render(
      <ItemForm
        initialData={item}
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={onSubmit}
        onRemove={onRemove}
        onCancel={onCancel}
      />,
    )

    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '0')
    await user.click(screen.getByRole('button', { name: /Update Item/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Quantity/i)).toHaveValue(2)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onRemove).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onRemove when edit zero confirm is accepted', async () => {
    const onSubmit = vi.fn()
    const onRemove = vi.fn()
    const user = userEvent.setup()
    const item: Item = {
      id: '1',
      name: 'Milk',
      locationId: 'loc1',
      categoryId: 'cat1',
      quantity: 2,
      unit: 'L',
      createdById: 'user1',
      createdAt: '',
      updatedAt: '',
    }

    render(
      <ItemForm
        initialData={item}
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={onSubmit}
        onRemove={onRemove}
        onCancel={vi.fn()}
      />,
    )

    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '0')
    await user.click(screen.getByRole('button', { name: /Update Item/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('opens remove confirm on edit when quantity is negative', async () => {
    const onSubmit = vi.fn()
    const onRemove = vi.fn()
    const user = userEvent.setup()
    const item: Item = {
      id: '1',
      name: 'Milk',
      locationId: 'loc1',
      categoryId: 'cat1',
      quantity: 2,
      unit: 'L',
      createdById: 'user1',
      createdAt: '',
      updatedAt: '',
    }

    render(
      <ItemForm
        initialData={item}
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={onSubmit}
        onRemove={onRemove}
        onCancel={vi.fn()}
      />,
    )

    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '-1')
    await user.click(screen.getByRole('button', { name: /Update Item/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Remove Milk?')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('calls onCancel when cancel clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ItemForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('applies template defaults as replace and submits the edited quantity', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    mockUseTemplateSearch.mockReturnValue({
      results: [templateA, templateB],
      isLoading: false,
      error: null,
    })

    render(
      <ItemForm
        categories={mockCategories}
        locations={mockLocations}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText(/Name/i), 'wh')

    await user.click(await screen.findByRole('button', { name: /Whole Milk/ }))

    const expectedA = itemDefaultsFromTemplate(templateA)
    await waitFor(() => {
      expect(screen.getByLabelText(/Name/i)).toHaveValue(expectedA.name)
    })
    expect(screen.getByLabelText(/Quantity/i)).toHaveValue(expectedA.quantity)
    expect(screen.getByLabelText(/Unit/i)).toHaveValue(expectedA.unit)
    expect(screen.getByLabelText(/Location/i)).toHaveValue(expectedA.locationId)
    expect(screen.getByLabelText(/Category/i)).toHaveValue(expectedA.categoryId)
    expect(screen.getByLabelText(/Notes/i)).toHaveValue(expectedA.notes)
    expect(screen.getByLabelText(/Purchase Date/i)).toHaveValue(expectedA.purchaseDate)
    expect(screen.getByLabelText(/Expiration Date/i)).toHaveValue(expectedA.expirationDate)

    await user.click(screen.getByLabelText(/Name/i))
    await user.click(await screen.findByRole('button', { name: /Plain Oats/ }))

    await waitFor(() => {
      expect(screen.getByLabelText(/Name/i)).toHaveValue('Plain Oats')
    })
    expect(screen.getByLabelText(/Quantity/i)).toHaveValue(3)
    expect(screen.getByLabelText(/Unit/i)).toHaveValue('bag')
    expect(screen.getByLabelText(/Location/i)).toHaveValue('')
    expect(screen.getByLabelText(/Category/i)).toHaveValue('')
    expect(screen.getByLabelText(/Notes/i)).toHaveValue('')
    expect(screen.getByLabelText(/Expiration Date/i)).toHaveValue('')
    expect(screen.getByRole('button', { name: /Add Item/i })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText(/Location/i), 'loc1')
    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '9')

    await user.click(screen.getByRole('button', { name: /Add Item/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Plain Oats',
          quantity: 9,
          unit: 'bag',
          locationId: 'loc1',
          templateId: 'tpl-b',
        }),
      )
    })
    expect(onSubmit.mock.calls[0][0].categoryId).toBeUndefined()
    expect(onSubmit.mock.calls[0][0].notes).toBeUndefined()
    expect(onSubmit.mock.calls[0][0].expirationDate).toBeUndefined()
  })
})
