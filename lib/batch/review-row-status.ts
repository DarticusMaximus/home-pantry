import type { BatchReviewRow, BatchRowStatus } from '@/types/batch-review'

export const UNRESOLVED_REVIEW_STATUSES = new Set<BatchRowStatus>([
  'missing_name',
  'missing_quantity',
  'missing_unit',
  'missing_location',
  'ambiguous_match',
  'no_match',
  'error',
  'lot_choice',
])

function isBlank(value: string | undefined): boolean {
  return !value || !value.trim()
}

function rowName(row: BatchReviewRow): string {
  if (row.operation === 'add') return row.addData?.name ?? ''
  if (!row.removeData) return ''
  return row.removeData.type === 'unresolved'
    ? row.removeData.requestedName
    : row.removeData.matchedItemName
}

function rowQuantity(row: BatchReviewRow): number | undefined {
  if (row.operation === 'add') return row.addData?.quantity
  return row.removeData?.removeQuantity
}

export function deriveReviewRowStatus(row: BatchReviewRow): BatchRowStatus {
  if (isBlank(rowName(row))) return 'missing_name'

  const quantity = rowQuantity(row)
  if (quantity != null && quantity <= 0) return 'missing_quantity'

  if (row.operation === 'add') {
    if (isBlank(row.addData?.unit)) return 'missing_unit'
    if (isBlank(row.addData?.locationId)) return 'missing_location'
    if (row.addMatch?.kind === 'lot_choice') return 'lot_choice'
    if (row.addMatch?.kind === 'ambiguous') return 'ambiguous_match'
  }

  if (row.operation === 'remove' && row.removeData?.type === 'unresolved') {
    return row.removeData.candidates.length === 0 ? 'no_match' : 'ambiguous_match'
  }

  return 'ready'
}
