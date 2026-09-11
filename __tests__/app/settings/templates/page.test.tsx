import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TemplatesPage from '@/app/(app)/settings/templates/page'
import type { ItemTemplate } from '@/types/template'

const {
  mockCreateMutate,
  mockUpdateMutateWithId,
  mockDeleteMutate,
  mockUseTemplates,
  mockUseCreateTemplate,
  mockUseUpdateTemplate,
  mockUseDeleteTemplate,
} = vi.hoisted(() => ({
  mockCreateMutate: vi.fn(),
  mockUpdateMutateWithId: vi.fn(),
  mockDeleteMutate: vi.fn(),
  mockUseTemplates: vi.fn(),
  mockUseCreateTemplate: vi.fn(),
  mockUseUpdateTemplate: vi.fn(),
  mockUseDeleteTemplate: vi.fn(),
}))

vi.mock('@/hooks/use-templates', () => ({
  useTemplates: mockUseTemplates,
}))

vi.mock('@/hooks/use-categories', () => ({
  useCategories: () => ({ categories: [] }),
}))

vi.mock('@/hooks/use-locations', () => ({
  useLocations: () => ({ locations: [] }),
}))

vi.mock('@/hooks/use-template-mutations', () => ({
  useCreateTemplate: mockUseCreateTemplate,
  useUpdateTemplate: mockUseUpdateTemplate,
  useDeleteTemplate: mockUseDeleteTemplate,
}))

const mockTemplate: ItemTemplate = {
  id: 't1',
  name: 'Milk',
  defaultUnit: 'each',
  defaultQuantity: 1,
  createdAt: '',
  updatedAt: '',
}

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

function stubMutations() {
  mockUseCreateTemplate.mockReturnValue({
    mutate: mockCreateMutate,
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  })
  mockUseUpdateTemplate.mockReturnValue({
    mutateWithId: mockUpdateMutateWithId,
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  })
  mockUseDeleteTemplate.mockReturnValue({
    mutate: mockDeleteMutate,
    isLoading: false,
    error: null,
    isSuccess: false,
    reset: vi.fn(),
  })
}

describe('TemplatesPage add card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTemplates.mockReturnValue({
      templates: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    stubMutations()
    mockCreateMutate.mockResolvedValue(undefined)
    mockUpdateMutateWithId.mockResolvedValue(undefined)
    mockDeleteMutate.mockResolvedValue(undefined)
  })

  it('opens add as a full-width card without a dialog', async () => {
    const user = userEvent.setup()
    render(<TemplatesPage />)

    await user.click(screen.getByRole('button', { name: /add template/i }))

    const heading = screen.getByRole('heading', { name: 'Add Template' })
    expect(heading).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /search templates/i })).not.toBeInTheDocument()
    expect(heading.closest('div.rounded-xl')).toHaveClass(
      'rounded-xl',
      'bg-white',
      'p-6',
      'shadow-xl',
    )
  })

  it('closes the card when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<TemplatesPage />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    expect(screen.getByRole('heading', { name: 'Add Template' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('heading', { name: 'Add Template' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add template/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /search templates/i })).toBeInTheDocument()
  })
})

describe('TemplatesPage CRUD failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTemplates.mockReturnValue({
      templates: [mockTemplate],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    stubMutations()
    mockCreateMutate.mockResolvedValue(undefined)
    mockUpdateMutateWithId.mockResolvedValue(undefined)
    mockDeleteMutate.mockResolvedValue(undefined)
  })

  it('shows an error when create mutate rejects and keeps the add form open', async () => {
    const user = userEvent.setup()
    const unhandled = trackUnhandledRejections()
    mockCreateMutate.mockRejectedValue(new Error('Create failed'))
    render(<TemplatesPage />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Bread')
    await user.click(screen.getByRole('button', { name: 'Add Template' }))

    expect(await screen.findByText("Couldn't save right now — try again.")).toBeInTheDocument()
    expect(screen.queryByText('Create failed')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Add Template' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    await flushRejections()
    expect(unhandled.reasons).toEqual([])
    unhandled.restore()
  })

  it('shows an error when update mutate rejects and keeps the edit form open', async () => {
    const user = userEvent.setup()
    const unhandled = trackUnhandledRejections()
    mockUpdateMutateWithId.mockRejectedValue(new Error('Update failed'))
    render(<TemplatesPage />)

    await user.click(screen.getByRole('button', { name: /edit milk/i }))
    await user.click(screen.getByRole('button', { name: 'Update Template' }))

    expect(await screen.findByText("Couldn't save right now — try again.")).toBeInTheDocument()
    expect(screen.queryByText('Update failed')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Edit Template' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    await flushRejections()
    expect(unhandled.reasons).toEqual([])
    unhandled.restore()
  })

  it('shows an error when delete mutate rejects and keeps the confirm dialog open', async () => {
    const user = userEvent.setup()
    const unhandled = trackUnhandledRejections()
    mockDeleteMutate.mockRejectedValue(new Error('Delete failed'))
    render(<TemplatesPage />)

    await user.click(screen.getByRole('button', { name: /delete milk/i }))
    expect(await screen.findByText(/will not affect any existing items/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText("Couldn't delete right now — try again.")).toBeInTheDocument()
    expect(screen.queryByText('Delete failed')).not.toBeInTheDocument()
    expect(screen.getByText(/will not affect any existing items/i)).toBeInTheDocument()
    await flushRejections()
    expect(unhandled.reasons).toEqual([])
    unhandled.restore()
  })
})
