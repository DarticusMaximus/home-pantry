import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/components/ui/error-boundary'

function ThrowingComponent({ error }: { error: Error }): React.ReactNode {
  throw error
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('shows fallback when child throws during render', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('boom')} />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows Try again text in fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('boom')} />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('does not render error.message to users', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('secret-internal-detail')} />
      </ErrorBoundary>,
    )
    expect(screen.queryByText(/secret-internal-detail/)).not.toBeInTheDocument()
  })

  it('resets error state when Try again is clicked', async () => {
    const user = userEvent.setup()

    let shouldThrow = true

    function ConditionalThrower() {
      if (shouldThrow) throw new Error('boom')
      return <p>Recovered</p>
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()

    shouldThrow = false

    const retryButton = screen.getByRole('button', { name: /try again/i })
    await user.click(retryButton)

    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('rethrows on retry until a reset key changes', async () => {
    const user = userEvent.setup()

    function ConditionalThrower({ shouldThrow }: { shouldThrow: boolean }) {
      if (shouldThrow) throw new Error('boom')
      return <p>Recovered</p>
    }

    const { rerender } = render(
      <ErrorBoundary resetKeys={['initial']}>
        <ConditionalThrower shouldThrow />
      </ErrorBoundary>,
    )

    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(
      <ErrorBoundary resetKeys={['recovered']}>
        <ConditionalThrower shouldThrow={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })
})
