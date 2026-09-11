import { useCallback, useState } from 'react'

export interface UseMutationReturn<T> {
  mutate: (data: T) => Promise<void>
  isLoading: boolean
  error: Error | null
  isSuccess: boolean
  reset: () => void
}

export interface UseMutationWithIdReturn<T> {
  mutateWithId: (id: string, data: T) => Promise<void>
  isLoading: boolean
  error: Error | null
  isSuccess: boolean
  reset: () => void
}

export function createMutationHook<TInput>(
  mutationFn: (data: TInput) => Promise<unknown>,
  errorMessage: string,
) {
  return function useMutation(onSuccess?: () => void): UseMutationReturn<TInput> {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isSuccess, setIsSuccess] = useState(false)

    const mutate = useCallback(
      async (data: TInput) => {
        setIsLoading(true)
        setError(null)
        setIsSuccess(false)
        try {
          await mutationFn(data)
          setIsSuccess(true)
          onSuccess?.()
        } catch (e) {
          const err = e instanceof Error ? e : new Error(errorMessage)
          setError(err)
          throw err
        } finally {
          setIsLoading(false)
        }
      },
      [onSuccess],
    )

    const reset = useCallback(() => {
      setError(null)
      setIsSuccess(false)
    }, [])

    return { mutate, isLoading, error, isSuccess, reset }
  }
}

export function createMutationWithIdHook<TInput>(
  mutationFn: (id: string, data: TInput) => Promise<unknown>,
  errorMessage: string,
) {
  return function useMutationWithId(onSuccess?: () => void): UseMutationWithIdReturn<TInput> {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isSuccess, setIsSuccess] = useState(false)

    const mutateWithId = useCallback(
      async (id: string, data: TInput) => {
        setIsLoading(true)
        setError(null)
        setIsSuccess(false)
        try {
          await mutationFn(id, data)
          setIsSuccess(true)
          onSuccess?.()
        } catch (e) {
          const err = e instanceof Error ? e : new Error(errorMessage)
          setError(err)
          throw err
        } finally {
          setIsLoading(false)
        }
      },
      [onSuccess],
    )

    const reset = useCallback(() => {
      setError(null)
      setIsSuccess(false)
    }, [])

    return { mutateWithId, isLoading, error, isSuccess, reset }
  }
}

export function createBoundMutationHook<TInput>(
  mutationFn: (id: string, data: TInput) => Promise<unknown>,
  errorMessage: string,
) {
  return function useBoundMutation(id: string, onSuccess?: () => void): UseMutationReturn<TInput> {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isSuccess, setIsSuccess] = useState(false)

    const mutate = useCallback(
      async (data: TInput) => {
        setIsLoading(true)
        setError(null)
        setIsSuccess(false)
        try {
          await mutationFn(id, data)
          setIsSuccess(true)
          onSuccess?.()
        } catch (e) {
          const err = e instanceof Error ? e : new Error(errorMessage)
          setError(err)
          throw err
        } finally {
          setIsLoading(false)
        }
      },
      [id, onSuccess],
    )

    const reset = useCallback(() => {
      setError(null)
      setIsSuccess(false)
    }, [])

    return { mutate, isLoading, error, isSuccess, reset }
  }
}
