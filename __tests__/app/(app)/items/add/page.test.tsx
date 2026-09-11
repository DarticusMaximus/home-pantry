import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddItemPage from '@/app/(app)/items/add/page'
import { useAuth } from '@/contexts/auth-context'
import { useCategories } from '@/hooks/use-categories'
import { useLocations } from '@/hooks/use-locations'
import { useTemplate, useTemplateSearch } from '@/hooks/use-templates'
import { createItem, updateItem } from '@/lib/appwrite/items'
import { itemDefaultsFromTemplate } from '@/lib/inventory/restock-from-template'
import type { ItemTemplate } from '@/types/template'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  useSearchParams: vi.fn(),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-categories', () => ({
  useCategories: vi.fn(),
}))

vi.mock('@/hooks/use-locations', () => ({
  useLocations: vi.fn(),
}))

vi.mock('@/hooks/use-templates', () => ({
  useTemplateSearch: vi.fn(() => ({ results: [], isLoading: false, error: null })),
  useTemplate: vi.fn(() => ({
    template: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

vi.mock('@/lib/appwrite/items', () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
}))

import { useSearchParams } from 'next/navigation'

const mockUseAuth = vi.mocked(useAuth)
const mockUseCategories = vi.mocked(useCategories)
const mockUseLocations = vi.mocked(useLocations)
const mockUseSearchParams = vi.mocked(useSearchParams)
const mockUseTemplate = vi.mocked(useTemplate)
const mockUseTemplateSearch = vi.mocked(useTemplateSearch)
const mockCreateItem = vi.mocked(createItem)
const mockUpdateItem = vi.mocked(updateItem)

const milkTemplate: ItemTemplate = {
  id: 'tpl-1',
  name: 'Milk',
  defaultQuantity: 1,
  defaultUnit: 'gal',
  defaultStorageLocationId: 'loc-fridge',
  categoryId: 'cat-dairy',
  notes: 'Buy organic',
  defaultExpirationDays: 7,
  createdAt: '',
  updatedAt: '',
}

describe('AddItemPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  beforeEach(() => {
    mockPush.mockReset()
    mockUseAuth.mockReturnValue({
      user: { $id: 'user-1' },
      unreachable: false,
      retrySession: vi.fn(),
    } as never)
    mockUseCategories.mockReturnValue({
      categories: [{ id: 'cat-dairy', name: 'Dairy', sortOrder: 1, createdAt: '', updatedAt: '' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as never)
    mockUseLocations.mockReturnValue({
      locations: [{ id: 'loc-fridge', name: 'Fridge', sortOrder: 1, createdAt: '', updatedAt: '' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as never)
    mockUseTemplateSearch.mockReturnValue({ results: [], isLoading: false, error: null })
    mockUseTemplate.mockReturnValue({
      template: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockCreateItem.mockResolvedValue({ id: 'item-new' } as never)
    mockUpdateItem.mockReset()
  })

  it('renders Back to home', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as never)
    render(<AddItemPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')
  })

  it('prefills the name from an encoded query parameter', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('name=2%25%20Milk') as never)
    render(<AddItemPage />)

    expect(screen.getByLabelText(/Name/i)).toHaveValue('2% Milk')
  })

  it('does not create an item when name or location is missing', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as never)
    const user = userEvent.setup()
    render(<AddItemPage />)

    expect(screen.getByRole('button', { name: /Add Item/i })).toBeDisabled()
    expect(mockCreateItem).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Name/i), 'Milk')
    expect(screen.getByRole('button', { name: /Add Item/i })).toBeDisabled()
    expect(mockCreateItem).not.toHaveBeenCalled()
  })

  it('shows a usable add form when templateId is absent', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as never)
    render(<AddItemPage />)

    expect(screen.getByLabelText(/Name/i)).toHaveValue('')
    expect(screen.getByRole('button', { name: /Add Item/i })).toBeInTheDocument()
    expect(screen.queryByText(/Template not found/i)).not.toBeInTheDocument()
  })

  it('shows household save copy when createItem rejects an Appwrite-like error', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as never)
    mockCreateItem.mockRejectedValueOnce(
      new Error('Document with the requested ID could not be found.'),
    )
    const user = userEvent.setup()
    render(<AddItemPage />)

    await user.type(screen.getByLabelText(/Name/i), 'Milk')
    await user.selectOptions(screen.getByLabelText(/Location/i), 'loc-fridge')
    await user.click(screen.getByRole('button', { name: /Add Item/i }))

    expect(await screen.findByText("Couldn't save right now — try again.")).toBeInTheDocument()
    expect(
      screen.queryByText('Document with the requested ID could not be found.'),
    ).not.toBeInTheDocument()
  })

  it.each([
    { search: '' },
    { search: 'templateId=tpl-1' },
  ])('does not render fake Batch, AI, or Manual tabs ($search)', ({ search }) => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams(search) as never)
    if (search.includes('templateId=tpl-1')) {
      mockUseTemplate.mockReturnValue({
        template: milkTemplate,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })
    }
    render(<AddItemPage />)

    expect(screen.queryByRole('button', { name: 'Batch' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'AI Text' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'AI Image' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Manual' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Add Item', level: 1 })).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument()
  })

  it('prefills from templateId, creates with the edited quantity, and never updates', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('templateId=tpl-1') as never)
    mockUseTemplate.mockReturnValue({
      template: milkTemplate,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    const user = userEvent.setup()
    render(<AddItemPage />)

    const expected = itemDefaultsFromTemplate(milkTemplate)
    await waitFor(() => {
      expect(screen.getByLabelText(/Name/i)).toHaveValue(expected.name)
    })
    expect(screen.getByLabelText(/Quantity/i)).toHaveValue(expected.quantity)
    expect(screen.getByLabelText(/Unit/i)).toHaveValue(expected.unit)
    expect(screen.getByLabelText(/Location/i)).toHaveValue(expected.locationId)
    expect(screen.getByLabelText(/Category/i)).toHaveValue(expected.categoryId)
    expect(screen.getByLabelText(/Notes/i)).toHaveValue(expected.notes)
    expect(screen.getByLabelText(/Purchase Date/i)).toHaveValue(expected.purchaseDate)
    expect(screen.getByLabelText(/Expiration Date/i)).toHaveValue(expected.expirationDate)

    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '4')
    await user.click(screen.getByRole('button', { name: /Add Item/i }))

    await waitFor(() => {
      expect(mockCreateItem).toHaveBeenCalledTimes(1)
    })
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Milk',
        quantity: 4,
        unit: 'gal',
        locationId: 'loc-fridge',
        categoryId: 'cat-dairy',
        templateId: 'tpl-1',
        notes: 'Buy organic',
        createdById: 'user-1',
      }),
    )
    expect(mockUpdateItem).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/items/item-new')
  })

  it('shows Template not found and an empty name field when the template fetch fails', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('templateId=missing') as never)
    mockUseTemplate.mockReturnValue({
      template: null,
      isLoading: false,
      error: new Error('Failed to fetch template'),
      refetch: vi.fn(),
    })
    render(<AddItemPage />)

    expect(await screen.findByText('Template not found')).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/i)).toHaveValue('')
  })
})
