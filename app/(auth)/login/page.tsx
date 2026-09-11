'use client'

import { useEffect, useMemo, useState } from 'react'
import { CannotReachPantry } from '@/components/ui/cannot-reach-pantry'
import { useAuth } from '@/contexts/auth-context'

const MAX_ATTEMPTS_PER_WINDOW = 5
const RATE_LIMIT_WINDOW_MS = 60_000
const BASE_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

function getBackoffDelayMs(consecutiveFailures: number): number {
  const exponent = Math.max(consecutiveFailures - 1, 0)
  return Math.min(BASE_BACKOFF_MS * 2 ** exponent, MAX_BACKOFF_MS)
}

function pruneAttempts(attempts: number[], now: number): number[] {
  return attempts.filter((attempt) => now - attempt < RATE_LIMIT_WINDOW_MS)
}

function getLockoutMessage(remainingMs: number): string {
  const seconds = Math.max(Math.ceil(remainingMs / 1000), 1)
  return `Too many attempts. Try again in ${seconds}s.`
}

export default function LoginPage() {
  const { login, register, loading, unreachable, retrySession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState<number[]>([])
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)

  const remainingLockoutMs = useMemo(() => {
    if (!lockedUntil) {
      return 0
    }

    return Math.max(lockedUntil - Date.now(), 0)
  }, [lockedUntil])

  const isLockedOut = remainingLockoutMs > 0

  useEffect(() => {
    if (!lockedUntil) {
      return
    }

    const remainingMs = lockedUntil - Date.now()
    if (remainingMs <= 0) {
      setLockedUntil(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setLockedUntil(null)
    }, remainingMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [lockedUntil])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const now = Date.now()

    if (isLockedOut && lockedUntil) {
      setError(getLockoutMessage(lockedUntil - now))
      return
    }

    setIsSubmitting(true)

    try {
      if (isRegistering) {
        await register(email, password)
      } else {
        await login(email, password)
      }

      setFailedAttempts([])
      setConsecutiveFailures(0)
      setLockedUntil(null)
    } catch (err) {
      const attemptsInWindow = [...pruneAttempts(failedAttempts, now), now]
      const nextConsecutiveFailures = consecutiveFailures + 1
      const backoffLockoutUntil = now + getBackoffDelayMs(nextConsecutiveFailures)

      let nextLockoutUntil = backoffLockoutUntil
      if (attemptsInWindow.length >= MAX_ATTEMPTS_PER_WINDOW) {
        nextLockoutUntil = Math.max(nextLockoutUntil, attemptsInWindow[0] + RATE_LIMIT_WINDOW_MS)
      }

      setFailedAttempts(attemptsInWindow)
      setConsecutiveFailures(nextConsecutiveFailures)
      setLockedUntil(nextLockoutUntil)

      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'
      setError(`${errorMessage} ${getLockoutMessage(nextLockoutUntil - now)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="text-sm text-gray-500">Checking session...</p>
      </div>
    )
  }

  if (unreachable) {
    return <CannotReachPantry onRetry={retrySession} />
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-emerald-600">Home Pantry</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isRegistering ? 'Create your account' : 'Sign in to your account'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            minLength={8}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="********"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isLockedOut}
          className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          {isSubmitting
            ? 'Please wait...'
            : isLockedOut
              ? `Try again in ${Math.max(Math.ceil(remainingLockoutMs / 1000), 1)}s`
              : isRegistering
                ? 'Create Account'
                : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          onClick={() => {
            setError(null)
            setIsRegistering(!isRegistering)
          }}
          disabled={isSubmitting}
          className="font-medium text-emerald-600 hover:text-emerald-500"
        >
          {isRegistering ? 'Sign in' : 'Create one'}
        </button>
      </p>
    </div>
  )
}
