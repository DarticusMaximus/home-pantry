import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ITEM_CARD_SKELETON_KEYS,
  ItemCardSkeleton,
} from '@/components/ui/skeleton/item-card-skeleton'

describe('ItemCardSkeleton', () => {
  it('renders with rounded-xl class', () => {
    const { container } = render(<ItemCardSkeleton />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('rounded-xl')
  })

  it('contains multiple skeleton children (shape-matched elements)', () => {
    const { container } = render(<ItemCardSkeleton />)
    const skeletons = container.querySelectorAll('[aria-hidden="true"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(4)
  })

  it('ITEM_CARD_SKELETON_KEYS has 4 entries', () => {
    expect(ITEM_CARD_SKELETON_KEYS).toHaveLength(4)
  })
})
