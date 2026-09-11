import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OperationToggle } from '@/components/ai/operation-toggle'

afterEach(() => {
  cleanup()
})

describe('OperationToggle', () => {
  it('keeps Add and Remove at 44px and reports the selected mode', () => {
    render(<OperationToggle value="add" onChange={vi.fn()} />)

    const add = screen.getByRole('radio', { name: /add/i })
    const remove = screen.getByRole('radio', { name: /remove/i })

    expect(add).toHaveClass('min-h-[44px]')
    expect(remove).toHaveClass('min-h-[44px]')
    expect(add).toBeEnabled()
    expect(remove).toBeEnabled()
    expect(add).toHaveAttribute('aria-checked', 'true')
    expect(remove).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange when a radio is chosen', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<OperationToggle value="add" onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: /remove/i }))

    expect(onChange).toHaveBeenCalledWith('remove')
  })

  it('disables Add and Remove when disabled without shrinking the hit target', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<OperationToggle value="add" onChange={onChange} disabled />)

    const add = screen.getByRole('radio', { name: /add/i })
    const remove = screen.getByRole('radio', { name: /remove/i })

    expect(add).toBeDisabled()
    expect(remove).toBeDisabled()
    expect(add).toHaveClass('min-h-[44px]')
    expect(remove).toHaveClass('min-h-[44px]')

    await user.click(remove)

    expect(onChange).not.toHaveBeenCalled()
  })
})
