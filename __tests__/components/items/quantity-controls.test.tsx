import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuantityControls } from '@/components/items/quantity-controls'
import type { Item } from '@/types/item'

const mockItem: Item = {
  id: '1',
  name: 'Eggs',
  locationId: 'loc1',
  quantity: 4,
  unit: 'each',
  createdById: 'user1',
  createdAt: '',
  updatedAt: '',
}

afterEach(() => {
  cleanup()
})

describe('QuantityControls', () => {
  it('renders -1 button, quantity badge, and +1 button', () => {
    render(
      <QuantityControls
        item={mockItem}
        quantity={4}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onPartialUse={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Decrease quantity/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Increase quantity/i })).toBeInTheDocument()
    expect(screen.getByText('4 each')).toBeInTheDocument()
  })

  it('clicking +1 calls onIncrement', async () => {
    const onIncrement = vi.fn()
    const user = userEvent.setup()
    render(
      <QuantityControls
        item={mockItem}
        quantity={4}
        onIncrement={onIncrement}
        onDecrement={vi.fn()}
        onPartialUse={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Increase quantity/i }))
    expect(onIncrement).toHaveBeenCalledTimes(1)
  })

  it('clicking -1 calls onDecrement', async () => {
    const onDecrement = vi.fn()
    const user = userEvent.setup()
    render(
      <QuantityControls
        item={mockItem}
        quantity={4}
        onIncrement={vi.fn()}
        onDecrement={onDecrement}
        onPartialUse={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Decrease quantity/i }))
    expect(onDecrement).toHaveBeenCalledTimes(1)
  })

  it('clicking chevron reveals slider', async () => {
    const user = userEvent.setup()
    render(
      <QuantityControls
        item={mockItem}
        quantity={4}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onPartialUse={vi.fn()}
      />,
    )

    expect(screen.queryByText('Remove:')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('quantity-badge'))

    expect(screen.getByText(/Remove:/i)).toBeInTheDocument()
    expect(screen.getByText(/Remaining:/i)).toBeInTheDocument()
  })

  it('slider max is set to current quantity', async () => {
    const user = userEvent.setup()
    render(
      <QuantityControls
        item={mockItem}
        quantity={4}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onPartialUse={vi.fn()}
      />,
    )

    await user.click(screen.getByTestId('quantity-badge'))

    const slider = screen.getByRole('slider', { name: /Amount to remove/i })
    expect(slider).toHaveAttribute('max', '4')
    expect(slider).toHaveAttribute('step', '0.1')
  })

  it('clicking Apply calls onPartialUse with slider value', async () => {
    const onPartialUse = vi.fn()
    const user = userEvent.setup()
    render(
      <QuantityControls
        item={mockItem}
        quantity={4}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onPartialUse={onPartialUse}
      />,
    )

    await user.click(screen.getByTestId('quantity-badge'))

    const slider = screen.getByRole('slider', { name: /Amount to remove/i })
    fireEvent.change(slider, { target: { value: '2', valueAsNumber: 2 } })

    await user.click(screen.getByRole('button', { name: /Apply/i }))
    expect(onPartialUse).toHaveBeenCalledWith(2)
  })

  it('clicking Cancel hides slider without calling onPartialUse', async () => {
    const onPartialUse = vi.fn()
    const user = userEvent.setup()
    render(
      <QuantityControls
        item={mockItem}
        quantity={4}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onPartialUse={onPartialUse}
      />,
    )

    await user.click(screen.getByTestId('quantity-badge'))
    expect(screen.getByText(/Remove:/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cancel/i }))

    expect(screen.queryByText(/Remove:/i)).not.toBeInTheDocument()
    expect(onPartialUse).not.toHaveBeenCalled()
  })

  it('Apply button is disabled when slider is at 0', async () => {
    const user = userEvent.setup()
    render(
      <QuantityControls
        item={mockItem}
        quantity={4}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onPartialUse={vi.fn()}
      />,
    )

    await user.click(screen.getByTestId('quantity-badge'))

    const applyButton = screen.getByRole('button', { name: /Apply/i })
    expect(applyButton).toBeDisabled()
  })
})
