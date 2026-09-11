import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CannotReachPantry } from '@/components/ui/cannot-reach-pantry'
import { CANNOT_REACH_PANTRY_COPY } from '@/lib/pantry-reachability'

describe('CannotReachPantry', () => {
  it('renders exact copy, alert role, and 44px Try again that calls onRetry', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()

    render(<CannotReachPantry onRetry={onRetry} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(CANNOT_REACH_PANTRY_COPY)
    expect(alert.textContent).toContain("Can't reach the pantry.")

    const retry = screen.getByRole('button', { name: 'Try again' })
    expect(retry).toHaveAttribute('type', 'button')
    expect(retry).toHaveAttribute('aria-label', 'Try again')
    expect(retry).toHaveTextContent('Try again')
    expect(retry).toHaveClass('min-h-[44px]')

    const minHeight = Number.parseFloat(window.getComputedStyle(retry).minHeight)
    const height = retry.getBoundingClientRect().height
    expect(Math.max(height, Number.isFinite(minHeight) ? minHeight : 0)).toBeGreaterThanOrEqual(44)

    await user.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
