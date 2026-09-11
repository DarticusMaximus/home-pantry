import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTemplate, useTemplateSearch, useTemplates } from '@/hooks/use-templates'
import * as templatesService from '@/lib/appwrite/templates'

vi.mock('@/lib/appwrite/templates', () => ({
  getTemplates: vi.fn(),
  getTemplateById: vi.fn(),
  searchTemplates: vi.fn(),
  getTemplatesByCategory: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('useTemplates', () => {
  it('returns loading state initially and then templates', async () => {
    const mockTemplates = [{ $id: '1', name: 'Milk' }]
    vi.mocked(templatesService.getTemplates).mockResolvedValue(mockTemplates as any)

    const { result } = renderHook(() => useTemplates())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.templates).toEqual(mockTemplates)
    expect(result.current.error).toBeNull()
  })

  it('returns error state on failure', async () => {
    vi.mocked(templatesService.getTemplates).mockRejectedValue(new Error('Fetch failed'))

    const { result } = renderHook(() => useTemplates())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error?.message).toBe('Fetch failed')
    expect(result.current.templates).toEqual([])
  })
})

describe('useTemplate', () => {
  it('fetches single template', async () => {
    const mockTemplate = { $id: '1', name: 'Milk' }
    vi.mocked(templatesService.getTemplateById).mockResolvedValue(mockTemplate as any)

    const { result } = renderHook(() => useTemplate('1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.template).toEqual(mockTemplate)
  })

  it('settles not-loading with no fetch when id is empty', async () => {
    vi.mocked(templatesService.getTemplateById).mockClear()

    const { result } = renderHook(() => useTemplate(''))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.template).toBeNull()
    expect(result.current.error).toBeNull()
    expect(templatesService.getTemplateById).not.toHaveBeenCalled()
  })
})

describe('useTemplateSearch', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('only searches with 2+ characters and debounces', async () => {
    vi.useFakeTimers()
    const mockResults = [{ $id: '1', name: 'Milk' }]
    vi.mocked(templatesService.searchTemplates).mockResolvedValue(mockResults as any)

    const { result, rerender } = renderHook(({ query }) => useTemplateSearch(query), {
      initialProps: { query: 'm' },
    })

    expect(result.current.results).toEqual([])
    expect(templatesService.searchTemplates).not.toHaveBeenCalled()

    act(() => {
      rerender({ query: 'mil' })
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(templatesService.searchTemplates).toHaveBeenCalledWith('mil')
    expect(result.current.results).toEqual(mockResults)

    vi.useRealTimers()
  })

  it('returns empty results for short queries', async () => {
    const { result } = renderHook(() => useTemplateSearch('a'))
    expect(result.current.results).toEqual([])
  })

  it('latest query wins over slower earlier search', async () => {
    vi.useFakeTimers()
    const abResults = [{ $id: 'ab', name: 'Ab' }]
    const abcResults = [{ $id: 'abc', name: 'Abc' }]
    const ab = deferred<typeof abResults>()
    const abc = deferred<typeof abcResults>()

    vi.mocked(templatesService.searchTemplates).mockImplementation((query: string) => {
      if (query === 'ab') return ab.promise as any
      if (query === 'abc') return abc.promise as any
      return Promise.resolve([])
    })

    const { result, rerender } = renderHook(({ query }) => useTemplateSearch(query), {
      initialProps: { query: 'ab' },
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    act(() => {
      rerender({ query: 'abc' })
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    await act(async () => {
      abc.resolve(abcResults)
    })

    expect(result.current.results).toEqual(abcResults)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()

    await act(async () => {
      ab.resolve(abResults)
    })

    expect(result.current.results).toEqual(abcResults)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('short query after in-flight search settles empty and ignores stale rejection', async () => {
    vi.useFakeTimers()
    const abResults = [{ $id: 'ab', name: 'Ab' }]
    const ab = deferred<typeof abResults>()

    vi.mocked(templatesService.searchTemplates).mockClear()
    vi.mocked(templatesService.searchTemplates).mockImplementation((query: string) => {
      if (query === 'ab') return ab.promise as any
      return Promise.resolve([])
    })

    const { result, rerender } = renderHook(({ query }) => useTemplateSearch(query), {
      initialProps: { query: 'ab' },
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    act(() => {
      rerender({ query: 'a' })
    })

    expect(result.current.results).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(templatesService.searchTemplates).not.toHaveBeenCalledWith('a')

    await act(async () => {
      ab.reject(new Error('stale'))
    })

    expect(result.current.results).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('ignores stale search rejection after latest query succeeds', async () => {
    vi.useFakeTimers()
    const abcResults = [{ $id: 'abc', name: 'Abc' }]
    const ab = deferred<typeof abcResults>()
    const abc = deferred<typeof abcResults>()

    vi.mocked(templatesService.searchTemplates).mockImplementation((query: string) => {
      if (query === 'ab') return ab.promise as any
      if (query === 'abc') return abc.promise as any
      return Promise.resolve([])
    })

    const { result, rerender } = renderHook(({ query }) => useTemplateSearch(query), {
      initialProps: { query: 'ab' },
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    act(() => {
      rerender({ query: 'abc' })
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    await act(async () => {
      abc.resolve(abcResults)
    })

    expect(result.current.results).toEqual(abcResults)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()

    await act(async () => {
      ab.reject(new Error('stale'))
    })

    expect(result.current.results).toEqual(abcResults)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
})
