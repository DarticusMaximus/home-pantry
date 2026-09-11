import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocationForm } from '@/components/settings/location-form'

describe('LocationForm', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty form in add mode', () => {
    render(<LocationForm onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/icon/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/sort order/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add location/i })).toBeInTheDocument()
  })

  it('renders form with initial data in edit mode', () => {
    const initialData = {
      id: '1',
      name: 'Fridge',
      description: 'Main fridge',
      icon: 'refrigerator',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    }

    render(<LocationForm initialData={initialData} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/name/i)).toHaveValue('Fridge')
    expect(screen.getByLabelText(/description/i)).toHaveValue('Main fridge')
    expect(screen.getByRole('button', { name: /update location/i })).toBeInTheDocument()
  })

  it('shows validation error for empty name', async () => {
    render(<LocationForm onSubmit={vi.fn()} />)

    const nameInput = screen.getByLabelText(/name/i)
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: /add location/i }))

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })
  })

  it('submits form with valid data', async () => {
    const onSubmit = vi.fn()
    render(<LocationForm onSubmit={onSubmit} />)

    const nameInput = screen.getByLabelText(/name/i)
    await user.type(nameInput, 'New Location')

    const descriptionInput = screen.getByLabelText(/description/i)
    await user.type(descriptionInput, 'A description')

    await user.click(screen.getByRole('button', { name: /add location/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Location',
          description: 'A description',
        }),
      )
    })
  })

  it('disables submit button when loading', () => {
    render(<LocationForm onSubmit={vi.fn()} isLoading={true} />)

    const button = screen.getByRole('button', { name: /saving/i })
    expect(button).toBeDisabled()
  })

  it('accepts name up to 128 characters', async () => {
    const onSubmit = vi.fn()
    render(<LocationForm onSubmit={onSubmit} />)

    const nameInput = screen.getByLabelText(/name/i)
    const longName = 'a'.repeat(128)
    await user.type(nameInput, longName)

    await user.click(screen.getByRole('button', { name: /add location/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })
  })

  it('allows optional description', async () => {
    const onSubmit = vi.fn()
    render(<LocationForm onSubmit={onSubmit} />)

    const nameInput = screen.getByLabelText(/name/i)
    await user.type(nameInput, 'Test')

    await user.click(screen.getByRole('button', { name: /add location/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test',
        }),
      )
    })
    expect(onSubmit.mock.calls[0][0].description).toBeFalsy()
  })

  it('pre-populates sort order in edit mode', () => {
    const initialData = {
      id: '1',
      name: 'Test',
      sortOrder: 5,
      createdAt: '',
      updatedAt: '',
    }

    render(<LocationForm initialData={initialData} onSubmit={vi.fn()} />)

    const sortInput = screen.getByLabelText(/sort order/i) as HTMLInputElement
    expect(sortInput.value).toBe('5')
  })

  it('does not submit a soft-delete flag', async () => {
    const onSubmit = vi.fn()
    const initialData = {
      id: '1',
      name: 'Test',
      sortOrder: 0,
      createdAt: '',
      updatedAt: '',
    }

    render(<LocationForm initialData={initialData} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /update location/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('is' + 'Active')
  })

  it('hides Cancel when onCancel is omitted', () => {
    render(<LocationForm onSubmit={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add location/i })).toBeInTheDocument()
  })

  it('calls onCancel once and does not submit when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn()
    render(<LocationForm onSubmit={onSubmit} onCancel={onCancel} />)

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel).toHaveClass('min-h-[44px]', 'transition-colors')

    await user.type(screen.getByLabelText(/name/i), 'Fridge')
    await user.click(cancel)

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
