'use client'

import type { ReactNode } from 'react'
import { Component } from 'react'

interface ErrorBoundaryProps {
  fallback?: ReactNode
  children: ReactNode
  resetKeys?: readonly unknown[]
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false })
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="rounded-xl bg-white p-6 text-center shadow-sm" role="alert">
          <h2 className="text-lg font-semibold text-gray-900">Home Pantry needs a refresh</h2>
          <p className="mt-2 text-sm text-gray-500">
            Something went wrong in this screen. Try again to reload it.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-4 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function resetKeysChanged(
  previousKeys: readonly unknown[] | undefined,
  nextKeys: readonly unknown[] | undefined,
): boolean {
  if (previousKeys?.length !== nextKeys?.length) return true

  return previousKeys?.some((key, index) => !Object.is(key, nextKeys?.[index])) ?? false
}
