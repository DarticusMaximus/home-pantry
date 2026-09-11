import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthLayout from '@/app/(auth)/layout'

vi.mock('@/contexts/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}))

describe('AuthLayout', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders children', () => {
    const { container } = render(
      <AuthLayout>
        <div>Test Content</div>
      </AuthLayout>,
    )

    expect(container).toHaveTextContent('Test Content')
    expect(container.querySelector('[data-testid="auth-provider"]')).toBeInTheDocument()
  })
})
