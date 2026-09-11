import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditCategoryPage from '@/app/(app)/settings/categories/[id]/page'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
  useParams: vi.fn(() => ({
    id: '1',
  })),
}))

const mockCategories = [
  {
    id: '1',
    name: 'Meat',
    description: 'Red meat and poultry',
    color: '#ef4444',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
]

const mockMutate = vi.fn().mockResolvedValue({})

vi.mock('@/hooks/use-categories', () => ({
  useCategories: vi.fn().mockImplementation(() => ({
    categories: mockCategories,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

vi.mock('@/hooks/use-category-mutations', () => ({
  useUpdateCategory: vi.fn().mockImplementation(() => ({
    mutate: mockMutate,
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  })),
}))

import { useRouter } from 'next/navigation'
import { useCategories } from '@/hooks/use-categories'
import { useUpdateCategory } from '@/hooks/use-category-mutations'

describe('EditCategoryPage', () => {
  const mockUseCategories = useCategories as ReturnType<typeof vi.fn>
  const mockUseUpdateCategory = useUpdateCategory as ReturnType<typeof vi.fn>
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)
    mockUseCategories.mockReturnValue({
      categories: mockCategories,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseUpdateCategory.mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders page title', () => {
    render(<EditCategoryPage />)

    expect(screen.getByRole('heading', { name: 'Edit Category' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/settings/categories',
    )
  })

  it('renders loading state when categories are loading', () => {
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(<EditCategoryPage />)

    expect(screen.getByRole('heading', { name: 'Edit Category' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/settings/categories',
    )
  })

  it('renders error state when fetch fails', () => {
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    })

    render(<EditCategoryPage />)

    expect(screen.getByText(/failed to load category/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/settings/categories',
    )
  })

  it('renders not found state when category does not exist', () => {
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<EditCategoryPage />)

    expect(screen.getByText('Category not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/settings/categories',
    )
  })

  it('renders category form', () => {
    render(<EditCategoryPage />)

    const form = document.querySelector('form')
    expect(form).toBeInTheDocument()
  })

  it('wraps form in a card and Cancel returns to the list without mutating', () => {
    render(<EditCategoryPage />)

    const form = document.querySelector('form')
    expect(form?.parentElement).toHaveClass('rounded-xl', 'bg-white', 'p-6', 'shadow-xl')

    screen.getByRole('button', { name: 'Cancel' }).click()

    expect(mockPush).toHaveBeenCalledWith('/settings/categories')
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
