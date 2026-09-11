'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyAddLotMatchToRow } from '@/lib/batch/add-lot-matching'
import { applyRemoveMatch } from '@/lib/batch/remove-matching'
import { deriveReviewRowStatus, UNRESOLVED_REVIEW_STATUSES } from '@/lib/batch/review-row-status'
import type {
  AddRowData,
  BatchOperation,
  BatchReviewRow,
  BatchReviewState,
  BatchRowStatus,
  RemoveRowData,
} from '@/types/batch-review'
import type { Item } from '@/types/item'

function isUnresolved(row: BatchReviewRow): boolean {
  return UNRESOLVED_REVIEW_STATUSES.has(row.status)
}

function withDerivedStatus(row: BatchReviewRow): BatchReviewRow {
  const status = deriveReviewRowStatus(row)
  if (row.status === status) return row
  return { ...row, status }
}

function identityFieldsChanged(prev?: AddRowData, next?: AddRowData): boolean {
  if (!prev || !next) return Boolean(prev || next)
  return (
    prev.name !== next.name ||
    prev.unit !== next.unit ||
    prev.locationId !== next.locationId ||
    prev.expirationDate !== next.expirationDate
  )
}

function rematchAddRows(
  rows: BatchReviewRow[],
  inventory: Item[],
  userResolvedIds: Set<string>,
): BatchReviewRow[] {
  if (inventory.length === 0) return rows
  let changed = false
  const next = rows.map((row) => {
    if (row.operation !== 'add' || userResolvedIds.has(row.id)) return row
    const rematched = withDerivedStatus(applyAddLotMatchToRow(row, inventory))
    if (rematched !== row) changed = true
    return rematched
  })
  return changed ? next : rows
}

function removeNameOf(row: BatchReviewRow): string {
  if (!row.removeData) return ''
  return row.removeData.type === 'unresolved'
    ? row.removeData.requestedName
    : row.removeData.matchedItemName
}

function removeMatchUnchanged(
  row: BatchReviewRow,
  status: BatchRowStatus,
  removeData: RemoveRowData,
): boolean {
  if (row.status !== status || !row.removeData || row.removeData.type !== removeData.type) {
    return false
  }
  if (row.removeData.removeQuantity !== removeData.removeQuantity) return false
  if (row.removeData.type === 'resolved' && removeData.type === 'resolved') {
    return (
      row.removeData.matchedItemId === removeData.matchedItemId &&
      row.removeData.matchedItemName === removeData.matchedItemName &&
      row.removeData.currentQuantity === removeData.currentQuantity
    )
  }
  if (row.removeData.type === 'unresolved' && removeData.type === 'unresolved') {
    return (
      row.removeData.requestedName === removeData.requestedName &&
      row.removeData.candidates.length === removeData.candidates.length &&
      row.removeData.candidates.every(
        (candidate, index) => candidate.item.id === removeData.candidates[index]?.item.id,
      )
    )
  }
  return false
}

function rematchRemoveRow(
  row: BatchReviewRow,
  inventory: Item[],
  forceRule3: boolean,
): BatchReviewRow {
  if (row.operation !== 'remove' || !row.removeData) return row

  const removeQuantity = row.removeData.removeQuantity

  if (!forceRule3 && row.removeData.type === 'resolved') {
    const matchedItemId = row.removeData.matchedItemId
    const live = inventory.find((item) => item.id === matchedItemId)
    if (live) {
      if (row.removeData.currentQuantity === live.quantity) {
        return withDerivedStatus(row)
      }
      return withDerivedStatus({
        ...row,
        status: 'ready',
        removeData: {
          ...row.removeData,
          currentQuantity: live.quantity,
        },
      })
    }
  }

  const requestedName = removeNameOf(row)
  const applied = applyRemoveMatch(requestedName, inventory, removeQuantity)
  const next = withDerivedStatus({
    ...row,
    status: applied.status,
    removeData: applied.removeData,
  })
  if (removeMatchUnchanged(row, next.status, applied.removeData)) return row
  return next
}

