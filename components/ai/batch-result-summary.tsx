'use client'

import { AlertTriangle, CheckCircle } from 'lucide-react'
import type { BatchOperation, BatchReviewRow, BatchSubmitSummary } from '@/types/batch-review'

interface BatchResultSummaryProps {
  summary: BatchSubmitSummary
  operation: BatchOperation
  rows: BatchReviewRow[]
  onRetry?: () => void
  onDone: () => void
  isSubmitting?: boolean
}

function rowDisplayName(row: BatchReviewRow | undefined): string {
  if (!row) return 'Unknown'
  if (row.addData?.name) return row.addData.name
  if (row.removeData?.type === 'unresolved') return row.removeData.requestedName
  if (row.removeData?.type === 'resolved') return row.removeData.matchedItemName
  return 'Unknown'
}

export function BatchResultSummary({
  summary,
  operation,
  rows,
  onRetry,
  onDone,
  isSubmitting = false,
}: BatchResultSummaryProps) {
  const isFullSuccess = summary.failed === 0
  const noun = summary.succeeded === 1 ? 'item' : 'items'
  const verb = operation === 'remove' ? 'removed' : 'added'

  if (isFullSuccess) {
    return (
      <div
        aria-live="polite"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center"
      >
        <CheckCircle className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="mt-3 text-sm font-semibold text-emerald-900">
          {summary.succeeded} {noun} {verb}
        </p>
        <button
          type="button"
          onClick={onDone}
          className="mt-4 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div
      aria-live="polite"
      className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm"
    >
      <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
      <p className="mt-3 text-sm font-semibold text-gray-900">
        {summary.succeeded} of {summary.total} items processed successfully
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {summary.failed} {summary.failed === 1 ? 'item' : 'items'} could not be processed
      </p>

      <ul className="mt-3 space-y-1 text-left">
        {summary.failures.map((f) => {
          const row = rows.find((r) => r.id === f.rowId)
          return (
            <li key={f.rowId} className="text-xs text-red-600">
              {rowDisplayName(row)}: {f.error}
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex flex-col gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isSubmitting}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Retry failed items
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
