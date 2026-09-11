import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LocationsPage from '@/app/(app)/settings/locations/page'

const { mockPush, mockGetLocationInUse } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockGetLocationInUse: vi.fn(),
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

vi.mock('@/hooks/use-locations', () => ({
  useLocations: vi.fn(),
}))

vi.mock('@/hooks/use-location-mutations', () => ({
  useDeleteLocation: vi.fn(),
}))

vi.mock('@/lib/appwrite/locations', () => ({
  getLocationInUse: mockGetLocationInUse,
}))

import { useDeleteLocation } from '@/hooks/use-location-mutations'
import { useLocations } from '@/hooks/use-locations'

const mockUseLocations = vi.mocked(useLocations)
const mockUseDeleteLocation = vi.mocked(useDeleteLocation)

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

const mockLocations = [
  {
    id: '1',
    name: 'Fridge',
    description: 'Main refrigerator',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '2',
    name: 'Freezer',
    description: 'Freezer section',
    sortOrder: 2,
    createdAt: '',
    updatedAt: '',
  },
]

function setupLoaded(mutate = vi.fn()) {
  mockUseLocations.mockReturnValue({
    locations: mockLocations,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseDeleteLocation.mockReturnValue({
    mutate,
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  })
  return mutate
}

describe('LocationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLocationInUse.mockResolvedValue({ itemCount: 0, templateCount: 0 })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders page title', () => {
    setupLoaded()
    render(<LocationsPage />)

    expect(screen.getByText('Locations')).toBeInTheDocument()
  })

  it('renders Back to settings', () => {
    setupLoaded()
    render(<LocationsPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/settings')
  })

  it('renders add button', () => {
    setupLoaded()
    render(<LocationsPage />)

    expect(screen.getByText('Add')).toBeInTheDocument()
  })

  it('renders locations list when loaded', () => {
    setupLoaded()
    render(<LocationsPage />)

    expect(screen.getByText('Fridge')).toBeInTheDocument()
    expect(screen.getByText('Freezer')).toBeInTheDocument()
  })

  it('renders loading state', () => {
    mockUseLocations.mockReturnValue({
      locations: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })
    mockUseDeleteLocation.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<LocationsPage />)

    const shimmers = document.querySelectorAll('.animate-shimmer')
    expect(shimmers.length).toBeGreaterThan(0)
    expect(shimmers[0].parentElement?.parentElement).toHaveClass('space-y-4')
    expect(shimmers[0].parentElement?.parentElement).not.toHaveClass('space-y-2')
  })

  it('renders error state with retry button', () => {
    mockUseLocations.mockReturnValue({
      locations: [],
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    })
    mockUseDeleteLocation.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<LocationsPage />)

    expect(screen.getByText(/something went wrong loading locations/i)).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/settings')
  })

  it('calls refetch when retry button is clicked', () => {
    const mockRefetch = vi.fn()
    mockUseLocations.mockReturnValue({
      locations: [],
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: mockRefetch,
    })
    mockUseDeleteLocation.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<LocationsPage />)

    screen.getByText('Try again').click()

    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('renders add link with correct href', () => {
    setupLoaded()
    render(<LocationsPage />)

    const addLink = screen.getByRole('link', { name: /add/i })
    expect(addLink).toHaveAttribute('href', '/settings/locations/add')
  })

  it('renders add button even when error is shown', () => {
    mockUseLocations.mockReturnValue({
      locations: [],
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    })
    mockUseDeleteLocation.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<LocationsPage />)

    expect(screen.getByText('Add')).toBeInTheDocument()
  })

  it('navigates with router.push when edit is clicked', () => {
    setupLoaded()
    render(<LocationsPage />)

    screen.getByRole('button', { name: /edit fridge/i }).click()

    expect(mockPush).toHaveBeenCalledWith('/settings/locations/1')
  })

  it('confirms then deletes an unused location', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn().mockResolvedValue(undefined)
    setupLoaded(mutate)
    render(<LocationsPage />)

    await user.click(screen.getByRole('button', { name: /delete fridge/i }))

    expect(mockGetLocationInUse).toHaveBeenCalledWith('1')
    expect(await screen.findByText(/cannot be undone/i)).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mutate).toHaveBeenCalledWith('1')
  })

  it.each([
    {
      usage: { itemCount: 1, templateCount: 0 },
      copy: "Can't delete Fridge — 1 item still live there. Move them first.",
    },
    {
      usage: { itemCount: 0, templateCount: 2 },
      copy: "Can't delete Fridge — 2 templates still use it as the usual place.",
    },
    {
      usage: { itemCount: 2, templateCount: 1 },
      copy: "Can't delete Fridge — 2 items still live there and 1 template still use it as the usual place. Move them first.",
    },
  ])('pins in-use location copy: $copy', async ({ usage, copy }) => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    mockGetLocationInUse.mockResolvedValue(usage)
    setupLoaded(mutate)
    render(<LocationsPage />)

    await user.click(screen.getByRole('button', { name: /delete fridge/i }))

    expect(await screen.findByText(copy)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('in-use OK only closes and does not delete', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    mockGetLocationInUse.mockResolvedValue({ itemCount: 2, templateCount: 0 })
    setupLoaded(mutate)
    render(<LocationsPage />)

    await user.click(screen.getByRole('button', { name: /delete fridge/i }))
    expect(
      await screen.findByText("Can't delete Fridge — 2 items still live there. Move them first."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'OK' }))

    expect(mutate).not.toHaveBeenCalled()
    expect(
      screen.queryByText("Can't delete Fridge — 2 items still live there. Move them first."),
    ).not.toBeInTheDocument()
  })

  it('shows an error when the in-use check fails and does not reject unhandled', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    const unhandled = trackUnhandledRejections()
    mockGetLocationInUse.mockRejectedValue(new Error('In-use check failed'))
    setupLoaded(mutate)
    render(<LocationsPage />)

    await user.click(screen.getByRole('button', { name: /delete fridge/i }))

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
    render(<LocationsPage />)

    await user.click(screen.getByRole('button', { name: /delete fridge/i }))
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
