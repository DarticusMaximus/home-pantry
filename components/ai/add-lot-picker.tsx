'use client'

import { useId, useRef } from 'react'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import type { AddLotCandidate, BatchReviewRow } from '@/types/batch-review'

interface AddLotPickerProps {
  open: boolean
  row: BatchReviewRow | null
  locations: Array<{ id: string; name: string }>
  onSelectLot: (rowId: string, itemId: string) => void
  onNewLot: (rowId: string) => void
  onCancel: () => void
}

function candidateLabel(
  candidate: AddLotCandidate,
  locations: Array<{ id: string; name: string }>,
): string {
  const place = locations.find((location) => location.id === candidate.locationId)?.name
  const parts = [candidate.name, place, `${candidate.quantity} ${candidate.unit}`]
  if (candidate.expirationDate) {
    parts.push(candidate.expirationDate)
  }
  return parts.filter(Boolean).join(' ')
}

export function AddLotPicker({
  open,
  row,
  locations,
  onSelectLot,
  onNewLot,
  onCancel,
}: AddLotPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingId = useId()

  useFocusTrap({ open, dialogRef, onCancel })

  const candidates: AddLotCandidate[] =
    row?.addMatch?.kind === 'ambiguous' ? row.addMatch.candidates : []

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
      aria-labelledby={headingId}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-t-2xl sm:rounded-xl bg-white p-6 shadow-lg max-h-[80vh] overflow-y-auto"
      >
        <h3 id={headingId} className="mb-4 text-lg font-semibold text-gray-900">
          Choose lot
        </h3>

        {candidates.length === 0 ? (
          <p className="text-sm text-gray-500">No lots found.</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate) => {
              const place =
                locations.find((location) => location.id === candidate.locationId)?.name ??
                candidate.locationId
              return (
                <button
                  key={candidate.itemId}
                  type="button"
                  aria-label={candidateLabel(candidate, locations)}
                  onClick={() => onSelectLot(row.id, candidate.itemId)}
                  className="w-full min-h-[44px] rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">{candidate.name}</p>
                  <p className="text-xs text-gray-500">
                    {place} · {candidate.quantity} {candidate.unit}
                    {candidate.expirationDate ? ` · ${candidate.expirationDate}` : ''}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={() => onNewLot(row.id)}
            className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 font-medium text-emerald-800 hover:bg-emerald-100 min-h-[44px]"
          >
            New lot
          </button>
        </div>

        <div className="mt-2">
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
