import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from '@/app/(app)/settings/page'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    className?: string
    [key: string]: unknown
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-locations', () => ({
  useLocations: vi.fn().mockReturnValue({
    locations: [
      {
        id: '1',
        name: 'Fridge',
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-categories', () => ({
  useCategories: vi.fn().mockReturnValue({
    categories: [
      {
        id: '1',
        name: 'Meat',
        sortOrder: 1,
        color: '#ef4444',
        createdAt: '',
        updatedAt: '',
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

import { useAuth } from '@/contexts/auth-context'

const mockUseAuth = vi.mocked(useAuth)

describe('SettingsPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        $id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      } as never,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders page title', () => {
    render(<SettingsPage />)

    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('does not render a Back link', () => {
    render(<SettingsPage />)

    expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('renders all settings items', () => {
    render(<SettingsPage />)

    expect(screen.getByText('Locations')).toBeInTheDocument()
    expect(screen.getByText('Categories')).toBeInTheDocument()
    expect(screen.getByText('Item Templates')).toBeInTheDocument()
    expect(screen.getByText('Install Home Pantry')).toBeInTheDocument()
  })

  it('renders settings item descriptions', () => {
    render(<SettingsPage />)

    expect(screen.getByText('Manage storage locations')).toBeInTheDocument()
    expect(screen.getByText('Manage item categories')).toBeInTheDocument()
    expect(screen.getByText('Manage item presets')).toBeInTheDocument()
  })

  it('renders logout button', () => {
    render(<SettingsPage />)

    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })

  it('calls logout when button is clicked', async () => {
    const mockLogout = vi.fn()
    mockUseAuth.mockReturnValue({
      user: {
        $id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      } as never,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      unreachable: false,
      retrySession: vi.fn(),
    })

    render(<SettingsPage />)

    const logoutButton = screen.getByRole('button', { name: /log out/i })
    logoutButton.click()

    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('renders user email', () => {
    render(<SettingsPage />)

    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('renders settings links with correct hrefs', () => {
    render(<SettingsPage />)

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/settings/locations')
    expect(links[1]).toHaveAttribute('href', '/settings/categories')
    expect(links[2]).toHaveAttribute('href', '/settings/templates')
    expect(links[3]).toHaveAttribute('href', '/settings/install')
  })

  it('spaces settings cards with space-y-4', () => {
    render(<SettingsPage />)

    expect(screen.getAllByRole('link')[0].parentElement).toHaveClass('space-y-4')
    expect(screen.getAllByRole('link')[0].parentElement).not.toHaveClass('space-y-2')
  })
})
