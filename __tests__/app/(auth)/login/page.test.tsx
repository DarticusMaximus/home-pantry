import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '@/app/(auth)/login/page'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/contexts/auth-context'
import { CANNOT_REACH_PANTRY_COPY } from '@/lib/pantry-reachability'

const mockUseAuth = vi.mocked(useAuth)

describe('LoginPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
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
    vi.useRealTimers()
  })

  it('renders app title', () => {
    render(<LoginPage />)

    expect(screen.getByText('Home Pantry')).toBeInTheDocument()
  })

  it('renders sign in message by default', () => {
    render(<LoginPage />)

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
  })

  it('renders email and password inputs', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders sign in button', () => {
    render(<LoginPage />)

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders toggle to create account', () => {
    render(<LoginPage />)

    expect(screen.getByText("Don't have an account?")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create one/i })).toBeInTheDocument()
  })

  it('toggles to registration mode', () => {
    render(<LoginPage />)

    const toggleButton = screen.getByRole('button', { name: /create one/i })
    fireEvent.click(toggleButton)

    expect(screen.getByText('Create your account')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    expect(screen.getByText('Already have an account?')).toBeInTheDocument()
  })

  it('toggles back to sign in mode', () => {
    render(<LoginPage />)

    const toggleButton = screen.getByRole('button', { name: /create one/i })
    fireEvent.click(toggleButton)
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
  })

  it('calls login on submit', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('calls register on submit when registering', async () => {
    const mockRegister = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: mockRegister,
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    render(<LoginPage />)

    const toggleButton = screen.getByRole('button', { name: /create one/i })
    fireEvent.click(toggleButton)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', {
      name: /create account/i,
    })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('displays error message on login failure', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument()
      expect(screen.getByText(/Too many attempts\. Try again in/)).toBeInTheDocument()
    })
  })

  it('displays generic error message for non-Error objects', async () => {
    const mockLogin = vi.fn().mockRejectedValue('Something went wrong')
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/Authentication failed/)).toBeInTheDocument()
      expect(screen.getByText(/Too many attempts\. Try again in/)).toBeInTheDocument()
    })
  })

  it('disables button when loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    render(<LoginPage />)

    expect(screen.getByText('Checking session...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
  })

  it('shows named unreachable without the login form', () => {
    const retrySession = vi.fn()
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: true,
      retrySession,
    })

    render(<LoginPage />)

    expect(screen.getByRole('alert')).toHaveTextContent(CANNOT_REACH_PANTRY_COPY)
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create one/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Checking session...')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retrySession).toHaveBeenCalledTimes(1)
  })

  it('shows the existing form when signed out', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    render(<LoginPage />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('locks out after repeated failures and allows retry after lockout', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-18T12:00:00.000Z'))

    const flushPromises = async () => {
      await act(async () => {
        await Promise.resolve()
      })
    }

    const mockLogin = vi
      .fn()
      .mockRejectedValue(new Error('Invalid email or password. Please try again.'))
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    })

    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.click(submitButton)
    await flushPromises()
    expect(mockLogin).toHaveBeenCalledTimes(1)

    let expectedCalls = 1
    for (const delayMs of [1001, 2001, 4001, 8001]) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delayMs)
      })
      fireEvent.click(screen.getByRole('button', { name: /sign in|try again in/i }))
      expectedCalls += 1
      await flushPromises()
      expect(mockLogin).toHaveBeenCalledTimes(expectedCalls)
    }

    expect(mockLogin).toHaveBeenCalledTimes(5)
    expect(screen.getByRole('button', { name: /try again in/i })).toBeDisabled()
    expect(screen.getByText(/Too many attempts\. Try again in/i)).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000)
    })

    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await flushPromises()
    expect(mockLogin).toHaveBeenCalledTimes(6)

    vi.useRealTimers()
  })

  it('clears error when toggling mode', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument()
    })

    const toggleButton = screen.getByRole('button', { name: /create one/i })
    fireEvent.click(toggleButton)

    expect(screen.queryByText(/Invalid credentials/)).not.toBeInTheDocument()
  })
})
