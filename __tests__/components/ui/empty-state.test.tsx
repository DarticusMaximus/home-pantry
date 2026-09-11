import { render, screen } from '@testing-library/react'
import { SearchX } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '@/components/ui/empty-state'

describe('EmptyState', () => {
  it('renders icon, heading, and body text', () => {
    render(<EmptyState icon={SearchX} heading="No items found" body="Try adjusting your search" />)
    expect(screen.getByText('No items found')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search')).toBeInTheDocument()
  })

  it('renders action button when action prop is provided', () => {
    render(
      <EmptyState
        icon={SearchX}
        heading="No items"
        body="Add one"
        action={{ label: 'Add item', onClick: () => {} }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument()
  })

  it('does not render action button when action prop is undefined', () => {
    render(<EmptyState icon={SearchX} heading="No items" body="Nothing here" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('action button has min-h-[44px] class', () => {
    render(
      <EmptyState
        icon={SearchX}
        heading="No items"
        body="Add one"
        action={{ label: 'Add item', onClick: () => {} }}
      />,
    )
    const button = screen.getByRole('button', { name: 'Add item' })
    expect(button.className).toContain('min-h-[44px]')
  })
})
