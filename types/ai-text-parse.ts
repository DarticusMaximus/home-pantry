import type { BatchReviewRow } from '@/types/batch-review'

export interface ParsedTextItem {
  name: string
  quantity: number | null
  unit: string | null
  categoryName: string | null
  explicitLocationName: string | null
  expirationHint: string | null
  sourceLine: string | null
  isUncertain: boolean
  uncertaintyReason: string | null
}

export interface ParsedTextPayload {
  items: ParsedTextItem[]
  ignoredLines: string[]
}

export type ParseTextResult =
  | {
      ok: true
      operation: 'add' | 'remove'
      rows: BatchReviewRow[]
      warnings: string[]
      rawText: string
    }
  | {
      ok: false
      reason:
        | 'empty_input'
        | 'empty_inventory'
        | 'no_usable_items'
        | 'provider_error'
        | 'invalid_response'
        | 'unauthenticated'
      message: string
    }
