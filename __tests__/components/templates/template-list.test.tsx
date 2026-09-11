import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TemplateList } from '@/components/templates/template-list'
import type { ItemTemplate } from '@/types/template'

describe('TemplateList', () => {
  const mockTemplates: ItemTemplate[] = [
    {
      id: '1',
      name: 'Milk',
      categoryId: 'cat1',
      defaultUnit: 'L',
      defaultQuantity: 1,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '2',
      name: 'Bread',
      categoryId: 'cat2',
      defaultUnit: 'loaf',
      defaultQuantity: 1,
      createdAt: '',
      updatedAt: '',
    },
  ]

  const mockCategories = [
    { id: 'cat1', name: 'Dairy', sortOrder: 1, createdAt: '', updatedAt: '' },
    { id: 'cat2', name: 'Bakery', sortOrder: 2, createdAt: '', updatedAt: '' },
  ]

  afterEach(() => {
    cleanup()
  })

  it('renders template cards', () => {
    render(
      <TemplateList
        templates={mockTemplates}
        categories={mockCategories}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('Bread')).toBeInTheDocument()
    expect(screen.getByText('Dairy')).toBeInTheDocument()
    expect(screen.getByText('Bakery')).toBeInTheDocument()
  })

  it('shows empty state when no templates', () => {
    render(
      <TemplateList
        templates={[]}
        categories={mockCategories}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText(/No templates yet/i)).toBeInTheDocument()
  })

  it('shows loading state', () => {
    const { container } = render(
      <TemplateList
        templates={[]}
        categories={mockCategories}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        isLoading={true}
      />,
    )

    expect(container.querySelector('.animate-shimmer')).toBeInTheDocument()
  })
})
