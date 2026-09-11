import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackLink } from '@/components/layout/back-link'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    className?: string
    [key: string]: unknown
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}))

describe('BackLink', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a Back link to the given href with a 44px tap target', () => {
    render(<BackLink href="/settings" />)

    const link = screen.getByRole('link', { name: 'Back' })
    expect(link).toHaveAttribute('href', '/settings')
    expect(link).toHaveClass('h-11', 'w-11', 'min-h-[44px]', 'min-w-[44px]')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('uses the href passed on a second render', () => {
    render(<BackLink href="/" />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
