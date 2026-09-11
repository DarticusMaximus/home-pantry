import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CANNOT_REACH_PANTRY_COPY,
  PANTRY_REACH_TIMEOUT_MS,
  PantryUnreachableError,
  withTimeout,
} from '@/lib/pantry-reachability'

describe('pantry reachability', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pins the named unreachable copy', () => {
    expect(CANNOT_REACH_PANTRY_COPY).toBe("Can't reach the pantry.")
  })

  it('pins the 8s reach deadline', () => {
    expect(PANTRY_REACH_TIMEOUT_MS).toBe(8000)
  })

  it('rejects PantryUnreachableError when the promise never settles', async () => {
    vi.useFakeTimers()
    const never = new Promise<never>(() => {})

    const resultPromise = withTimeout(never)
    vi.advanceTimersByTime(8000)

    await expect(resultPromise).rejects.toMatchObject({
      name: 'PantryUnreachableError',
    })
    await expect(resultPromise).rejects.toBeInstanceOf(PantryUnreachableError)
  })

  it('returns the value when the promise resolves before the deadline', async () => {
    vi.useFakeTimers()
    const delayed = new Promise<string>((resolve) => {
      setTimeout(() => resolve('ok'), 100)
    })

    const resultPromise = withTimeout(delayed)
    vi.advanceTimersByTime(100)

    await expect(resultPromise).resolves.toBe('ok')
  })
})
