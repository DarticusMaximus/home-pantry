import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InlineQuantityEditor } from '@/components/ai/inline-quantity-editor'

describe('InlineQuantityEditor', () => {
  it('caps a fractional quantity at the configured maximum', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<InlineQuantityEditor quantity={4.5} maxQuantity={5} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Increment quantity' }))

    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('increments normally when no maximum is configured', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<InlineQuantityEditor quantity={5} maxQuantity={undefined} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Increment quantity' }))

    expect(onChange).toHaveBeenCalledWith(6)
  })
})
