import { useCallback, useEffect, useRef, useState } from 'react'
import { withTimeout } from '@/lib/pantry-reachability'

export interface UseFetchReturn<T> {
  data: T
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function createFetchHook<TData>(
  fetchFn: () => Promise<TData[]>,
  errorMessage: string,
): () => UseFetchReturn<TData[]> {
  return function useFetch(): UseFetchReturn<TData[]> {
    const [data, setData] = useState<TData[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchData = useCallback(async (isStale: () => boolean = () => false) => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await withTimeout(fetchFn())
        if (!isStale()) {
          setData(result)
        }
      } catch (e) {
        if (!isStale()) {
          setError(e instanceof Error ? e : new Error(errorMessage))
        }
      } finally {
        if (!isStale()) {
          setIsLoading(false)
        }
      }
    }, [])

    useEffect(() => {
      let isStale = false
      void fetchData(() => isStale)

      return () => {
        isStale = true
      }
    }, [fetchData])

    return { data, isLoading, error, refetch: fetchData }
  }
}

export interface UseFetchByIdReturn<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function createFetchByIdHook<TData>(
  fetchFn: (id: string) => Promise<TData>,
  errorMessage: string,
): (id: string) => UseFetchByIdReturn<TData> {
  return function useFetchById(id: string): UseFetchByIdReturn<TData> {
    const [data, setData] = useState<TData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchData = useCallback(
      async (isStale: () => boolean = () => false) => {
        if (!id) {
          setData(null)
          setError(null)
          setIsLoading(false)
          return
        }
        setIsLoading(true)
        setError(null)
        try {
          const result = await withTimeout(fetchFn(id))
          if (!isStale()) {
            setData(result)
          }
        } catch (e) {
          if (!isStale()) {
            setError(e instanceof Error ? e : new Error(errorMessage))
          }
        } finally {
          if (!isStale()) {
            setIsLoading(false)
          }
        }
      },
      [id],
    )

    useEffect(() => {
      let isStale = false
      void fetchData(() => isStale)

      return () => {
        isStale = true
      }
    }, [fetchData])

    return { data, isLoading, error, refetch: fetchData }
  }
}

export interface UseFetchConditionalReturn<T> {
  data: T
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function createFetchConditionalHook<TData>(
  fetchFn: (id: string) => Promise<TData[]>,
  errorMessage: string,
): (id: string) => UseFetchConditionalReturn<TData[]> {
  return function useFetchConditional(id: string): UseFetchConditionalReturn<TData[]> {
    const [data, setData] = useState<TData[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchData = useCallback(
      async (isStale: () => boolean = () => false) => {
        if (!id) {
          setData([])
          setIsLoading(false)
          return
        }
        setIsLoading(true)
        setError(null)
        try {
          const result = await withTimeout(fetchFn(id))
          if (!isStale()) {
            setData(result)
          }
        } catch (e) {
          if (!isStale()) {
            setError(e instanceof Error ? e : new Error(errorMessage))
          }
        } finally {
          if (!isStale()) {
            setIsLoading(false)
          }
        }
      },
      [id],
    )

    useEffect(() => {
      let isStale = false
      void fetchData(() => isStale)

      return () => {
        isStale = true
      }
    }, [fetchData])

    return { data, isLoading, error, refetch: fetchData }
  }
}

export interface UseSearchReturn<T> {
  results: T[]
  isLoading: boolean
  error: Error | null
}

export function createSearchHook<TData>(
  searchFn: (query: string) => Promise<TData[]>,
  errorMessage: string,
  minQueryLength = 2,
  debounceMs = 300,
): (query: string) => UseSearchReturn<TData> {
  return function useSearch(query: string): UseSearchReturn<TData> {
    const [results, setResults] = useState<TData[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      let isStale = false

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (query.length < minQueryLength) {
        setResults([])
        setError(null)
        setIsLoading(false)
        return () => {
          isStale = true
          if (debounceRef.current) {
            clearTimeout(debounceRef.current)
          }
        }
      }

      debounceRef.current = setTimeout(async () => {
        setIsLoading(true)
        setError(null)
        try {
          const data = await searchFn(query)
          if (!isStale) {
            setResults(data)
          }
        } catch (e) {
          if (!isStale) {
            setError(e instanceof Error ? e : new Error(errorMessage))
          }
        } finally {
          if (!isStale) {
            setIsLoading(false)
          }
        }
      }, debounceMs)

      return () => {
        isStale = true
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
      }
    }, [query])

    return { results, isLoading, error }
  }
}
