import type { BatchOperation, BatchReviewRow } from '@/types/batch-review'

export interface BatchReviewDraft {
  operation: BatchOperation
  rows: BatchReviewRow[]
  source: {
    type: 'ai_text' | 'ai_image'
    raw: string
  }
  savedAt: string
}

const STORAGE_KEY = 'home-pantry-batch-review-draft'

function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

function isValidDraft(value: unknown): value is BatchReviewDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>

  if (draft.operation !== 'add' && draft.operation !== 'remove') return false
  if (!Array.isArray(draft.rows)) return false
  if (typeof draft.source !== 'object' || draft.source === null) return false
  const source = draft.source as Record<string, unknown>
  if (source.type !== 'ai_text' && source.type !== 'ai_image') return false
  if (typeof source.raw !== 'string') return false
  if (typeof draft.savedAt !== 'string') return false

  return true
}

export function saveBatchReviewDraft(draft: BatchReviewDraft): void {
  if (!isStorageAvailable()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function loadBatchReviewDraft(): BatchReviewDraft | null {
  if (!isStorageAvailable()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isValidDraft(parsed)) {
      clearBatchReviewDraft()
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearBatchReviewDraft(): void {
  if (!isStorageAvailable()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silently fail
  }
}
