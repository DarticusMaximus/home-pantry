import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthGuard } from '@/components/auth/auth-guard'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/contexts/auth-context'

const mockUseAuth = vi.mocked(useAuth)

function renderAuthGuard(children: React.ReactNode = <div>Protected Content</div>) {
  return render(<AuthGuard>{children}</AuthGuard>)
}

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('loading state', () => {
    it('shows loading spinner while checking auth', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        unreachable: false,
        retrySession: vi.fn(),
      })

      const { container } = renderAuthGuard()

      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('unreachable state', () => {
    it('shows named line, does not redirect, and hides children', async () => {
      const retrySession = vi.fn()
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        unreachable: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        retrySession,
      })

      renderAuthGuard()

      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the pantry.")
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      expect(screen.queryByText('Checking session...')).not.toBeInTheDocument()

      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalled()
      })
      expect(mockPush).not.toHaveBeenCalledWith('/login')

      screen.getByRole('button', { name: 'Try again' }).click()
      expect(retrySession).toHaveBeenCalledTimes(1)
    })
  })

  describe('unauthenticated state', () => {
    it('redirects to login when not authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        unreachable: false,
        retrySession: vi.fn(),
      })

      renderAuthGuard()

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login')
      })
    })

    it('renders nothing when unauthenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        unreachable: false,
        retrySession: vi.fn(),
      })

      const { container } = renderAuthGuard()

      expect(container.innerHTML).toBe('')
    })
  })

  describe('authenticated state', () => {
    it('renders children when authenticated', () => {
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

      renderAuthGuard()

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('does not redirect when authenticated', () => {
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

      renderAuthGuard()

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('renders multiple children when authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: {
          $id: 'user-123',
          email: 'test@example.com',
        } as never,
        loading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        unreachable: false,
        retrySession: vi.fn(),
      })

      renderAuthGuard(
        <div>
          <h1>Title</h1>
          <p>Description</p>
        </div>,
      )

      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })

  describe('state transitions', () => {
    it('shows spinner during loading then content after auth', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        unreachable: false,
        retrySession: vi.fn(),
      })

      const { container, rerender } = render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>,
      )

      let spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()

      mockUseAuth.mockReturnValue({
        user: {
          $id: 'user-123',
          email: 'test@example.com',
        } as never,
        loading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        unreachable: false,
        retrySession: vi.fn(),
      })

      rerender(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>,
      )

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
      spinner = container.querySelector('.animate-spin')
      expect(spinner).not.toBeInTheDocument()
    })
  })
})
