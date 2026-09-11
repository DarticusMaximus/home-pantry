import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ItemCard } from '@/components/items/item-card'
import type { Item } from '@/types/item'

function localYmd(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const defaultQuantityProps = {
  onIncrement: vi.fn(),
  onDecrement: vi.fn(),
  onPartialUse: vi.fn(),
}

describe('ItemCard', () => {
  const mockItem: Item = {
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

  const mockLocation = {
    id: 'loc1',
    name: 'Fridge',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  }

  const mockCategory = {
    id: 'cat1',
    name: 'Dairy',
    color: '#22c55e',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  }

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders item name', () => {
    render(<ItemCard item={mockItem} {...defaultQuantityProps} />)

    expect(screen.getByText('Milk')).toBeInTheDocument()
  })

  it('renders quantity and unit via QuantityControls', () => {
    render(<ItemCard item={mockItem} {...defaultQuantityProps} />)

    expect(screen.getByText('2 L')).toBeInTheDocument()
  })

  it('renders location badge when location provided', () => {
    render(<ItemCard item={mockItem} location={mockLocation} {...defaultQuantityProps} />)

    expect(screen.getByText('Fridge')).toBeInTheDocument()
  })

  it('does not render location badge when no location', () => {
    render(<ItemCard item={mockItem} {...defaultQuantityProps} />)

    expect(screen.queryByText('Fridge')).not.toBeInTheDocument()
  })

  it('renders category badge when category provided', () => {
    render(<ItemCard item={mockItem} category={mockCategory} {...defaultQuantityProps} />)

    expect(screen.getByText('Dairy')).toBeInTheDocument()
  })

  it('does not render category badge when no category', () => {
    render(<ItemCard item={mockItem} {...defaultQuantityProps} />)

    expect(screen.queryByText('Dairy')).not.toBeInTheDocument()
  })

  it('does not render expiration badge when not set', () => {
    render(<ItemCard item={mockItem} {...defaultQuantityProps} />)

    expect(screen.queryByText('Expired')).not.toBeInTheDocument()
    expect(screen.queryByText('Expiring soon')).not.toBeInTheDocument()
  })

  it('shows amber badge for expiring within 7 days', () => {
    const itemWithExpiration = {
      ...mockItem,
      expirationDate: localYmd(5),
    }

    render(<ItemCard item={itemWithExpiration} {...defaultQuantityProps} />)

    expect(screen.getByText('Expiring soon')).toBeInTheDocument()
  })

  it('shows amber badge for expiring within 3 days', () => {
    const itemWithExpiration = {
      ...mockItem,
      expirationDate: localYmd(2),
    }

    render(<ItemCard item={itemWithExpiration} {...defaultQuantityProps} />)

    expect(screen.getByText('Expiring soon')).toBeInTheDocument()
  })

  it('shows red badge for expired items', () => {
    const itemWithExpiration = {
      ...mockItem,
      expirationDate: localYmd(-2),
    }

    render(<ItemCard item={itemWithExpiration} {...defaultQuantityProps} />)

    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('does not render expiration badge 8 days out', () => {
    const itemWithExpiration = {
      ...mockItem,
      expirationDate: localYmd(8),
    }

    render(<ItemCard item={itemWithExpiration} {...defaultQuantityProps} />)

    expect(screen.queryByText('Expired')).not.toBeInTheDocument()
    expect(screen.queryByText('Expiring soon')).not.toBeInTheDocument()
  })

  it('calls onIncrement when +1 button clicked', async () => {
    const onIncrement = vi.fn()
    const user = userEvent.setup()
    render(<ItemCard item={mockItem} {...defaultQuantityProps} onIncrement={onIncrement} />)

    await user.click(screen.getByRole('button', { name: /Increase quantity/i }))
    expect(onIncrement).toHaveBeenCalled()
  })

  it('calls onDecrement when -1 button clicked', async () => {
    const onDecrement = vi.fn()
    const user = userEvent.setup()
    render(<ItemCard item={mockItem} {...defaultQuantityProps} onDecrement={onDecrement} />)

    await user.click(screen.getByRole('button', { name: /Decrease quantity/i }))
    expect(onDecrement).toHaveBeenCalled()
  })

  it('calls onEdit when Edit button clicked', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<ItemCard item={mockItem} onEdit={onEdit} {...defaultQuantityProps} />)

    await user.click(screen.getByRole('button', { name: /Edit Milk/i }))
    expect(onEdit).toHaveBeenCalled()
  })

  it('keeps Edit outside the name link', () => {
    render(<ItemCard item={mockItem} onEdit={vi.fn()} {...defaultQuantityProps} />)

    const edit = screen.getByRole('button', { name: /Edit Milk/i })
    expect(edit.closest('a')).toBeNull()
    expect(screen.getByRole('link', { name: /Milk/ })).toHaveAttribute('href', '/items/1')
  })

  it('calls onEdit when Tab then Enter on Edit', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<ItemCard item={mockItem} onEdit={onEdit} {...defaultQuantityProps} />)

    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: /Edit Milk/i })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onEdit).toHaveBeenCalled()
  })

  it('does not render Edit button when onEdit not provided', () => {
    render(<ItemCard item={mockItem} {...defaultQuantityProps} />)

    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument()
  })

  it('displays item quantity from item data', () => {
    render(<ItemCard item={mockItem} {...defaultQuantityProps} />)

    expect(screen.getByText('2 L')).toBeInTheDocument()
  })

  it('displays updated quantity when item.quantity changes', () => {
    const updatedItem = { ...mockItem, quantity: 5 }
    render(<ItemCard item={updatedItem} {...defaultQuantityProps} />)

    expect(screen.getByText('5 L')).toBeInTheDocument()
  })
})
