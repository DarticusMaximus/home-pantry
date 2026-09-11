import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '@/app/(app)/layout'

vi.mock('@/components/auth/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-guard">{children}</div>
  ),
}))

vi.mock('@/components/layout/bottom-nav', () => ({
  BottomNav: () => <nav data-testid="bottom-nav">BottomNav</nav>,
}))

vi.mock('@/components/layout/header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}))

vi.mock('@/contexts/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}))

vi.mock('@/contexts/search-mode-context', () => ({
  SearchModeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="search-mode-provider">{children}</div>
  ),
}))

describe('AppLayout', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders children within auth guard and provider', () => {
    const { container } = render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>,
    )

    expect(container).toHaveTextContent('Test Content')
    expect(container.querySelector('[data-testid="auth-provider"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="auth-guard"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="search-mode-provider"]')).toBeInTheDocument()
  })

  it('renders header and bottom nav', () => {
    const { container } = render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>,
    )

    expect(container.querySelector('[data-testid="header"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="bottom-nav"]')).toBeInTheDocument()
  })

  it('applies layout classes', () => {
    const { container } = render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>,
    )

    const main = container.querySelector('main')
    expect(main).toHaveClass('flex-1', 'pb-shell')
    expect(main).not.toHaveClass('pb-36')
  })
})
