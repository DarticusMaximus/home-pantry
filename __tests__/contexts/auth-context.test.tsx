import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { PantryUnreachableError } from '@/lib/pantry-reachability'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

const mockUser = {
  $id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
} as Models.User<Models.Preferences>

vi.mock('@/lib/appwrite/auth', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}))

import {
  getCurrentUser,
  login as loginWithEmailPassword,
  logout as logoutCurrentSession,
  register as registerAccount,
} from '@/lib/appwrite/auth'

const mockedGetCurrentUser = vi.mocked(getCurrentUser)
const mockedLogin = vi.mocked(loginWithEmailPassword)
const mockedLogout = vi.mocked(logoutCurrentSession)
const mockedRegister = vi.mocked(registerAccount)

function TestComponent() {
  const { user, loading, unreachable, login, logout, register, retrySession } = useAuth()
  return (
    <div>
      <span data-testid="loading">{loading.toString()}</span>
      <span data-testid="unreachable">{unreachable.toString()}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <button
        type="button"
        onClick={() => login('test@example.com', 'password123')}
        data-testid="login-btn"
      >
        Login
      </button>
      <button
        type="button"
        onClick={() => register('test@example.com', 'password123', 'Test User')}
        data-testid="register-btn"
      >
        Register
      </button>
      <button type="button" onClick={logout} data-testid="logout-btn">
        Logout
      </button>
      <button type="button" onClick={retrySession} data-testid="retry-btn">
        Retry
      </button>
    </div>
  )
}

function renderAuthContext() {
  return render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>,
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetCurrentUser.mockResolvedValue(null)
  })

  afterEach(() => {
    cleanup()
  })

  describe('initial state', () => {
    it('starts with loading true', async () => {
      mockedGetCurrentUser.mockImplementation(() => new Promise(() => {}))

      renderAuthContext()

      expect(screen.getByTestId('loading').textContent).toBe('true')
      expect(screen.getByTestId('unreachable').textContent).toBe('false')
    })

    it('sets loading to false after checking session', async () => {
      mockedGetCurrentUser.mockResolvedValueOnce(null)

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })
      expect(screen.getByTestId('unreachable').textContent).toBe('false')
      expect(screen.getByTestId('user').textContent).toBe('null')
    })

    it('treats immediate PantryUnreachableError as unreachable, not signed out', async () => {
      mockedGetCurrentUser.mockRejectedValueOnce(new PantryUnreachableError())

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })
      expect(screen.getByTestId('unreachable').textContent).toBe('true')
      expect(screen.getByTestId('user').textContent).toBe('null')
    })

    it('retrySession after unreachable settles to a signed-in user', async () => {
      const user = userEvent.setup()
      mockedGetCurrentUser.mockRejectedValueOnce(new PantryUnreachableError())

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('unreachable').textContent).toBe('true')
        expect(screen.getByTestId('loading').textContent).toBe('false')
        expect(screen.getByTestId('user').textContent).toBe('null')
      })

      mockedGetCurrentUser.mockResolvedValueOnce(mockUser)
      await user.click(screen.getByTestId('retry-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
        expect(screen.getByTestId('unreachable').textContent).toBe('false')
        expect(screen.getByTestId('user').textContent).toBe('test@example.com')
      })
    })

    it('retrySession after unreachable settles to signed-out, not the named line', async () => {
      const user = userEvent.setup()
      mockedGetCurrentUser.mockRejectedValueOnce(new PantryUnreachableError())

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('unreachable').textContent).toBe('true')
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })

      mockedGetCurrentUser.mockResolvedValueOnce(null)
      await user.click(screen.getByTestId('retry-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
        expect(screen.getByTestId('unreachable').textContent).toBe('false')
        expect(screen.getByTestId('user').textContent).toBe('null')
      })
    })
  })

  describe('login', () => {
    it('logs in user and redirects to home', async () => {
      const user = userEvent.setup()
      mockedGetCurrentUser.mockResolvedValueOnce(null)
      mockedLogin.mockResolvedValueOnce(mockUser)

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })

      await user.click(screen.getByTestId('login-btn'))

      await waitFor(() => {
        expect(mockedLogin).toHaveBeenCalledWith('test@example.com', 'password123')
        expect(screen.getByTestId('user').textContent).toBe('test@example.com')
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })
  })

  describe('register', () => {
    it('creates account and logs in user', async () => {
      const user = userEvent.setup()
      mockedGetCurrentUser.mockResolvedValueOnce(null)
      mockedRegister.mockResolvedValueOnce(mockUser)

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })

      await user.click(screen.getByTestId('register-btn'))

      await waitFor(() => {
        expect(mockedRegister).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User')
        expect(screen.getByTestId('user').textContent).toBe('test@example.com')
      })
    })
  })

  describe('logout', () => {
    it('logs out user and redirects to login page', async () => {
      const user = userEvent.setup()
      mockedGetCurrentUser.mockResolvedValueOnce(mockUser)
      mockedLogout.mockResolvedValueOnce()

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com')
      })

      await user.click(screen.getByTestId('logout-btn'))

      await waitFor(() => {
        expect(mockedLogout).toHaveBeenCalled()
        expect(screen.getByTestId('user').textContent).toBe('null')
        expect(mockPush).toHaveBeenCalledWith('/login')
      })
    })

    it('signs out and redirects to login when logout rejects', async () => {
      const user = userEvent.setup()
      mockedGetCurrentUser.mockResolvedValueOnce(mockUser)
      const authError = Object.assign(new Error('Authentication failed'), { name: 'AuthError' })
      mockedLogout.mockRejectedValueOnce(authError)

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com')
      })

      await user.click(screen.getByTestId('logout-btn'))

      await waitFor(() => {
        expect(mockedLogout).toHaveBeenCalled()
        expect(screen.getByTestId('user').textContent).toBe('null')
        expect(mockPush).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('session revalidation', () => {
    it('revalidates session on window focus', async () => {
      mockedGetCurrentUser.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(null)

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com')
      })

      window.dispatchEvent(new Event('focus'))

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('null')
      })
      expect(screen.getByTestId('unreachable').textContent).toBe('false')
    })

    it('keeps a signed-in user when focus revalidate is unreachable', async () => {
      mockedGetCurrentUser.mockResolvedValueOnce(mockUser)

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com')
      })
      expect(screen.getByTestId('unreachable').textContent).toBe('false')

      mockedGetCurrentUser.mockRejectedValueOnce(new PantryUnreachableError())
      window.dispatchEvent(new Event('focus'))

      await waitFor(() => {
        expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2)
      })
      expect(screen.getByTestId('user').textContent).toBe('test@example.com')
      expect(screen.getByTestId('unreachable').textContent).toBe('false')
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    it('clears the user when focus revalidate resolves null', async () => {
      mockedGetCurrentUser.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(null)

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com')
      })

      window.dispatchEvent(new Event('focus'))

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('null')
      })
      expect(screen.getByTestId('unreachable').textContent).toBe('false')
    })

    it('revalidates session when document becomes visible', async () => {
      mockedGetCurrentUser.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(null)

      renderAuthContext()

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com')
      })

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      })

      document.dispatchEvent(new Event('visibilitychange'))

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('null')
      })
    })
  })

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      function ComponentOutsideProvider() {
        useAuth()
        return null
      }

      expect(() => render(<ComponentOutsideProvider />)).toThrow(
        'useAuth must be used within AuthProvider',
      )

      consoleError.mockRestore()
    })
  })
})
