'use client'

import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'
import { AddLotPicker } from '@/components/ai/add-lot-picker'
import { BatchConfirmBar } from '@/components/ai/batch-confirm-bar'
import { BatchResultSummary } from '@/components/ai/batch-result-summary'
import { BatchReviewHeader } from '@/components/ai/batch-review-header'
import { BatchReviewList } from '@/components/ai/batch-review-list'
import { BatchRowEditor } from '@/components/ai/batch-row-editor'
import { RemoveMatchPicker } from '@/components/ai/remove-match-picker'
import { useBatchReview } from '@/hooks/use-batch-review'
import type { BatchOperation, BatchReviewRow, BatchSubmitSummary } from '@/types/batch-review'
import type { Item } from '@/types/item'

const EMPTY_ITEMS: Item[] = []

interface BatchReviewScreenProps {
  operation: BatchOperation
  initialRows: BatchReviewRow[]
  locations: Array<{ id: string; name: string }>
  items?: Item[]
  isLoading?: boolean
  onSubmit: (operation: BatchOperation, rows: BatchReviewRow[]) => Promise<BatchSubmitSummary>
  onDone: () => void
}

const SESSION_ENDED = 'Your session ended. Please sign in again.'
const SAVE_FAILED = "Couldn't save right now — try again."

function displayThrownMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  if (message === SESSION_ENDED) return SESSION_ENDED
  return SAVE_FAILED
}

function createFailureResult(rows: BatchReviewRow[], error: unknown): BatchSubmitSummary {
  const message = displayThrownMessage(error)
  return {
    total: rows.length,
    succeeded: 0,
    failed: rows.length,
    failures: rows.map((row) => ({ rowId: row.id, error: message })),
  }
}