function rematchRemoveRows(
  rows: BatchReviewRow[],
  inventory: Item[],
  forceRule3Ids: Set<string>,
): BatchReviewRow[] {
  let changed = false
  const next = rows.map((row) => {
    if (row.operation !== 'remove') return row
    const forceRule3 = forceRule3Ids.has(row.id)
    const rematched = rematchRemoveRow(row, inventory, forceRule3)
    if (forceRule3) forceRule3Ids.delete(row.id)
    if (rematched !== row) changed = true
    return rematched
  })
  return changed ? next : rows
}

function rematchRows(
  rows: BatchReviewRow[],
  inventory: Item[],
  userResolvedIds: Set<string>,
  forceRule3Ids: Set<string>,
): BatchReviewRow[] {
  return rematchRemoveRows(
    rematchAddRows(rows, inventory, userResolvedIds),
    inventory,
    forceRule3Ids,
  )
}

interface UseBatchReviewReturn {
  state: BatchReviewState
  canConfirm: boolean
  updateRowQuantity: (rowId: string, quantity: number) => void
  updateRowLocation: (rowId: string, locationId: string) => void
  replaceRow: (rowId: string, row: BatchReviewRow) => void
  removeRow: (rowId: string) => void
  selectRemoveMatch: (rowId: string, itemId: string) => void
  selectAddLot: (rowId: string, itemId: string | null) => void
  confirmGuess: (rowId: string) => void
  unresolvedCount: number
}

const EMPTY_INVENTORY: Item[] = []

