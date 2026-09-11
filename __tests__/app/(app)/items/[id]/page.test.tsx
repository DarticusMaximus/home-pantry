import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ItemDetailPage from '@/app/(app)/items/[id]/page'
import type { Item } from '@/types/item'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-items', () => ({
  useItem: vi.fn(),
}))

vi.mock('@/hooks/use-locations', () => ({
  useLocations: vi.fn(),
}))

vi.mock('@/hooks/use-categories', () => ({
  useCategories: vi.fn(),
}))

vi.mock('@/hooks/use-item-mutations', () => ({
  useDeleteItem: vi.fn(),
}))

vi.mock('@/hooks/use-quantity', () => ({
  useQuantity: vi.fn(),
}))

vi.mock('@/lib/appwrite/items', () => ({
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}))

import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useCategories } from '@/hooks/use-categories'
import { useDeleteItem } from '@/hooks/use-item-mutations'
import { useItem } from '@/hooks/use-items'
import { useLocations } from '@/hooks/use-locations'
import { useQuantity } from '@/hooks/use-quantity'
import { deleteItem, updateItem } from '@/lib/appwrite/items'

function localYmd(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const mockUseAuth = vi.mocked(useAuth)
const mockUseItem = vi.mocked(useItem)
const mockUseLocations = vi.mocked(useLocations)
const mockUseCategories = vi.mocked(useCategories)
const mockUseDeleteItem = vi.mocked(useDeleteItem)
const mockUseQuantity = vi.mocked(useQuantity)
const mockUseParams = vi.mocked(useParams)
const mockUseRouter = vi.mocked(useRouter)
const mockDeleteItem = vi.mocked(deleteItem)
const mockUpdateItem = vi.mocked(updateItem)
const mockCancelPendingWrites = vi.fn()
const mockRestorePendingWrites = vi.fn()
const mockClearPatchesOnRefetch = vi.fn()

const mockPush = vi.fn()

const mockItem = {
  id: 'item-1',
  name: 'Steak',
  quantity: 4,
  unit: 'each',
  locationId: 'loc1',
  categoryId: 'cat1',
  purchaseDate: '2026-01-01',
  expirationDate: undefined,
  notes: 'Good cut',
  createdById: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function quantityStub(options?: { onZeroIntent?: (item: Item) => void }) {
  return {
    incrementQuantity: vi.fn(),
    decrementQuantity: vi.fn((item: Item) => {
      if (item.quantity - 1 <= 0) {
        options?.onZeroIntent?.(item)
      }
    }),
    partialUse: vi.fn(),
    setQuantity: vi.fn().mockResolvedValue(undefined),
    cancelPendingWrites: mockCancelPendingWrites,
    restorePendingWrites: mockRestorePendingWrites,
    getOptimisticQuantity: (item: { quantity: number }) => item.quantity,
    patchItem: (item: Item) => item,
    patchItems: (items: Item[]) => items,
    clearPatchesOnRefetch: mockClearPatchesOnRefetch,
    isFlushing: false,
    error: null,
  }
}

describe('ItemDetailPage', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'item-1' })
    mockUseRouter.mockReturnValue({ push: mockPush } as never)
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    mockUseItem.mockReturnValue({
      item: mockItem,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    mockUseLocations.mockReturnValue({
      locations: [{ id: 'loc1', name: 'Freezer', icon: 'snowflake', sortOrder: 1 } as never],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    mockUseCategories.mockReturnValue({
      categories: [{ id: 'cat1', name: 'Meat', color: '#ff0000', sortOrder: 1 } as never],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    mockUseDeleteItem.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    mockUseQuantity.mockImplementation((_cb, options) => quantityStub(options))
    mockDeleteItem.mockResolvedValue(undefined)
    mockUpdateItem.mockResolvedValue(mockItem as never)
  })

  it('renders Back to home when loaded', () => {
    render(<ItemDetailPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')
  })

  it('renders Back to home on error', () => {
    mockUseItem.mockReturnValue({
      item: null,
      isLoading: false,
      error: new Error('fail'),
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')
  })

  it('renders Back to home when not found', () => {
    mockUseItem.mockReturnValue({
      item: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')
  })

  it('renders Back to home on skeleton', () => {
    vi.useFakeTimers()
    mockUseItem.mockReturnValue({
      item: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')
  })

  it('renders item name and quantity', () => {
    render(<ItemDetailPage />)

    expect(screen.getByText('Steak')).toBeInTheDocument()
    expect(screen.getByText('4 each')).toBeInTheDocument()
  })

  it('renders +/- buttons', () => {
    render(<ItemDetailPage />)

    expect(screen.getByLabelText('Increase quantity by 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Decrease quantity by 1')).toBeInTheDocument()
  })

  it('calls incrementQuantity when +1 tapped', () => {
    const increment = vi.fn()
    mockUseQuantity.mockReturnValue({
      ...quantityStub(),
      incrementQuantity: increment,
    })

    render(<ItemDetailPage />)
    fireEvent.click(screen.getByLabelText('Increase quantity by 1'))

    expect(increment).toHaveBeenCalledWith(mockItem)
  })

  it('calls decrementQuantity when -1 tapped', () => {
    const decrement = vi.fn()
    mockUseQuantity.mockReturnValue({
      ...quantityStub(),
      decrementQuantity: decrement,
    })

    render(<ItemDetailPage />)
    fireEvent.click(screen.getByLabelText('Decrease quantity by 1'))

    expect(decrement).toHaveBeenCalledWith(mockItem)
  })

  it('shows direct input when quantity is tapped', () => {
    render(<ItemDetailPage />)

    fireEvent.click(screen.getByLabelText('Tap to edit quantity'))

    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('renders location and category info', () => {
    render(<ItemDetailPage />)

    expect(screen.getByText('Freezer')).toBeInTheDocument()
    expect(screen.getByText('Meat')).toBeInTheDocument()
  })

  it('gives the Edit link a 44px target', () => {
    render(<ItemDetailPage />)

    const edit = screen.getByRole('link', { name: 'Edit' })
    expect(edit).toHaveAttribute('href', '/items/item-1/edit')
    expect(
      (edit.classList.contains('h-11') && edit.classList.contains('w-11')) ||
        (edit.classList.contains('min-h-[44px]') && edit.classList.contains('min-w-[44px]')),
    ).toBe(true)
  })

  it('uses valid CSS colors when the category has no color', () => {
    mockUseCategories.mockReturnValue({
      categories: [{ id: 'cat1', name: 'Meat', sortOrder: 1 } as never],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)

    const chip = screen.getByText('Meat')
    const style = chip.getAttribute('style') ?? ''
    expect(style).not.toContain('#gray-')
    expect(style).toMatch(/#f3f4f6|rgb\(243,\s*244,\s*246\)/)
    expect(style).toMatch(/#374151|rgb\(55,\s*65,\s*81\)/)
  })

  it('renders delete button', () => {
    render(<ItemDetailPage />)

    expect(screen.getByText('Delete Item')).toBeInTheDocument()
  })

  it('does not show Last Used', () => {
    render(<ItemDetailPage />)

    expect(screen.queryByText('Last Used')).not.toBeInTheDocument()
  })

  it('keeps a destructive delete confirm then deletes', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined)
    mockUseDeleteItem.mockReturnValue({
      mutate,
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<ItemDetailPage />)
    fireEvent.click(screen.getByText('Delete Item'))

    const trashDialog = screen.getByRole('dialog')
    expect(trashDialog).toHaveTextContent('Delete Item')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith('item-1')
    })
  })

  it('shows household delete copy when delete mutate rejects', async () => {
    const mutate = vi.fn().mockRejectedValue(new Error('Delete failed'))
    mockUseDeleteItem.mockReturnValue({
      mutate,
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<ItemDetailPage />)
    fireEvent.click(screen.getByText('Delete Item'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText("Couldn't delete right now — try again.")).toBeInTheDocument()
    expect(screen.queryByText('Delete failed')).not.toBeInTheDocument()
  })

  it('opens remove confirm when quantity is set to 0 and does not update until Remove', async () => {
    render(<ItemDetailPage />)

    fireEvent.click(screen.getByLabelText('Tap to edit quantity'))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.blur(input)

    expect(screen.getByText('Remove Steak?')).toBeInTheDocument()
    expect(
      screen.getByText('This will remove Steak from the pantry. This cannot be undone.'),
    ).toBeInTheDocument()
    expect(mockUpdateItem).not.toHaveBeenCalled()
    expect(mockDeleteItem).not.toHaveBeenCalled()
    expect(screen.getByText('4 each')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockPush).toHaveBeenCalledWith('/')
    })
    expect(mockUpdateItem).not.toHaveBeenCalled()
  })

  it('does not delete when Cancel is clicked after typing 0', () => {
    render(<ItemDetailPage />)

    fireEvent.click(screen.getByLabelText('Tap to edit quantity'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    fireEvent.blur(screen.getByRole('spinbutton'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mockDeleteItem).not.toHaveBeenCalled()
    expect(mockUpdateItem).not.toHaveBeenCalled()
    expect(mockRestorePendingWrites).toHaveBeenCalledWith('item-1')
    expect(screen.queryByText('Remove Steak?')).not.toBeInTheDocument()
    expect(screen.getByText('4 each')).toBeInTheDocument()
  })

  it('shows pinned copy when decreasing from 1', () => {
    mockUseItem.mockReturnValue({
      item: { ...mockItem, quantity: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)
    fireEvent.click(screen.getByLabelText('Decrease quantity by 1'))

    expect(screen.getByText('Remove Steak?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(mockDeleteItem).not.toHaveBeenCalled()
    expect(screen.getByText('1 each')).toBeInTheDocument()
  })

  it('does not open the remove dialog when decreasing from 2', () => {
    mockUseItem.mockReturnValue({
      item: { ...mockItem, quantity: 2 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)
    fireEvent.click(screen.getByLabelText('Decrease quantity by 1'))

    expect(screen.queryByText('Remove Steak?')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockDeleteItem).not.toHaveBeenCalled()
  })

  it('calls deleteItem then navigates home when Remove is confirmed from decrease', async () => {
    mockUseItem.mockReturnValue({
      item: { ...mockItem, quantity: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)
    fireEvent.click(screen.getByLabelText('Decrease quantity by 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockPush).toHaveBeenCalledWith('/')
    })
    expect(mockCancelPendingWrites).toHaveBeenCalledWith('item-1')
    expect(mockCancelPendingWrites.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteItem.mock.invocationCallOrder[0],
    )
  })

  it('calls deleteItem once when Remove is double-tapped while delete is in flight', async () => {
    let resolveDelete = () => {}
    let callCount = 0
    mockDeleteItem.mockImplementation(() => {
      callCount += 1
      if (callCount === 1) {
        return new Promise<void>((resolve) => {
          resolveDelete = resolve
        })
      }
      return Promise.reject(new Error('Document not found'))
    })

    mockUseItem.mockReturnValue({
      item: { ...mockItem, quantity: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)
    fireEvent.click(screen.getByLabelText('Decrease quantity by 1'))

    const remove = screen.getByRole('button', { name: 'Remove' })
    fireEvent.click(remove)
    fireEvent.click(remove)

    expect(mockDeleteItem).toHaveBeenCalledTimes(1)
    expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
    expect(mockCancelPendingWrites).toHaveBeenCalledWith('item-1')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled()
    })
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    resolveDelete()
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
    expect(screen.queryByText('Failed to update. Try again.')).not.toBeInTheDocument()
  })

  it.each([
    '-1',
    '',
    'abc',
  ])('shows today’s error for invalid direct input %j and does not open the dialog', (value) => {
    render(<ItemDetailPage />)

    fireEvent.click(screen.getByLabelText('Tap to edit quantity'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value } })
    fireEvent.blur(screen.getByRole('spinbutton'))

    expect(screen.getByText('Quantity must be a positive number')).toBeInTheDocument()
    expect(screen.queryByText('Remove Steak?')).not.toBeInTheDocument()
    expect(mockDeleteItem).not.toHaveBeenCalled()
    expect(mockUpdateItem).not.toHaveBeenCalled()
  })

  it('commits typed quantity through setQuantity instead of updateItem', async () => {
    const setQuantity = vi.fn().mockResolvedValue(undefined)
    mockUseQuantity.mockReturnValue({
      ...quantityStub(),
      setQuantity,
    })

    render(<ItemDetailPage />)
    fireEvent.click(screen.getByLabelText('Tap to edit quantity'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } })
    fireEvent.blur(screen.getByRole('spinbutton'))

    await waitFor(() => {
      expect(setQuantity).toHaveBeenCalledWith(mockItem, 5)
    })
    expect(mockUpdateItem).not.toHaveBeenCalled()
  })

  it('shows Expired N days ago for a past expiration', () => {
    mockUseItem.mockReturnValue({
      item: { ...mockItem, expirationDate: localYmd(-2) },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)

    expect(screen.getByText('Expired 2 days ago')).toBeInTheDocument()
  })

  it('shows Expires today when expiration is today', () => {
    mockUseItem.mockReturnValue({
      item: { ...mockItem, expirationDate: localYmd(0) },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)

    expect(screen.getByText('Expires today')).toBeInTheDocument()
  })

  it('shows Expires in 3 days when expiration is 3 days out', () => {
    mockUseItem.mockReturnValue({
      item: { ...mockItem, expirationDate: localYmd(3) },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<ItemDetailPage />)

    expect(screen.getByText('Expires in 3 days')).toBeInTheDocument()
  })

  it('does not show an expiration status chip when no date is set', () => {
    render(<ItemDetailPage />)

    expect(screen.queryByText('Expires today')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Expired /)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Expires in /)).not.toBeInTheDocument()
    expect(screen.queryByText('Expiring soon')).not.toBeInTheDocument()
  })

  describe('quantity overlay after write', () => {
    it('refetches on write success without clearing overlays first', () => {
      const refetch = vi.fn()
      let onSuccess: (() => void) | undefined
      mockUseQuantity.mockImplementation((cb, options) => {
        onSuccess = cb
        return quantityStub(options)
      })
      mockUseItem.mockReturnValue({
        item: mockItem,
        isLoading: false,
        error: null,
        refetch,
      })

      render(<ItemDetailPage />)

      expect(mockClearPatchesOnRefetch).toHaveBeenCalledWith([mockItem])
      mockClearPatchesOnRefetch.mockClear()
      refetch.mockClear()

      onSuccess?.()
      expect(refetch).toHaveBeenCalled()
      expect(mockClearPatchesOnRefetch).not.toHaveBeenCalled()
    })

    it('clears matching overlays when the fetched item updates', () => {
      const refetch = vi.fn()
      mockUseItem.mockReturnValue({
        item: mockItem,
        isLoading: false,
        error: null,
        refetch,
      })

      const { rerender } = render(<ItemDetailPage />)
      mockClearPatchesOnRefetch.mockClear()

      const updated = { ...mockItem, quantity: 5 }
      mockUseItem.mockReturnValue({
        item: updated,
        isLoading: false,
        error: null,
        refetch,
      })
      rerender(<ItemDetailPage />)

      expect(mockClearPatchesOnRefetch).toHaveBeenCalledWith([updated])
    })

    it('passes an empty list when the fetched item is gone', () => {
      mockUseItem.mockReturnValue({
        item: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<ItemDetailPage />)

      expect(mockClearPatchesOnRefetch).toHaveBeenCalledWith([])
    })
  })

  describe('zero-quantity confirm with real useQuantity', () => {
    beforeEach(async () => {
      const { useQuantity: actualUseQuantity } =
        await vi.importActual<typeof import('@/hooks/use-quantity')>('@/hooks/use-quantity')
      mockUseQuantity.mockImplementation(actualUseQuantity)
    })

    it('opens confirm after two rapid decreases from 2, then Remove deletes once without updateItem', async () => {
      mockUseItem.mockReturnValue({
        item: { ...mockItem, quantity: 2 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<ItemDetailPage />)

      const decrease = screen.getByLabelText('Decrease quantity by 1')
      fireEvent.click(decrease)
      fireEvent.click(decrease)

      expect(screen.getByText('Remove Steak?')).toBeInTheDocument()
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(mockDeleteItem).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledWith('/')
      })
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).not.toHaveBeenCalled()

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
      })
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).toHaveBeenCalledTimes(1)
    })
  })
})
