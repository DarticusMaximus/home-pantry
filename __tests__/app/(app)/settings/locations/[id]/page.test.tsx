import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditLocationPage from '@/app/(app)/settings/locations/[id]/page'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
  useParams: vi.fn(() => ({
    id: '1',
  })),
}))

const mockLocations = [
  {
    id: '1',
    name: 'Fridge',
    description: 'Main refrigerator',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
]

const mockMutate = vi.fn().mockResolvedValue({})

vi.mock('@/hooks/use-locations', () => ({
  useLocations: vi.fn().mockImplementation(() => ({
    locations: mockLocations,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

vi.mock('@/hooks/use-location-mutations', () => ({
  useUpdateLocation: vi.fn().mockImplementation(() => ({
    mutate: mockMutate,
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  })),
}))

import { useRouter } from 'next/navigation'
import { useUpdateLocation } from '@/hooks/use-location-mutations'
import { useLocations } from '@/hooks/use-locations'

describe('EditLocationPage', () => {
  const mockUseLocations = useLocations as ReturnType<typeof vi.fn>
  const mockUseUpdateLocation = useUpdateLocation as ReturnType<typeof vi.fn>
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)
    mockUseLocations.mockReturnValue({
      locations: mockLocations,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseUpdateLocation.mockReturnValue({
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
    render(<EditLocationPage />)

    expect(screen.getByRole('heading', { name: 'Edit Location' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/settings/locations',
    )
  })

  it('renders loading state when locations are loading', () => {
    mockUseLocations.mockReturnValue({
      locations: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(<EditLocationPage />)

    expect(screen.getByRole('heading', { name: 'Edit Location' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/settings/locations',
    )
  })

  it('renders error state when fetch fails', () => {
    mockUseLocations.mockReturnValue({
      locations: [],
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    })

    render(<EditLocationPage />)

    expect(screen.getByText(/failed to load location/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/settings/locations',
    )
  })

  it('renders not found state when location does not exist', () => {
    mockUseLocations.mockReturnValue({
      locations: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<EditLocationPage />)

    expect(screen.getByText('Location not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/settings/locations',
    )
  })

  it('renders location form', () => {
    render(<EditLocationPage />)

    const form = document.querySelector('form')
    expect(form).toBeInTheDocument()
  })

  it('wraps form in a card and Cancel returns to the list without mutating', () => {
    render(<EditLocationPage />)

    const form = document.querySelector('form')
    expect(form?.parentElement).toHaveClass('rounded-xl', 'bg-white', 'p-6', 'shadow-xl')

    screen.getByRole('button', { name: 'Cancel' }).click()

    expect(mockPush).toHaveBeenCalledWith('/settings/locations')
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