export function useBatchReview(
  operation: BatchOperation,
  initialRows: BatchReviewRow[],
  inventory: Item[] = EMPTY_INVENTORY,
  isLoading = false,
): UseBatchReviewReturn {
  const userResolvedIdsRef = useRef(new Set<string>())
  const userEditedIdsRef = useRef(new Set<string>())
  const forceRule3IdsRef = useRef(new Set<string>())
  const inventoryRef = useRef(inventory)
  const initialRowsRef = useRef(initialRows)
  const isLoadingRef = useRef(isLoading)
  const [rows, setRows] = useState<BatchReviewRow[]>(() =>
    isLoading
      ? initialRows
      : rematchRows(initialRows, inventory, userResolvedIdsRef.current, forceRule3IdsRef.current),
  )

  useEffect(() => {
    const inventoryChanged = inventoryRef.current !== inventory
    const initialChanged = initialRowsRef.current !== initialRows
    const loadingChanged = isLoadingRef.current !== isLoading
    if (!inventoryChanged && !initialChanged && !loadingChanged) return

    inventoryRef.current = inventory
    initialRowsRef.current = initialRows
    isLoadingRef.current = isLoading

    if (isLoading) return

    setRows((prev) => {
      const base = initialChanged
        ? initialRows.map((row) =>
            userResolvedIdsRef.current.has(row.id) || userEditedIdsRef.current.has(row.id)
              ? (prev.find((current) => current.id === row.id) ?? row)
              : row,
          )
        : prev
      return rematchRows(base, inventory, userResolvedIdsRef.current, forceRule3IdsRef.current)
    })
  }, [inventory, initialRows, isLoading])

  const unresolvedCount = useMemo(() => rows.filter(isUnresolved).length, [rows])

  const canConfirm = useMemo(
    () =>
      rows.length > 0 &&
      unresolvedCount === 0 &&
      !rows.some((row) => row.parseMetadata?.isUncertain),
    [rows, unresolvedCount],
  )

  const updateRowQuantity = useCallback((rowId: string, quantity: number) => {
    userEditedIdsRef.current.add(rowId)
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        return withDerivedStatus({
          ...row,
          addData: row.addData ? { ...row.addData, quantity } : row.addData,
          removeData: row.removeData
            ? {
                ...row.removeData,
                removeQuantity: quantity,
              }
            : row.removeData,
        })
      }),
    )
  }, [])

  const updateRowLocation = useCallback(
    (rowId: string, locationId: string) => {
      userEditedIdsRef.current.add(rowId)
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row
          const next: BatchReviewRow = {
            ...row,
            addData: row.addData ? { ...row.addData, locationId } : row.addData,
          }
          if (next.operation === 'add') {
            userResolvedIdsRef.current.delete(rowId)
            return withDerivedStatus(applyAddLotMatchToRow(next, inventory))
          }
          return withDerivedStatus(next)
        }),
      )
    },
    [inventory],
  )

  const replaceRow = useCallback(
    (rowId: string, replacement: BatchReviewRow) => {
      userEditedIdsRef.current.add(rowId)
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row
          if (
            replacement.operation === 'add' &&
            identityFieldsChanged(row.addData, replacement.addData)
          ) {
            userResolvedIdsRef.current.delete(rowId)
            return withDerivedStatus(applyAddLotMatchToRow(replacement, inventory))
          }
          if (
            replacement.operation === 'remove' &&
            removeNameOf(row) !== removeNameOf(replacement)
          ) {
            forceRule3IdsRef.current.add(rowId)
            if (isLoading) return withDerivedStatus(replacement)
            forceRule3IdsRef.current.delete(rowId)
            return withDerivedStatus(rematchRemoveRow(replacement, inventory, true))
          }
          return withDerivedStatus(replacement)
        }),
      )
    },
    [inventory, isLoading],
  )

  const removeRow = useCallback((rowId: string) => {
    userResolvedIdsRef.current.delete(rowId)
    userEditedIdsRef.current.delete(rowId)
    forceRule3IdsRef.current.delete(rowId)
    setRows((prev) => prev.filter((row) => row.id !== rowId))
  }, [])

  const confirmGuess = useCallback((rowId: string) => {
    userEditedIdsRef.current.add(rowId)
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId || !row.parseMetadata?.isUncertain) return row
        return {
          ...row,
          parseMetadata: {
            ...row.parseMetadata,
            isUncertain: false,
            uncertaintyReason: undefined,
            parseWarnings: row.parseMetadata.parseWarnings.filter(
              (warning) => !warning.startsWith('Uncertain:'),
            ),
          },
        }
      }),
    )
  }, [])

  const selectRemoveMatch = useCallback((rowId: string, itemId: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId || row.operation !== 'remove') return row
        if (!row.removeData || row.removeData.type !== 'unresolved') return row

        const candidate = row.removeData.candidates.find((c) => c.item.id === itemId)
        if (!candidate) return row

        const resolvedData: RemoveRowData = {
          type: 'resolved',
          matchedItemId: candidate.item.id,
          matchedItemName: candidate.item.name,
          currentQuantity: candidate.item.quantity,
          removeQuantity: row.removeData.removeQuantity,
          candidates: row.removeData.candidates,
        }

        return withDerivedStatus({
          ...row,
          removeData: resolvedData,
        })
      }),
    )
  }, [])

  const selectAddLot = useCallback(
    (rowId: string, itemId: string | null) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId || row.operation !== 'add') return row
          if (itemId == null) {
            userResolvedIdsRef.current.add(rowId)
            return withDerivedStatus({
              ...row,
              addMatch: { kind: 'new_lot' as const },
            })
          }

          const live = inventory.find((item) => item.id === itemId)
          if (live) {
            userResolvedIdsRef.current.add(rowId)
            return withDerivedStatus({
              ...row,
              addMatch: {
                kind: 'join',
                itemId: live.id,
                currentQuantity: live.quantity,
                name: live.name,
                unit: live.unit,
              },
            })
          }

          const candidates =
            row.addMatch?.kind === 'lot_choice'
              ? [row.addMatch.candidate]
              : row.addMatch?.kind === 'ambiguous'
                ? row.addMatch.candidates
                : []
          const candidate = candidates.find((entry) => entry.itemId === itemId)
          if (!candidate) return row

          userResolvedIdsRef.current.add(rowId)
          return withDerivedStatus({
            ...row,
            addMatch: {
              kind: 'join',
              itemId: candidate.itemId,
              currentQuantity: candidate.quantity,
              name: candidate.name,
              unit: candidate.unit,
            },
          })
        }),
      )
    },
    [inventory],
  )

  return {
    state: { operation, rows },
    canConfirm,
    updateRowQuantity,
    updateRowLocation,
    replaceRow,
    removeRow,
    selectRemoveMatch,
    selectAddLot,
    confirmGuess,
    unresolvedCount,
  }
}
