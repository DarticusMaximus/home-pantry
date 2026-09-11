import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddCategoryPage from '@/app/(app)/settings/categories/add/page'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}))

const mockMutate = vi.fn().mockResolvedValue({})

vi.mock('@/hooks/use-categories', () => ({
  useCategories: vi.fn().mockImplementation(() => ({
    categories: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

vi.mock('@/hooks/use-category-mutations', () => ({
  useCreateCategory: vi.fn().mockImplementation(() => ({
    mutate: mockMutate,
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  })),
}))

import { useCategories } from '@/hooks/use-categories'
import { useCreateCategory } from '@/hooks/use-category-mutations'

vi.mock('@/components/settings/category-form', () => ({
  CategoryForm: vi.fn(
    ({
      onSubmit,
      isLoading,
      onCancel,
    }: {
      onSubmit: (data: any) => void
      isLoading: boolean
      onCancel?: () => void
    }) => (
      <div data-testid="mock-category-form">
        <button
          type="button"
          onClick={() => onSubmit({ name: 'Test' })}
          data-testid="submit-button"
        >
          Submit
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        {isLoading && <span>Loading...</span>}
      </div>
    ),
  ),
}))

import { useRouter } from 'next/navigation'

describe('AddCategoryPage', () => {
  const mockUseCategories = useCategories as ReturnType<typeof vi.fn>
  const mockUseCreateCategory = useCreateCategory as ReturnType<typeof vi.fn>
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseCreateCategory.mockReturnValue({
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
    render(<AddCategoryPage />)

    expect(screen.getByRole('heading', { name: 'Add Category' })).toBeInTheDocument()
  })

  it('renders Back to categories', () => {
    render(<AddCategoryPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/settings/categories',
    )
  })

  it('submits form and redirects on success', async () => {
    mockMutate.mockResolvedValueOnce({})
    render(<AddCategoryPage />)

    const submitButton = screen.getByTestId('submit-button')
    submitButton.click()

    expect(mockMutate).toHaveBeenCalledWith({ name: 'Test' })
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/settings/categories')
    })
  })

  it('shows error message on failure', async () => {
    mockMutate.mockRejectedValueOnce(new Error('Failed to create'))
    render(<AddCategoryPage />)

    const submitButton = screen.getByTestId('submit-button')
    submitButton.click()

    expect(mockMutate).toHaveBeenCalledWith({ name: 'Test' })
    expect(await screen.findByText("Couldn't save right now — try again.")).toBeInTheDocument()
    expect(screen.queryByText('Failed to create')).not.toBeInTheDocument()
  })

  it('shows generic error message on failure with non-Error', async () => {
    mockMutate.mockRejectedValueOnce('Something went wrong')
    render(<AddCategoryPage />)

    const submitButton = screen.getByTestId('submit-button')
    submitButton.click()

    expect(await screen.findByText("Couldn't save right now — try again.")).toBeInTheDocument()
    expect(screen.queryByText('Failed to create category')).not.toBeInTheDocument()
  })

  it('renders loading state for create mutation', () => {
    mockUseCreateCategory.mockReturnValue({
      mutate: mockMutate,
      isLoading: true,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<AddCategoryPage />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('wraps form in a card and Cancel returns to the list without mutating', () => {
    render(<AddCategoryPage />)

    const formRoot = screen.getByTestId('mock-category-form')
    expect(formRoot.parentElement).toHaveClass('rounded-xl', 'bg-white', 'p-6', 'shadow-xl')

    screen.getByRole('button', { name: 'Cancel' }).click()

    expect(mockPush).toHaveBeenCalledWith('/settings/categories')
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
