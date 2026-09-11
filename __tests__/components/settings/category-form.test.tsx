import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryForm } from '@/components/settings/category-form'

describe('CategoryForm', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty form in add mode', () => {
    render(<CategoryForm onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/icon/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Color')).toBeInTheDocument()
    expect(screen.getByLabelText(/sort order/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add category/i })).toBeInTheDocument()
  })

  it('renders form with initial data in edit mode', () => {
    const initialData = {
      id: '1',
      name: 'Meat',
      description: 'Red meat',
      icon: 'beef',
      color: '#ef4444',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    }

    render(<CategoryForm initialData={initialData} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/name/i)).toHaveValue('Meat')
    expect(screen.getByLabelText(/description/i)).toHaveValue('Red meat')
    expect(screen.getByRole('button', { name: /update category/i })).toBeInTheDocument()
  })

  it('shows validation error for empty name', async () => {
    render(<CategoryForm onSubmit={vi.fn()} />)

    const nameInput = screen.getByLabelText(/name/i)
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: /add category/i }))

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })
  })

  it('submits form without color validation error', async () => {
    const onSubmit = vi.fn()
    render(<CategoryForm onSubmit={onSubmit} />)

    const nameInput = screen.getByLabelText(/name/i)
    await user.type(nameInput, 'Test')

    const submitButton = screen.getByRole('button', { name: /add category/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })
  })

  it('submits form with valid data', async () => {
    const onSubmit = vi.fn()
    render(<CategoryForm onSubmit={onSubmit} />)

    const nameInput = screen.getByLabelText(/name/i)
    await user.type(nameInput, 'New Category')

    const descriptionInput = screen.getByLabelText(/description/i)
    await user.type(descriptionInput, 'A description')

    await user.click(screen.getByRole('button', { name: /add category/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Category',
          description: 'A description',
        }),
      )
    })
  })

  it('disables submit button when loading', () => {
    render(<CategoryForm onSubmit={vi.fn()} isLoading={true} />)

    const button = screen.getByRole('button', { name: /saving/i })
    expect(button).toBeDisabled()
  })

  it('accepts valid hex color format', async () => {
    const onSubmit = vi.fn()
    render(<CategoryForm onSubmit={onSubmit} />)

    const nameInput = screen.getByLabelText(/name/i)
    await user.type(nameInput, 'Test')

    const colorButtons = screen.getAllByRole('button', {
      name: /Select color/i,
    })
    await user.click(colorButtons[0])

    await user.click(screen.getByRole('button', { name: /add category/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })
    expect(onSubmit.mock.calls[0][0].color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('allows optional description', async () => {
    const onSubmit = vi.fn()
    render(<CategoryForm onSubmit={onSubmit} />)

    const nameInput = screen.getByLabelText(/name/i)
    await user.type(nameInput, 'Test')

    await user.click(screen.getByRole('button', { name: /add category/i }))

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
      color: '#6b7280',
      createdAt: '',
      updatedAt: '',
    }

    render(<CategoryForm initialData={initialData} onSubmit={vi.fn()} />)

    const sortInput = screen.getByLabelText(/sort order/i) as HTMLInputElement
    expect(sortInput.value).toBe('5')
  })

  it('does not submit a soft-delete flag', async () => {
    const onSubmit = vi.fn()
    const initialData = {
      id: '1',
      name: 'Test',
      sortOrder: 0,
      color: '#6b7280',
      createdAt: '',
      updatedAt: '',
    }

    render(<CategoryForm initialData={initialData} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /update category/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('is' + 'Active')
  })

  it('renders color picker with preset colors', () => {
    render(<CategoryForm onSubmit={vi.fn()} />)

    const colorButtons = screen.getAllByRole('button', {
      name: /select color/i,
    })
    expect(colorButtons.length).toBeGreaterThan(0)
  })

  it('shows non-color selected indicator for chosen color', async () => {
    render(<CategoryForm onSubmit={vi.fn()} />)

    const colorButtons = screen.getAllByRole('button', {
      name: /select color/i,
    })

    await user.click(colorButtons[0])

    expect(colorButtons[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders visually distinct icon options in select', () => {
    render(<CategoryForm onSubmit={vi.fn()} />)

    expect(screen.getByRole('option', { name: '🥩 Beef' })).toBeInTheDocument()
    expect(screen.getByText('O No icon')).toBeInTheDocument()
  })

  it('hides Cancel when onCancel is omitted', () => {
    render(<CategoryForm onSubmit={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add category/i })).toBeInTheDocument()
  })

  it('calls onCancel once and does not submit when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn()
    render(<CategoryForm onSubmit={onSubmit} onCancel={onCancel} />)

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel).toHaveClass('min-h-[44px]', 'transition-colors')

    await user.type(screen.getByLabelText(/name/i), 'Dairy')
    await user.click(cancel)

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
