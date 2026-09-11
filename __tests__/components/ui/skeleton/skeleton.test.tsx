import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from '@/components/ui/skeleton/skeleton'

describe('Skeleton', () => {
  it('renders with animate-shimmer class', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('animate-shimmer')
  })

  it('renders with aria-hidden="true"', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })

  it('appends custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('animate-shimmer')
    expect(el.className).toContain('h-4')
    expect(el.className).toContain('w-32')
  })
})
