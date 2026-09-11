import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TemplateCard } from '@/components/templates/template-card'
import type { ItemTemplate } from '@/types/template'

describe('TemplateCard', () => {
  const mockTemplate: ItemTemplate = {
    id: '1',
    name: 'Milk',
    categoryId: 'cat1',
    defaultUnit: 'L',
    defaultQuantity: 1,
    defaultExpirationDays: 7,
    notes: 'Buy organic',
    createdAt: '',
    updatedAt: '',
  }

  afterEach(() => {
    cleanup()
  })

  it('renders template name and category', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        categoryName="Dairy"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('Dairy')).toBeInTheDocument()
  })

  it('renders unit and quantity', () => {
    render(<TemplateCard template={mockTemplate} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('1 L')).toBeInTheDocument()
    expect(screen.getByText(/Expires in 7 days/i)).toBeInTheDocument()
    expect(screen.queryByText(/Partial tracking/i)).not.toBeInTheDocument()
  })

  it('calls onEdit when edit clicked', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<TemplateCard template={mockTemplate} onEdit={onEdit} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Edit Milk/i }))
    expect(onEdit).toHaveBeenCalledWith(mockTemplate)
  })

  it('calls onDelete when delete clicked', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<TemplateCard template={mockTemplate} onEdit={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: /Delete Milk/i }))
    expect(onDelete).toHaveBeenCalledWith(mockTemplate.id)
  })

  it('links Add to pantry to the prefilled add form', () => {
    render(<TemplateCard template={mockTemplate} onEdit={vi.fn()} onDelete={vi.fn()} />)

    const addLink = screen.getByRole('link', { name: 'Add Milk to pantry' })
    expect(addLink).toHaveAttribute('href', '/items/add?templateId=1')
    expect(addLink).toHaveTextContent('Add to pantry')
    expect(addLink).toHaveClass('min-h-[44px]')
  })

  it('keeps Edit and Delete at 44px', () => {
    render(<TemplateCard template={mockTemplate} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Edit Milk/i })).toHaveClass('h-11', 'w-11')
    expect(screen.getByRole('button', { name: /Delete Milk/i })).toHaveClass('h-11', 'w-11')
  })
})
