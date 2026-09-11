import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CategoriesPage from '@/app/(app)/settings/categories/page'

const { mockPush, mockGetCategoryInUse } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockGetCategoryInUse: vi.fn(),
}))

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

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
  })),
}))

vi.mock('@/hooks/use-categories', () => ({
  useCategories: vi.fn(),
}))

vi.mock('@/hooks/use-category-mutations', () => ({
  useDeleteCategory: vi.fn(),
}))

vi.mock('@/lib/appwrite/categories', () => ({
  getCategoryInUse: mockGetCategoryInUse,
}))

import { useCategories } from '@/hooks/use-categories'
import { useDeleteCategory } from '@/hooks/use-category-mutations'

const mockUseCategories = vi.mocked(useCategories)
const mockUseDeleteCategory = vi.mocked(useDeleteCategory)

function trackUnhandledRejections() {
  const reasons: unknown[] = []
  const onWindow = (event: PromiseRejectionEvent) => {
    reasons.push(event.reason)
  }
  const onProcess = (reason: unknown) => {
    reasons.push(reason)
  }
  window.addEventListener('unhandledrejection', onWindow)
  process.on('unhandledRejection', onProcess)
  return {
    reasons,
    restore() {
      window.removeEventListener('unhandledrejection', onWindow)
      process.off('unhandledRejection', onProcess)
    },
  }
}

async function flushRejections() {
  await Promise.resolve()
  await Promise.resolve()
}

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
  {
    id: '2',
    name: 'Dairy',
    description: 'Milk, cheese, eggs',
    color: '#f97316',
    sortOrder: 2,
    createdAt: '',
    updatedAt: '',
  },
]

function setupLoaded(mutate = vi.fn()) {
  mockUseCategories.mockReturnValue({
    categories: mockCategories,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseDeleteCategory.mockReturnValue({
    mutate,
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  })
  return mutate
}

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategoryInUse.mockResolvedValue({ itemCount: 0, templateCount: 0 })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders page title', () => {
    setupLoaded()
    render(<CategoriesPage />)

    expect(screen.getByText('Categories')).toBeInTheDocument()
  })

  it('renders Back to settings', () => {
    setupLoaded()
    render(<CategoriesPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/settings')
  })

  it('renders add button', () => {
    setupLoaded()
    render(<CategoriesPage />)

    expect(screen.getByText('Add')).toBeInTheDocument()
  })

  it('renders categories list when loaded', () => {
    setupLoaded()
    render(<CategoriesPage />)

    expect(screen.getByText('Meat')).toBeInTheDocument()
    expect(screen.getByText('Dairy')).toBeInTheDocument()
  })

  it('renders loading state', () => {
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })
    mockUseDeleteCategory.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<CategoriesPage />)

    const shimmers = document.querySelectorAll('.animate-shimmer')
    expect(shimmers.length).toBeGreaterThan(0)
    expect(shimmers[0].parentElement?.parentElement).toHaveClass('space-y-4')
    expect(shimmers[0].parentElement?.parentElement).not.toHaveClass('space-y-2')
  })

  it('renders error state with retry button', () => {
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    })
    mockUseDeleteCategory.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<CategoriesPage />)

    expect(screen.getByText(/something went wrong loading categories/i)).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/settings')
  })

  it('calls refetch when retry button is clicked', () => {
    const mockRefetch = vi.fn()
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: mockRefetch,
    })
    mockUseDeleteCategory.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<CategoriesPage />)

    screen.getByText('Try again').click()

    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('renders add link with correct href', () => {
    setupLoaded()
    render(<CategoriesPage />)

    const addLink = screen.getByRole('link', { name: /add/i })
    expect(addLink).toHaveAttribute('href', '/settings/categories/add')
  })

  it('renders categories list even when error is shown with add button', () => {
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    })
    mockUseDeleteCategory.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<CategoriesPage />)

    expect(screen.getByText('Add')).toBeInTheDocument()
  })

  it('navigates with router.push when edit is clicked', () => {
    setupLoaded()
    render(<CategoriesPage />)

    screen.getByRole('button', { name: /edit meat/i }).click()

    expect(mockPush).toHaveBeenCalledWith('/settings/categories/1')
  })

  it('confirms then deletes an unused category', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn().mockResolvedValue(undefined)
    setupLoaded(mutate)
    render(<CategoriesPage />)

    await user.click(screen.getByRole('button', { name: /delete meat/i }))

    expect(mockGetCategoryInUse).toHaveBeenCalledWith('1')
    expect(await screen.findByText(/cannot be undone/i)).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mutate).toHaveBeenCalledWith('1')
  })

  it.each([
    {
      usage: { itemCount: 2, templateCount: 0 },
      copy: "Can't delete Meat — 2 items still use this category.",
    },
    {
      usage: { itemCount: 0, templateCount: 1 },
      copy: "Can't delete Meat — 1 template still use this category.",
    },
    {
      usage: { itemCount: 1, templateCount: 2 },
      copy: "Can't delete Meat — 1 item and 2 templates still use this category.",
    },
  ])('pins in-use category copy: $copy', async ({ usage, copy }) => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    mockGetCategoryInUse.mockResolvedValue(usage)
    setupLoaded(mutate)
    render(<CategoriesPage />)

    await user.click(screen.getByRole('button', { name: /delete meat/i }))

    expect(await screen.findByText(copy)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('in-use OK only closes and does not delete', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    mockGetCategoryInUse.mockResolvedValue({ itemCount: 2, templateCount: 0 })
    setupLoaded(mutate)
    render(<CategoriesPage />)

    await user.click(screen.getByRole('button', { name: /delete meat/i }))
    expect(
      await screen.findByText("Can't delete Meat — 2 items still use this category."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'OK' }))

    expect(mutate).not.toHaveBeenCalled()
    expect(
      screen.queryByText("Can't delete Meat — 2 items still use this category."),
    ).not.toBeInTheDocument()
  })

  it('shows an error when the in-use check fails and does not reject unhandled', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    const unhandled = trackUnhandledRejections()
    mockGetCategoryInUse.mockRejectedValue(new Error('In-use check failed'))
    setupLoaded(mutate)
    render(<CategoriesPage />)

    await user.click(screen.getByRole('button', { name: /delete meat/i }))

    expect(await screen.findByText('In-use check failed')).toBeInTheDocument()
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
    await flushRejections()
    expect(unhandled.reasons).toEqual([])
    unhandled.restore()
  })

  it('shows an error when delete mutate fails after confirm', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn().mockRejectedValue(new Error('Delete failed'))
    const unhandled = trackUnhandledRejections()
    setupLoaded(mutate)
    render(<CategoriesPage />)

    await user.click(screen.getByRole('button', { name: /delete meat/i }))
    expect(await screen.findByText(/cannot be undone/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText("Couldn't delete right now — try again.")).toBeInTheDocument()
    expect(screen.queryByText('Delete failed')).not.toBeInTheDocument()
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument()
    await flushRejections()
    expect(unhandled.reasons).toEqual([])
    unhandled.restore()
  })
})
