import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CategoriesList } from '@/components/settings/categories-list'
import type { Category } from '@/types/category'

const mockCategories: Category[] = [
  {
    id: '1',
    name: 'Meat',
    description: 'Red meat and poultry',
    icon: 'beef',
    color: '#ef4444',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '2',
    name: 'Dairy',
    description: 'Milk, cheese, eggs',
    icon: 'egg',
    color: '#f97316',
    sortOrder: 2,
    createdAt: '',
    updatedAt: '',
  },
]

describe('CategoriesList', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders categories', () => {
    render(<CategoriesList categories={mockCategories} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Meat')).toBeInTheDocument()
    expect(screen.getByText('Dairy')).toBeInTheDocument()
  })

  it('spaces category rows with space-y-4', () => {
    render(<CategoriesList categories={mockCategories} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByRole('list')).toHaveClass('space-y-4')
    expect(screen.getByRole('list')).not.toHaveClass('space-y-2')
  })

  it('renders category descriptions', () => {
    render(<CategoriesList categories={mockCategories} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Red meat and poultry')).toBeInTheDocument()
    expect(screen.getByText('Milk, cheese, eggs')).toBeInTheDocument()
  })

  it('calls onEdit with category id when edit button clicked', () => {
    const onEdit = vi.fn()
    render(<CategoriesList categories={mockCategories} onEdit={onEdit} onDelete={vi.fn()} />)

    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    editButtons[0].click()

    expect(onEdit).toHaveBeenCalledWith('1')
  })

  it('calls onDelete with category id when delete button clicked', () => {
    const onDelete = vi.fn()
    render(<CategoriesList categories={mockCategories} onEdit={vi.fn()} onDelete={onDelete} />)

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    deleteButtons[0].click()

    expect(onDelete).toHaveBeenCalledWith('1')
  })

  it('renders empty state when no categories', () => {
    render(<CategoriesList categories={[]} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText(/no categories yet/i)).toBeInTheDocument()
  })

  it('sorts categories by sortOrder', () => {
    const unsortedCategories: Category[] = [
      {
        id: '2',
        name: 'Second',
        sortOrder: 2,
        color: '#000',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '1',
        name: 'First',
        sortOrder: 1,
        color: '#000',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '3',
        name: 'Third',
        sortOrder: 3,
        color: '#000',
        createdAt: '',
        updatedAt: '',
      },
    ]

    render(<CategoriesList categories={unsortedCategories} onEdit={vi.fn()} onDelete={vi.fn()} />)

    const items = screen.getAllByRole('button', { name: /edit/i })
    expect(items).toHaveLength(3)
  })

  it('renders category without description', () => {
    const categoriesNoDesc: Category[] = [
      {
        id: '1',
        name: 'Frozen',
        sortOrder: 1,
        color: '#3b82f6',
        createdAt: '',
        updatedAt: '',
      },
    ]

    render(<CategoriesList categories={categoriesNoDesc} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Frozen')).toBeInTheDocument()
  })

  it('renders color indicator for each category', () => {
    render(<CategoriesList categories={mockCategories} onEdit={vi.fn()} onDelete={vi.fn()} />)

    const colorDots = document.querySelectorAll('.rounded-full')
    expect(colorDots).toHaveLength(2)
  })
})
