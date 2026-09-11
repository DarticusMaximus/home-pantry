export interface ParsedImageItem {
  name: string
  quantity: number | null
  unit: string | null
  categoryName: string | null
  explicitLocationName: string | null
  expirationHint: string | null
  isUncertain: boolean
  uncertaintyReason: string | null
  notes: string | null
}

export interface SkippedObject {
  name?: string
  reason: string
}

export interface ParsedImageResult {
  items: ParsedImageItem[]
  skippedObjects: SkippedObject[]
  imageSummary: string
}

export type ScanImageResult =
  | {
      ok: true
      operation: 'add' | 'remove'
      rows: import('@/types/batch-review').BatchReviewRow[]
      warnings: string[]
      imageSummary: string
    }
  | {
      ok: false
      reason:
        | 'invalid_image'
        | 'no_usable_items'
        | 'provider_error'
        | 'invalid_response'
        | 'empty_inventory'
        | 'unauthenticated'
      message: string
    }
