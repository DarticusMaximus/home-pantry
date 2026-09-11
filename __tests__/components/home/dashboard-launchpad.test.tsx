import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardLaunchpad } from '@/components/home/dashboard-launchpad'
import type { Item } from '@/types/item'
import type { Location } from '@/types/location'

function localYmd(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'loc-1',
    name: 'Fridge',
    icon: 'snowflake',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: 'Milk',
    quantity: 1,
    unit: 'gal',
    locationId: 'loc-1',
    createdById: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const locations = [
  makeLocation({ id: 'loc-1', name: 'Fridge' }),
  makeLocation({ id: 'loc-2', name: 'Pantry', icon: 'box', sortOrder: 2 }),
  makeLocation({ id: 'loc-3', name: 'Garage', icon: 'warehouse', sortOrder: 3 }),
]

const items = [
  makeItem({ id: 'item-1', name: 'Milk', locationId: 'loc-1' }),
  makeItem({ id: 'item-2', name: 'Yogurt', locationId: 'loc-1' }),
  makeItem({ id: 'item-3', name: 'Beans', locationId: 'loc-2' }),
]

describe('DashboardLaunchpad', () => {
  afterEach(() => {
    cleanup()
  })

  it('counts live items per location, including empty places as 0 items', () => {
    render(
      <DashboardLaunchpad
        items={items}
        locations={locations}
        categories={[]}
        isLoading={false}
        onExpiringClick={vi.fn()}
        onLocationClick={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Fridge, 2 items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pantry, 1 item' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Garage, 0 items' })).toBeInTheDocument()
    expect(screen.getByText('2 items')).toBeInTheDocument()
    expect(screen.getByText('1 item')).toBeInTheDocument()
    expect(screen.getByText('0 items')).toBeInTheDocument()
  })

  it('does not count documents that are not in the live items list', () => {
    render(
      <DashboardLaunchpad
        items={items.filter((item) => item.locationId === 'loc-1')}
        locations={locations}
        categories={[]}
        isLoading={false}
        onExpiringClick={vi.fn()}
        onLocationClick={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Fridge, 2 items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pantry, 0 items' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pantry, 1 item' })).not.toBeInTheDocument()
  })

  it('calls onLocationClick with that location id, including empty places', () => {
    const onLocationClick = vi.fn()
    render(
      <DashboardLaunchpad
        items={items}
        locations={locations}
        categories={[]}
        isLoading={false}
        onExpiringClick={vi.fn()}
        onLocationClick={onLocationClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fridge, 2 items' }))
    expect(onLocationClick).toHaveBeenCalledWith('loc-1')

    fireEvent.click(screen.getByRole('button', { name: 'Garage, 0 items' }))
    expect(onLocationClick).toHaveBeenCalledWith('loc-3')
    expect(onLocationClick).toHaveBeenCalledTimes(2)
  })

  it('counts expired and soon live items and calls onExpiringClick', () => {
    const onExpiringClick = vi.fn()
    render(
      <DashboardLaunchpad
        items={[
          makeItem({ id: 'expired', name: 'Expired Yogurt', expirationDate: localYmd(-2) }),
          makeItem({ id: 'soon', name: 'Soon Cheese', expirationDate: localYmd(3) }),
          makeItem({ id: 'far', name: 'Far Pasta', expirationDate: localYmd(8) }),
          makeItem({ id: 'undated', name: 'Undated Rice' }),
        ]}
        locations={locations}
        categories={[]}
        isLoading={false}
        onExpiringClick={onExpiringClick}
        onLocationClick={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: '2 items expiring soon. Tap to filter.' })
    expect(button).toHaveTextContent('2 expiring')
    expect(screen.queryByText('All good')).not.toBeInTheDocument()

    fireEvent.click(button)
    expect(onExpiringClick).toHaveBeenCalledTimes(1)
  })

  it('does not count a deleted item that is not in the live list', () => {
    render(
      <DashboardLaunchpad
        items={[
          makeItem({ id: 'soon', name: 'Soon Cheese', expirationDate: localYmd(3) }),
          makeItem({ id: 'far', name: 'Far Pasta', expirationDate: localYmd(8) }),
        ]}
        locations={locations}
        categories={[]}
        isLoading={false}
        onExpiringClick={vi.fn()}
        onLocationClick={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: '1 items expiring soon. Tap to filter.' }),
    ).toHaveTextContent('1 expiring')
    expect(
      screen.queryByRole('button', { name: '2 items expiring soon. Tap to filter.' }),
    ).not.toBeInTheDocument()
  })

  it('shows All good and no expiring button when nothing is expiring', () => {
    render(
      <DashboardLaunchpad
        items={[
          makeItem({ id: 'far', name: 'Far Pasta', expirationDate: localYmd(8) }),
          makeItem({ id: 'undated', name: 'Undated Rice' }),
        ]}
        locations={locations}
        categories={[]}
        isLoading={false}
        onExpiringClick={vi.fn()}
        onLocationClick={vi.fn()}
      />,
    )

    expect(screen.getByText('All good')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /expiring soon/i })).not.toBeInTheDocument()
  })

  it('shows All good when the live list is empty', () => {
    render(
      <DashboardLaunchpad
        items={[]}
        locations={locations}
        categories={[]}
        isLoading={false}
        onExpiringClick={vi.fn()}
        onLocationClick={vi.fn()}
      />,
    )

    expect(screen.getByText('All good')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /expiring soon/i })).not.toBeInTheDocument()
  })
})
