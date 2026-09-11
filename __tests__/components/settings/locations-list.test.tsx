import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocationsList } from '@/components/settings/locations-list'
import type { Location } from '@/types/location'

const mockLocations: Location[] = [
  {
    id: '1',
    name: 'Fridge',
    description: 'Main refrigerator',
    icon: 'refrigerator',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '2',
    name: 'Freezer',
    description: 'Chest freezer',
    icon: 'snowflake',
    sortOrder: 2,
    createdAt: '',
    updatedAt: '',
  },
]

describe('LocationsList', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders locations', () => {
    render(<LocationsList locations={mockLocations} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Fridge')).toBeInTheDocument()
    expect(screen.getByText('Freezer')).toBeInTheDocument()
  })

  it('spaces location rows with space-y-4', () => {
    render(<LocationsList locations={mockLocations} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByRole('list')).toHaveClass('space-y-4')
    expect(screen.getByRole('list')).not.toHaveClass('space-y-2')
  })

  it('renders location descriptions', () => {
    render(<LocationsList locations={mockLocations} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Main refrigerator')).toBeInTheDocument()
    expect(screen.getByText('Chest freezer')).toBeInTheDocument()
  })

  it('calls onEdit with location id when edit button clicked', () => {
    const onEdit = vi.fn()
    render(<LocationsList locations={mockLocations} onEdit={onEdit} onDelete={vi.fn()} />)

    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    editButtons[0].click()

    expect(onEdit).toHaveBeenCalledWith('1')
  })

  it('calls onDelete with location id when delete button clicked', () => {
    const onDelete = vi.fn()
    render(<LocationsList locations={mockLocations} onEdit={vi.fn()} onDelete={onDelete} />)

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    deleteButtons[0].click()

    expect(onDelete).toHaveBeenCalledWith('1')
  })

  it('renders empty state when no locations', () => {
    render(<LocationsList locations={[]} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText(/no locations yet/i)).toBeInTheDocument()
  })

  it('sorts locations by sortOrder', () => {
    const unsortedLocations: Location[] = [
      {
        id: '2',
        name: 'Second',
        sortOrder: 2,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '1',
        name: 'First',
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '3',
        name: 'Third',
        sortOrder: 3,
        createdAt: '',
        updatedAt: '',
      },
    ]

    render(<LocationsList locations={unsortedLocations} onEdit={vi.fn()} onDelete={vi.fn()} />)

    const items = screen.getAllByRole('button', { name: /edit/i })
    expect(items).toHaveLength(3)
  })

  it('renders location without description', () => {
    const locationsNoDesc: Location[] = [
      {
        id: '1',
        name: 'Pantry',
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      },
    ]

    render(<LocationsList locations={locationsNoDesc} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Pantry')).toBeInTheDocument()
  })
})
