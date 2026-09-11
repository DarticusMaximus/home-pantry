import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TemplatesPage from '@/app/(app)/settings/templates/page'

vi.mock('@/hooks/use-templates', () => ({
  useTemplates: vi.fn(),
}))

vi.mock('@/hooks/use-categories', () => ({
  useCategories: () => ({ categories: [] }),
}))

vi.mock('@/hooks/use-locations', () => ({
  useLocations: () => ({ locations: [] }),
}))

vi.mock('@/hooks/use-template-mutations', () => ({
  useCreateTemplate: () => ({
    mutate: vi.fn(),
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  }),
  useUpdateTemplate: () => ({
    mutateWithId: vi.fn(),
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  }),
  useDeleteTemplate: () => ({
    mutate: vi.fn(),
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  }),
}))

import { useTemplates } from '@/hooks/use-templates'

describe('TemplatesPage', () => {
  beforeEach(() => {
    vi.mocked(useTemplates).mockReturnValue({
      templates: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders Back to settings', () => {
    render(<TemplatesPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/settings')
  })

  it('renders Back to settings on error', () => {
    vi.mocked(useTemplates).mockReturnValue({
      templates: [],
      isLoading: false,
      error: new Error('fail'),
      refetch: vi.fn(),
    })

    render(<TemplatesPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/settings')
  })

  it('renders Back to settings when loading', () => {
    vi.mocked(useTemplates).mockReturnValue({
      templates: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(<TemplatesPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/settings')
  })
})
