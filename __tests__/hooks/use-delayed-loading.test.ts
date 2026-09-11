import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'

describe('useDelayedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false initially when isLoading is false', () => {
    const { result } = renderHook(() => useDelayedLoading(false))
    expect(result.current).toBe(false)
  })

  it('returns false when isLoading just became true (within delay period)', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading), {
      initialProps: { isLoading: false },
    })
    rerender({ isLoading: true })
    expect(result.current).toBe(false)
  })

  it('returns true after delayMs when isLoading stays true', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading, 150), {
      initialProps: { isLoading: false },
    })

    rerender({ isLoading: true })
    expect(result.current).toBe(false)

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe(true)
  })

  it('returns true for minDisplayMs after isLoading becomes false', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) => useDelayedLoading(isLoading, 150, 250),
      { initialProps: { isLoading: false } },
    )

    rerender({ isLoading: true })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe(true)

    rerender({ isLoading: false })
    expect(result.current).toBe(true)

    act(() => {
      vi.advanceTimersByTime(249)
    })
    expect(result.current).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })

  it('returns false immediately when isLoading becomes false and skeleton was never shown', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading, 150), {
      initialProps: { isLoading: true },
    })

    expect(result.current).toBe(false)

    rerender({ isLoading: false })
    expect(result.current).toBe(false)
  })
})
