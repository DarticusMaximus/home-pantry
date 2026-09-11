import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditItemPage from '@/app/(app)/items/[id]/edit/page'
import type { Item } from '@/types/item'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}))

vi.mock('@/hooks/use-items', () => ({
  useItem: vi.fn(),
}))

vi.mock('@/hooks/use-categories', () => ({
  useCategories: vi.fn(),
}))

vi.mock('@/hooks/use-locations', () => ({
  useLocations: vi.fn(),
}))

vi.mock('@/hooks/use-templates', () => ({
  useTemplateSearch: vi.fn(() => ({ results: [], isLoading: false })),
}))

vi.mock('@/lib/appwrite/items', () => ({
  deleteItem: vi.fn(),
  updateItem: vi.fn(),
}))

import { useParams, useRouter } from 'next/navigation'
import { useCategories } from '@/hooks/use-categories'
import { useItem } from '@/hooks/use-items'
import { useLocations } from '@/hooks/use-locations'
import { deleteItem, updateItem } from '@/lib/appwrite/items'

const mockUseItem = vi.mocked(useItem)
const mockUseCategories = vi.mocked(useCategories)
const mockUseLocations = vi.mocked(useLocations)
const mockUseParams = vi.mocked(useParams)
const mockUseRouter = vi.mocked(useRouter)
const mockDeleteItem = vi.mocked(deleteItem)
const mockUpdateItem = vi.mocked(updateItem)

const mockPush = vi.fn()

const mockItem: Item = {
  id: 'item-1',
  name: 'Milk',
  quantity: 2,
  unit: 'L',
  locationId: 'loc1',
  categoryId: 'cat1',
  createdById: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('EditItemPage', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'item-1' })
    mockUseRouter.mockReturnValue({ push: mockPush } as never)
    mockUseItem.mockReturnValue({
      item: mockItem,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseCategories.mockReturnValue({
      categories: [{ id: 'cat1', name: 'Dairy', sortOrder: 1, createdAt: '', updatedAt: '' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseLocations.mockReturnValue({
      locations: [{ id: 'loc1', name: 'Fridge', sortOrder: 1, createdAt: '', updatedAt: '' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockDeleteItem.mockResolvedValue(undefined as never)
    mockUpdateItem.mockResolvedValue(undefined as never)
  })

  it('renders Back to item detail when loaded', () => {
    render(<EditItemPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/items/item-1')
  })

  it('renders Back to item detail on error', () => {
    mockUseItem.mockReturnValue({
      item: null,
      isLoading: false,
      error: new Error('fail'),
      refetch: vi.fn(),
    })

    render(<EditItemPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/items/item-1')
  })

  it('renders Back to item detail when not found', () => {
    mockUseItem.mockReturnValue({
      item: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<EditItemPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/items/item-1')
  })

  it('renders Back to item detail on skeleton', () => {
    vi.useFakeTimers()
    mockUseItem.mockReturnValue({
      item: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(<EditItemPage />)
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/items/item-1')
  })

  it('shows household save copy when updateItem rejects an Appwrite-like error', async () => {
    mockUpdateItem.mockRejectedValueOnce(
      new Error('Document with the requested ID could not be found.'),
    )
    const user = userEvent.setup()
    render(<EditItemPage />)

    await user.click(screen.getByRole('button', { name: /Update Item/i }))

    expect(await screen.findByText("Couldn't save right now — try again.")).toBeInTheDocument()
    expect(
      screen.queryByText('Document with the requested ID could not be found.'),
    ).not.toBeInTheDocument()
  })

  it('deletes and navigates home when Remove is confirmed for quantity 0', async () => {
    const user = userEvent.setup()
    render(<EditItemPage />)

    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '0')
    await user.click(screen.getByRole('button', { name: /Update Item/i }))

    await user.click(await screen.findByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockPush).toHaveBeenCalledWith('/')
    })
    expect(mockUpdateItem).not.toHaveBeenCalled()
  })

  it('does not update or delete when quantity 0 confirm is cancelled', async () => {
    const user = userEvent.setup()
    render(<EditItemPage />)

    await user.clear(screen.getByLabelText(/Quantity/i))
    await user.type(screen.getByLabelText(/Quantity/i), '0')
    await user.click(screen.getByRole('button', { name: /Update Item/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(mockDeleteItem).not.toHaveBeenCalled()
    expect(mockUpdateItem).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Quantity/i)).toHaveValue(2)
  })
})
