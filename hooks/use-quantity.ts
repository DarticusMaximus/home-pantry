import { AppwriteException } from 'appwrite'
import { useCallback, useEffect, useRef, useState } from 'react'
import { updateItem } from '@/lib/appwrite/items'
import type { Item } from '@/types/item'

const DEBOUNCE_MS = 300
const ERROR_CLEAR_MS = 4000

function isDocumentNotFound(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === 404
}

type ItemPatch = { quantity: number }

export type UseQuantityOptions = {
  onZeroIntent?: (item: Item) => void
}

export function useQuantity(onServerWriteSuccess?: () => void, options?: UseQuantityOptions) {
  const onZeroIntentRef = useRef(options?.onZeroIntent)
  onZeroIntentRef.current = options?.onZeroIntent

  const pendingDeltas = useRef<Map<string, number>>(new Map())
  const originalQuantities = useRef<Map<string, ItemPatch>>(new Map())
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const mutationQueues = useRef<Map<string, Promise<void>>>(new Map())
  const queuedMutationCounts = useRef<Map<string, number>>(new Map())
  const activeMutationCount = useRef(0)
  const mounted = useRef(true)
  const [isFlushing, setIsFlushing] = useState(false)
  const [deltaVersion, setDeltaVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const committedPatches = useRef<Map<string, ItemPatch>>(new Map())

  const refreshPatches = useCallback(() => {
    if (mounted.current) setDeltaVersion((v) => v + 1)
  }, [])

  const setErrorWithAutoClear = useCallback((message: string) => {
    if (!mounted.current) return
    setError(message)
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(null), ERROR_CLEAR_MS)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: deltaVersion is a re-render trigger, not a value dependency
  const getOptimisticQuantity = useCallback(
    (item: Item): number => {
      const delta = pendingDeltas.current.get(item.id) ?? 0
      const base = committedPatches.current.get(item.id) ?? item
      return base.quantity + delta
    },
    [deltaVersion],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: deltaVersion is a re-render trigger, not a value dependency
  const patchItem = useCallback(
    (item: Item): Item => {
      const delta = pendingDeltas.current.get(item.id)
      const committed = committedPatches.current.get(item.id)
      if (delta !== undefined) {
        const base = committed ?? { quantity: item.quantity }
        return { ...item, quantity: base.quantity + delta }
      }
      if (committed) {
        return { ...item, quantity: committed.quantity }
      }
      return item
    },
    [deltaVersion],
  )

  const patchItems = useCallback((items: Item[]): Item[] => items.map(patchItem), [patchItem])

  const persistQuantityWrite = useCallback(async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      return
    }
    await updateItem(itemId, { quantity })
    committedPatches.current.set(itemId, { quantity })
  }, [])

  const enqueueMutation = useCallback((itemId: string, mutation: () => Promise<void>) => {
    const previous = mutationQueues.current.get(itemId) ?? Promise.resolve()
    const queuedCount = queuedMutationCounts.current.get(itemId) ?? 0
    queuedMutationCounts.current.set(itemId, queuedCount + 1)
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        activeMutationCount.current += 1
        if (mounted.current) setIsFlushing(true)

        try {
          await mutation()
        } finally {
          activeMutationCount.current -= 1
          if (mounted.current && activeMutationCount.current === 0) setIsFlushing(false)
        }
      })

    mutationQueues.current.set(itemId, next)
    const finishQueue = () => {
      if (mutationQueues.current.get(itemId) === next) mutationQueues.current.delete(itemId)
      const queuedCount = queuedMutationCounts.current.get(itemId) ?? 1
      if (queuedCount === 1) queuedMutationCounts.current.delete(itemId)
      else queuedMutationCounts.current.set(itemId, queuedCount - 1)
    }
    void next.then(finishQueue, finishQueue)

    return next
  }, [])

  const flushItem = useCallback(
    (itemId: string) => {
      void enqueueMutation(itemId, async () => {
        const delta = pendingDeltas.current.get(itemId)
        if (delta === undefined) return

        const original = originalQuantities.current.get(itemId)
        if (!original) return

        const previousCommitted = committedPatches.current.get(itemId)
        const base = previousCommitted ?? original
        const finalQuantity = base.quantity + delta

        if (finalQuantity > 0) {
          committedPatches.current.set(itemId, { quantity: finalQuantity })
        }

        pendingDeltas.current.delete(itemId)
        originalQuantities.current.delete(itemId)
        debounceTimers.current.delete(itemId)

        if (finalQuantity <= 0) {
          return
        }

        try {
          await persistQuantityWrite(itemId, finalQuantity)
          refreshPatches()
          if (mounted.current) onServerWriteSuccess?.()
        } catch (error) {
          if (isDocumentNotFound(error)) {
            refreshPatches()
            if (mounted.current) onServerWriteSuccess?.()
            return
          }

          if (previousCommitted) {
            committedPatches.current.set(itemId, previousCommitted)
          } else {
            committedPatches.current.delete(itemId)
          }

          const pendingDelta = pendingDeltas.current.get(itemId) ?? 0
          pendingDeltas.current.set(itemId, pendingDelta)
          if (!originalQuantities.current.has(itemId)) {
            originalQuantities.current.set(itemId, original)
          }
          refreshPatches()
          setErrorWithAutoClear('Failed to update. Try again.')
        }
      })
    },
    [
      enqueueMutation,
      onServerWriteSuccess,
      persistQuantityWrite,
      refreshPatches,
      setErrorWithAutoClear,
    ],
  )

  const clearDebounceTimer = useCallback((itemId: string) => {
    const existing = debounceTimers.current.get(itemId)
    if (existing) clearTimeout(existing)
    debounceTimers.current.delete(itemId)
  }, [])

  const startDebounce = useCallback(
    (itemId: string) => {
      clearDebounceTimer(itemId)

      const timer = setTimeout(() => {
        flushItem(itemId)
      }, DEBOUNCE_MS)

      debounceTimers.current.set(itemId, timer)
    },
    [clearDebounceTimer, flushItem],
  )

  const interceptZero = useCallback(
    (item: Item) => {
      clearDebounceTimer(item.id)
      onZeroIntentRef.current?.(item)
    },
    [clearDebounceTimer],
  )

  const cancelPendingWrites = useCallback(
    (itemId: string) => {
      clearDebounceTimer(itemId)
      pendingDeltas.current.delete(itemId)
      originalQuantities.current.delete(itemId)
      refreshPatches()
    },
    [clearDebounceTimer, refreshPatches],
  )

  const restorePendingWrites = useCallback(
    (itemId: string) => {
      if (!pendingDeltas.current.has(itemId)) return
      startDebounce(itemId)
    },
    [startDebounce],
  )

  const getBaseQuantity = useCallback((item: Item): ItemPatch => {
    return committedPatches.current.get(item.id) ?? { quantity: item.quantity }
  }, [])

  const incrementQuantity = useCallback(
    (item: Item) => {
      if (!pendingDeltas.current.has(item.id)) {
        originalQuantities.current.set(item.id, getBaseQuantity(item))
        pendingDeltas.current.set(item.id, 0)
      }

      const currentDelta = pendingDeltas.current.get(item.id) ?? 0
      pendingDeltas.current.set(item.id, currentDelta + 1)
      refreshPatches()

      startDebounce(item.id)
    },
    [startDebounce, getBaseQuantity, refreshPatches],
  )

  const decrementQuantity = useCallback(
    (item: Item) => {
      const currentDelta = pendingDeltas.current.get(item.id) ?? 0
      const base = committedPatches.current.get(item.id) ?? {
        quantity: item.quantity,
      }
      const currentOptimisticQty = base.quantity + currentDelta
      if (currentOptimisticQty - 1 <= 0) {
        interceptZero(item)
        return
      }

      if (!pendingDeltas.current.has(item.id)) {
        originalQuantities.current.set(item.id, getBaseQuantity(item))
        pendingDeltas.current.set(item.id, 0)
      }

      const nextDelta = pendingDeltas.current.get(item.id) ?? 0
      pendingDeltas.current.set(item.id, nextDelta - 1)
      refreshPatches()
      startDebounce(item.id)
    },
    [startDebounce, getBaseQuantity, interceptZero, refreshPatches],
  )

  const partialUse = useCallback(
    (item: Item, amountToRemove: number) => {
      const pendingDelta = pendingDeltas.current.get(item.id) ?? 0
      const original = originalQuantities.current.get(item.id) ?? getBaseQuantity(item)
      const previousCommitted = committedPatches.current.get(item.id)
      const interceptBase = previousCommitted ?? original
      if (interceptBase.quantity + pendingDelta - amountToRemove <= 0) {
        interceptZero(item)
        return Promise.resolve()
      }

      const overlayQuantity = interceptBase.quantity + pendingDelta - amountToRemove
      committedPatches.current.set(item.id, { quantity: overlayQuantity })

      const existing = debounceTimers.current.get(item.id)
      if (existing) clearTimeout(existing)
      pendingDeltas.current.delete(item.id)
      originalQuantities.current.delete(item.id)
      debounceTimers.current.delete(item.id)
      refreshPatches()

      return enqueueMutation(item.id, async () => {
        const live = committedPatches.current.get(item.id)
        const queueBase =
          live !== undefined && live.quantity !== overlayQuantity
            ? live
            : (previousCommitted ?? original)
        const newQuantity = queueBase.quantity + pendingDelta - amountToRemove

        try {
          await persistQuantityWrite(item.id, newQuantity)
          refreshPatches()
          if (mounted.current) onServerWriteSuccess?.()
        } catch (error) {
          if (isDocumentNotFound(error)) {
            refreshPatches()
            if (mounted.current) onServerWriteSuccess?.()
            return
          }

          const current = committedPatches.current.get(item.id)
          if (!current || current.quantity === overlayQuantity) {
            if (previousCommitted) {
              committedPatches.current.set(item.id, previousCommitted)
            } else {
              committedPatches.current.delete(item.id)
            }
          }
          if (pendingDelta !== 0) {
            const nextDelta = pendingDeltas.current.get(item.id) ?? 0
            pendingDeltas.current.set(item.id, nextDelta + pendingDelta)
            if (!originalQuantities.current.has(item.id)) {
              originalQuantities.current.set(item.id, original)
            }
          }
          refreshPatches()
          setErrorWithAutoClear('Failed to update. Try again.')
        }
      })
    },
    [
      enqueueMutation,
      getBaseQuantity,
      interceptZero,
      onServerWriteSuccess,
      persistQuantityWrite,
      refreshPatches,
      setErrorWithAutoClear,
    ],
  )

  const setQuantity = useCallback(
    (item: Item, value: number) => {
      if (value <= 0) {
        interceptZero(item)
        return Promise.resolve()
      }

      cancelPendingWrites(item.id)

      return enqueueMutation(item.id, async () => {
        const previousCommitted = committedPatches.current.get(item.id)
        committedPatches.current.set(item.id, { quantity: value })
        refreshPatches()

        try {
          await persistQuantityWrite(item.id, value)
          refreshPatches()
          if (mounted.current) onServerWriteSuccess?.()
        } catch (error) {
          if (isDocumentNotFound(error)) {
            refreshPatches()
            if (mounted.current) onServerWriteSuccess?.()
            return
          }

          if (previousCommitted) {
            committedPatches.current.set(item.id, previousCommitted)
          } else {
            committedPatches.current.delete(item.id)
          }
          refreshPatches()
          setErrorWithAutoClear('Failed to update. Try again.')
        }
      })
    },
    [
      cancelPendingWrites,
      enqueueMutation,
      interceptZero,
      onServerWriteSuccess,
      persistQuantityWrite,
      refreshPatches,
      setErrorWithAutoClear,
    ],
  )

  const clearPatchesOnRefetch = useCallback(
    (fetched?: Item[]) => {
      const fetchedById = fetched ? new Map(fetched.map((row) => [row.id, row])) : undefined

      for (const [itemId, committed] of committedPatches.current) {
        const queuedCount = queuedMutationCounts.current.get(itemId) ?? 0
        if (queuedCount > 1 || pendingDeltas.current.has(itemId)) {
          continue
        }
        if (fetchedById) {
          const row = fetchedById.get(itemId)
          if (!row || row.quantity !== committed.quantity) {
            continue
          }
        }
        committedPatches.current.delete(itemId)
      }
      refreshPatches()
    },
    [refreshPatches],
  )

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false

      for (const [itemId, delta] of pendingDeltas.current) {
        const original = originalQuantities.current.get(itemId)
        if (!original) continue

        pendingDeltas.current.delete(itemId)
        originalQuantities.current.delete(itemId)

        const base = committedPatches.current.get(itemId) ?? original
        const quantity = base.quantity + delta
        if (quantity <= 0) continue

        void enqueueMutation(itemId, async () => {
          try {
            await persistQuantityWrite(itemId, quantity)
          } catch (error) {
            console.error('Failed to persist quantity update on unmount', error)
          }
        })
      }

      for (const timer of debounceTimers.current.values()) {
        clearTimeout(timer)
      }
      debounceTimers.current.clear()
      if (errorTimer.current) clearTimeout(errorTimer.current)
    }
  }, [enqueueMutation, persistQuantityWrite])

  return {
    incrementQuantity,
    decrementQuantity,
    partialUse,
    setQuantity,
    cancelPendingWrites,
    restorePendingWrites,
    getOptimisticQuantity,
    patchItem,
    patchItems,
    clearPatchesOnRefetch,
    isFlushing,
    error,
  }
}
