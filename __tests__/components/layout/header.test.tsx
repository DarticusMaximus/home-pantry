import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from '@/components/layout/header'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/contexts/auth-context'

const mockUseAuth = vi.mocked(useAuth)

describe('Header', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('when user is authenticated', () => {
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

    it('renders app title', () => {
      render(<Header />)

      expect(screen.getByText('Home Pantry')).toBeInTheDocument()
    })

    it('renders user name on desktop', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      render(<Header />)

      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    it('has mobile-responsive class for user name', () => {
      render(<Header />)

      const userNameSpan = screen.getByText('Test User')
      expect(userNameSpan).toHaveClass('hidden', 'sm:block')
    })

    it('renders logout button', () => {
      render(<Header />)

      const logoutButton = screen.getByRole('button', { name: /log out/i })
      expect(logoutButton).toBeInTheDocument()
    })

    it('does not render a Back link', () => {
      render(<Header />)

      expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument()
    })

    it('applies pt-safe on the header', () => {
      const { container } = render(<Header />)

      const header = container.querySelector('header')
      expect(header).toHaveClass('pt-safe')
    })

    it('keeps logout at h-10 w-10', () => {
      render(<Header />)

      const logoutButton = screen.getByRole('button', { name: /log out/i })
      expect(logoutButton).toHaveClass('h-10', 'w-10')
      expect(logoutButton).not.toHaveClass('h-11')
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

      render(<Header />)

      const logoutButton = screen.getByRole('button', { name: /log out/i })
      logoutButton.click()

      expect(mockLogout).toHaveBeenCalledTimes(1)
    })
  })

  describe('when user name is not available', () => {
    it('does not render user name', () => {
      mockUseAuth.mockReturnValue({
        user: {
          $id: 'user-123',
          email: 'test@example.com',
          name: undefined,
        } as never,
        loading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        unreachable: false,
        retrySession: vi.fn(),
      })

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      render(<Header />)

      expect(screen.queryByText('undefined')).not.toBeInTheDocument()
    })
  })
})
