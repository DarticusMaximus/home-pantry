'use client'

import { BackLink } from '@/components/layout/back-link'
import type { BatchOperation } from '@/types/batch-review'

interface BatchReviewHeaderProps {
  operation: BatchOperation
  unresolvedCount: number
  totalRows: number
  uncertainCount?: number
}

export function BatchReviewHeader({
  operation,
  unresolvedCount,
  totalRows,
  uncertainCount = 0,
}: BatchReviewHeaderProps) {
  const subtitle =
    operation === 'add'
      ? 'Check AI suggestions before adding them to your pantry.'
      : 'Confirm matches and quantities before removing items from your pantry.'

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <BackLink href="/ai" />
        <h1 className="text-lg font-semibold text-gray-900">Review items</h1>
      </div>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      {totalRows > 0 && unresolvedCount > 0 && (
        <p className="mt-2 text-xs font-semibold text-amber-700">
          {unresolvedCount} item{unresolvedCount !== 1 ? 's' : ''} need attention
        </p>
      )}
      {uncertainCount > 0 && (
        <p className="mt-1 text-xs text-amber-600">
          {uncertainCount} item{uncertainCount !== 1 ? 's' : ''} marked uncertain — review carefully
        </p>
      )}
    </div>
  )
}
