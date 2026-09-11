import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BatchConfirmBar } from '@/components/ai/batch-confirm-bar'

afterEach(() => {
  cleanup()
})

describe('BatchConfirmBar', () => {
  it('sits at the real bottom with home-indicator padding', () => {
    const { container } = render(
      <BatchConfirmBar operation="add" canConfirm unresolvedCount={0} onConfirm={vi.fn()} />,
    )

    const wrapper = container.firstElementChild
    expect(wrapper).toHaveClass('bottom-0', 'pb-confirm-bar')
    expect(wrapper).not.toHaveClass('bottom-16')
    expect(wrapper).not.toHaveClass('py-3')

    expect(screen.getByRole('button', { name: 'Add to Pantry' })).toHaveClass('min-h-[44px]')
  })

  it('keeps Remove from Pantry at 44px', () => {
    render(
      <BatchConfirmBar operation="remove" canConfirm unresolvedCount={0} onConfirm={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: 'Remove from Pantry' })).toHaveClass('min-h-[44px]')
  })

  it('calls onConfirm when Save is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(<BatchConfirmBar operation="add" canConfirm unresolvedCount={0} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Add to Pantry' }))

    expect(onConfirm).toHaveBeenCalled()
  })
})

describe('BatchReviewScreen list pad', () => {
  it('pads the review list for the confirm bar without the fake nav gap', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'components/ai/batch-review-screen.tsx'),
      'utf8',
    )

    expect(source).toContain('className="px-4 pt-4 pb-confirm"')
    expect(source).not.toContain('pb-32')
  })
})
