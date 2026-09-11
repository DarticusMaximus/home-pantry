import { describe, expect, it } from 'vitest'
import { zeroQuantityConfirmCopy } from '@/lib/inventory/zero-quantity-confirm'

describe('zeroQuantityConfirmCopy', () => {
  it('returns the pinned remove copy for a given name', () => {
    expect(zeroQuantityConfirmCopy('Milk')).toEqual({
      title: 'Remove Milk?',
      description: 'This will remove Milk from the pantry. This cannot be undone.',
      confirmText: 'Remove',
    })
  })
})
