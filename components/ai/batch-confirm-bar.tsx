'use client'

import type { BatchOperation } from '@/types/batch-review'

interface BatchConfirmBarProps {
  operation: BatchOperation
  canConfirm: boolean
  unresolvedCount: number
  onConfirm: () => void
  isLoading?: boolean
}

export function BatchConfirmBar({
  operation,
  canConfirm,
  unresolvedCount,
  onConfirm,
  isLoading = false,
}: BatchConfirmBarProps) {
  const ctaLabel = operation === 'add' ? 'Add to Pantry' : 'Remove from Pantry'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white px-4 pt-3 pb-confirm-bar">
      <div className="mx-auto max-w-lg">
        {!canConfirm && (
          <p className="mb-2 text-center text-xs font-medium text-amber-700">
            Resolve all items to continue
          </p>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || isLoading}
          className={`w-full rounded-xl py-3 text-sm font-semibold text-white min-h-[44px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            operation === 'add'
              ? 'bg-emerald-500 hover:bg-emerald-600'
              : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {isLoading ? 'Processing...' : ctaLabel}
        </button>
        {unresolvedCount > 0 && (
          <p className="mt-1 text-center text-xs text-gray-500">
            {unresolvedCount} item{unresolvedCount !== 1 ? 's' : ''} still need attention
          </p>
        )}
      </div>
    </div>
  )
}
