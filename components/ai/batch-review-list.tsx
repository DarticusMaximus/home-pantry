'use client'

import { useMemo } from 'react'
import { BatchReviewRow } from '@/components/ai/batch-review-row'
import { UNRESOLVED_REVIEW_STATUSES } from '@/lib/batch/review-row-status'
import type { BatchReviewRow as BatchReviewRowType } from '@/types/batch-review'

interface BatchReviewListProps {
  rows: BatchReviewRowType[]
  locations: Array<{ id: string; name: string }>
  onQuantityChange: (rowId: string, quantity: number) => void
  onLocationChange: (rowId: string, locationId: string) => void
  onEditDetails: (rowId: string) => void
  onChangeMatch: (rowId: string) => void
  onRemoveRow: (rowId: string) => void
  onAddToLot?: (rowId: string, itemId: string) => void
  onNewLot?: (rowId: string) => void
  onConfirmGuess?: (rowId: string) => void
  lockedRowIds?: Set<string>
  emptyHouse?: boolean
}

export function BatchReviewList({
  rows,
  locations,
  onQuantityChange,
  onLocationChange,
  onEditDetails,
  onChangeMatch,
  onRemoveRow,
  onAddToLot,
  onNewLot,
  onConfirmGuess,
  lockedRowIds,
  emptyHouse = false,
}: BatchReviewListProps) {
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aUnresolved = UNRESOLVED_REVIEW_STATUSES.has(a.status)
      const bUnresolved = UNRESOLVED_REVIEW_STATUSES.has(b.status)
      if (aUnresolved && !bUnresolved) return -1
      if (!aUnresolved && bUnresolved) return 1
      return 0
    })
  }, [rows])

  return (
    <ul className="space-y-3" aria-label="Review items list">
      {sortedRows.map((row) => (
        <li key={row.id}>
          <BatchReviewRow
            row={row}
            locations={locations}
            onQuantityChange={onQuantityChange}
            onLocationChange={onLocationChange}
            onEditDetails={onEditDetails}
            onChangeMatch={onChangeMatch}
            onRemoveRow={onRemoveRow}
            onAddToLot={onAddToLot}
            onNewLot={onNewLot}
            onConfirmGuess={onConfirmGuess}
            isLocked={lockedRowIds?.has(row.id) ?? false}
            emptyHouse={emptyHouse}
          />
        </li>
      ))}
    </ul>
  )
}