export function BatchReviewScreen({
  operation,
  initialRows,
  locations,
  items = EMPTY_ITEMS,
  isLoading = false,
  onSubmit,
  onDone,
}: BatchReviewScreenProps) {
  const {
    state,
    canConfirm,
    updateRowQuantity,
    updateRowLocation,
    replaceRow,
    removeRow,
    selectRemoveMatch,
    selectAddLot,
    confirmGuess,
    unresolvedCount,
  } = useBatchReview(operation, initialRows, items, isLoading)

  const isEmptyHouse = operation === 'remove' && !isLoading && items.length === 0

  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [matchPickerRowId, setMatchPickerRowId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<BatchSubmitSummary | null>(null)
  const [lockedRowIds, setLockedRowIds] = useState<Set<string>>(new Set())
  const submitInFlightRef = useRef(false)
  const inFlightRowIdsRef = useRef<Set<string>>(new Set())

  const editingRow = editingRowId ? (state.rows.find((r) => r.id === editingRowId) ?? null) : null
  const matchPickerRow = matchPickerRowId
    ? (state.rows.find((r) => r.id === matchPickerRowId) ?? null)
    : null

  const handleEditDetails = useCallback((rowId: string) => {
    setEditingRowId(rowId)
  }, [])

  const handleEditorSave = useCallback(
    (rowId: string, updatedRow: BatchReviewRow) => {
      replaceRow(rowId, updatedRow)
      setEditingRowId(null)
    },
    [replaceRow],
  )

  const handleEditorCancel = useCallback(() => {
    setEditingRowId(null)
  }, [])

  const handleChangeMatch = useCallback((rowId: string) => {
    setMatchPickerRowId(rowId)
  }, [])

  const handleMatchSelect = useCallback(
    (rowId: string, itemId: string) => {
      selectRemoveMatch(rowId, itemId)
      setMatchPickerRowId(null)
    },
    [selectRemoveMatch],
  )

  const handleSelectLot = useCallback(
    (rowId: string, itemId: string) => {
      selectAddLot(rowId, itemId)
      setMatchPickerRowId(null)
    },
    [selectAddLot],
  )

  const handleAddToLot = useCallback(
    (rowId: string, itemId: string) => {
      selectAddLot(rowId, itemId)
    },
    [selectAddLot],
  )

  const handleNewLot = useCallback(
    (rowId: string) => {
      selectAddLot(rowId, null)
      setMatchPickerRowId(null)
    },
    [selectAddLot],
  )

  const handleMatchCancel = useCallback(() => {
    setMatchPickerRowId(null)
  }, [])

  const handleRemoveRow = useCallback(
    (rowId: string) => {
      if (inFlightRowIdsRef.current.has(rowId)) return
      removeRow(rowId)
    },
    [removeRow],
  )

  const handleConfirm = useCallback(async () => {
    if (!canConfirm || submitInFlightRef.current) return
    submitInFlightRef.current = true
    inFlightRowIdsRef.current = new Set(state.rows.map((row) => row.id))
    setIsSubmitting(true)
    try {
      const result = await onSubmit(operation, state.rows)
      setSubmitResult(result)

      const succeededIds = new Set<string>()
      const failedIds = new Set(result.failures.map((f) => f.rowId))
      for (const row of state.rows) {
        if (!failedIds.has(row.id)) {
          succeededIds.add(row.id)
        }
      }
      setLockedRowIds(succeededIds)
    } catch (error) {
      console.error('Batch submission failed', error)
      setSubmitResult(createFailureResult(state.rows, error))
    } finally {
      submitInFlightRef.current = false
      inFlightRowIdsRef.current = new Set()
      setIsSubmitting(false)
    }
  }, [canConfirm, onSubmit, operation, state.rows])

  const handleRetry = useCallback(async () => {
    if (submitInFlightRef.current) return
    const failedRows = state.rows.filter((r) => !lockedRowIds.has(r.id))
    if (failedRows.length === 0) return

    submitInFlightRef.current = true
    inFlightRowIdsRef.current = new Set(failedRows.map((row) => row.id))
    setIsSubmitting(true)
    try {
      const result = await onSubmit(operation, failedRows)
      setSubmitResult(result)

      setLockedRowIds((prev) => {
        const next = new Set(prev)
        for (const row of failedRows) {
          if (!result.failures.some((f) => f.rowId === row.id)) {
            next.add(row.id)
          }
        }
        return next
      })
    } catch (error) {
      console.error('Batch retry failed', error)
      setSubmitResult(createFailureResult(failedRows, error))
    } finally {
      submitInFlightRef.current = false
      inFlightRowIdsRef.current = new Set()
      setIsSubmitting(false)
    }
  }, [state.rows, lockedRowIds, onSubmit, operation])

  const uncertainCount = state.rows.filter((r) => r.parseMetadata?.isUncertain).length

  if (state.rows.length === 0) {
    return (
      <div className="p-4">
        <BatchReviewHeader operation={operation} unresolvedCount={0} totalRows={0} />
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-900">No items to review</p>
          <p className="mt-1 text-xs text-gray-500">Add items before confirming.</p>
          <Link
            href="/ai"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Go to Add
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-confirm">
      <BatchReviewHeader
        operation={operation}
        unresolvedCount={unresolvedCount}
        totalRows={state.rows.length}
        uncertainCount={uncertainCount}
      />

      {isEmptyHouse ? (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <p>Nothing to remove.</p>
        </div>
      ) : null}

      <BatchReviewList
        rows={state.rows}
        locations={locations}
        onQuantityChange={updateRowQuantity}
        onLocationChange={updateRowLocation}
        onEditDetails={handleEditDetails}
        onChangeMatch={handleChangeMatch}
        onRemoveRow={handleRemoveRow}
        onAddToLot={handleAddToLot}
        onNewLot={handleNewLot}
        onConfirmGuess={confirmGuess}
        lockedRowIds={
          isSubmitting
            ? new Set([...lockedRowIds, ...state.rows.map((row) => row.id)])
            : lockedRowIds
        }
        emptyHouse={isEmptyHouse}
      />

      {submitResult ? (
        <BatchResultSummary
          summary={submitResult}
          operation={operation}
          rows={state.rows}
          onRetry={submitResult.failed > 0 ? handleRetry : undefined}
          onDone={onDone}
          isSubmitting={isSubmitting}
        />
      ) : (
        <BatchConfirmBar
          operation={operation}
          canConfirm={canConfirm}
          unresolvedCount={unresolvedCount}
          onConfirm={handleConfirm}
          isLoading={isSubmitting}
        />
      )}

      <BatchRowEditor
        open={editingRowId !== null}
        row={editingRow}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
      />

      <RemoveMatchPicker
        open={matchPickerRow?.operation === 'remove' && matchPickerRowId !== null}
        row={matchPickerRow}
        onSelect={handleMatchSelect}
        onCancel={handleMatchCancel}
      />

      <AddLotPicker
        open={matchPickerRow?.operation === 'add' && matchPickerRowId !== null}
        row={matchPickerRow}
        locations={locations}
        onSelectLot={handleSelectLot}
        onNewLot={handleNewLot}
        onCancel={handleMatchCancel}
      />
    </div>
  )
}
