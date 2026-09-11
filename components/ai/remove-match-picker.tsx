'use client'

import { useRef } from 'react'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import type { BatchReviewRow, RemoveCandidate } from '@/types/batch-review'

interface RemoveMatchPickerProps {
  open: boolean
  row: BatchReviewRow | null
  onSelect: (rowId: string, itemId: string) => void
  onCancel: () => void
}

export function RemoveMatchPicker({ open, row, onSelect, onCancel }: RemoveMatchPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useFocusTrap({ open, dialogRef, onCancel })

  const candidates: RemoveCandidate[] =
    row?.removeData?.type === 'unresolved'
      ? row.removeData.candidates
      : row?.removeData?.type === 'resolved'
        ? row.removeData.candidates
        : []

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel()
    }
  }

  if (!open || !row) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Select match"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-t-2xl sm:rounded-xl bg-white p-6 shadow-lg max-h-[80vh] overflow-y-auto"
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Select match</h3>

        {candidates.length === 0 ? (
          <p className="text-sm text-gray-500">No candidates found.</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate) => (
              <button
                key={candidate.item.id}
                type="button"
                aria-label={`${candidate.item.name} ${candidate.item.quantity} ${candidate.item.unit}`}
                onClick={() => onSelect(row.id, candidate.item.id)}
                className="w-full min-h-[44px] rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{candidate.item.name}</p>
                <p className="text-xs text-gray-500">
                  Qty: {candidate.item.quantity} {candidate.item.unit} • Score:{' '}
                  {Math.round(candidate.score * 100)}%
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
