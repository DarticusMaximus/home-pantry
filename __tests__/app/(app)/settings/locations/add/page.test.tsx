import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddLocationPage from '@/app/(app)/settings/locations/add/page'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}))

const mockMutate = vi.fn().mockResolvedValue({})

vi.mock('@/hooks/use-locations', () => ({
  useLocations: vi.fn().mockImplementation(() => ({
    locations: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

vi.mock('@/hooks/use-location-mutations', () => ({
  useCreateLocation: vi.fn().mockImplementation(() => ({
    mutate: mockMutate,
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  })),
}))

import { useCreateLocation } from '@/hooks/use-location-mutations'
import { useLocations } from '@/hooks/use-locations'

vi.mock('@/components/settings/location-form', () => ({
  LocationForm: vi.fn(
    ({
      onSubmit,
      isLoading,
      onCancel,
    }: {
      onSubmit: (data: any) => void
      isLoading: boolean
      onCancel?: () => void
    }) => (
      <div data-testid="mock-location-form">
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

describe('AddLocationPage', () => {
  const mockUseLocations = useLocations as ReturnType<typeof vi.fn>
  const mockUseCreateLocation = useCreateLocation as ReturnType<typeof vi.fn>
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)
    mockUseLocations.mockReturnValue({
      locations: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseCreateLocation.mockReturnValue({
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
    render(<AddLocationPage />)

    expect(screen.getByRole('heading', { name: 'Add Location' })).toBeInTheDocument()
  })

  it('renders Back to locations', () => {
    render(<AddLocationPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/settings/locations',
    )
  })

  it('submits form and redirects on success', async () => {
    mockMutate.mockResolvedValueOnce({})
    render(<AddLocationPage />)

    const submitButton = screen.getByTestId('submit-button')
    submitButton.click()

    expect(mockMutate).toHaveBeenCalledWith({ name: 'Test' })
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/settings/locations')
    })
  })

  it('shows error message on failure', async () => {
    mockMutate.mockRejectedValueOnce(new Error('Failed to create'))
    render(<AddLocationPage />)

    const submitButton = screen.getByTestId('submit-button')
    submitButton.click()

    expect(mockMutate).toHaveBeenCalledWith({ name: 'Test' })
    expect(await screen.findByText("Couldn't save right now — try again.")).toBeInTheDocument()
    expect(screen.queryByText('Failed to create')).not.toBeInTheDocument()
  })

  it('shows generic error message on failure with non-Error', async () => {
    mockMutate.mockRejectedValueOnce('Something went wrong')
    render(<AddLocationPage />)

    const submitButton = screen.getByTestId('submit-button')
    submitButton.click()

    expect(await screen.findByText("Couldn't save right now — try again.")).toBeInTheDocument()
    expect(screen.queryByText('Failed to create location')).not.toBeInTheDocument()
  })

  it('renders loading state for create mutation', () => {
    mockUseCreateLocation.mockReturnValue({
      mutate: mockMutate,
      isLoading: true,
      error: null,
      isSuccess: false,
      reset: vi.fn(),
    })

    render(<AddLocationPage />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('wraps form in a card and Cancel returns to the list without mutating', () => {
    render(<AddLocationPage />)

    const formRoot = screen.getByTestId('mock-location-form')
    expect(formRoot.parentElement).toHaveClass('rounded-xl', 'bg-white', 'p-6', 'shadow-xl')

    screen.getByRole('button', { name: 'Cancel' }).click()

    expect(mockPush).toHaveBeenCalledWith('/settings/locations')
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
