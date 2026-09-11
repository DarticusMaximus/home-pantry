export type BatchOperation = 'add' | 'remove'

export type BatchRowStatus =
  | 'ready'
  | 'missing_name'
  | 'missing_quantity'
  | 'missing_unit'
  | 'missing_location'
  | 'ambiguous_match'
  | 'no_match'
  | 'lot_choice'
  | 'error'

export interface BatchSource {
  source: 'ai_text' | 'ai_image' | 'manual'
  raw: string
}

export interface AddRowData {
  name: string
  quantity: number
  unit: string
  locationId: string
  templateId?: string
  categoryId?: string
  expirationDate?: string
  pasteExpirationDate?: string | null
  purchaseDate?: string
  notes?: string
}

export interface RemoveCandidate {
  item: {
    id: string
    name: string
    quantity: number
    unit: string
    locationId: string
  }
  score: number
}

export type RemoveRowData =
  | {
      type: 'resolved'
      matchedItemId: string
      matchedItemName: string
      currentQuantity: number
      removeQuantity: number
      candidates: RemoveCandidate[]
    }
  | {
      type: 'unresolved'
      requestedName: string
      removeQuantity: number
      candidates: RemoveCandidate[]
    }

export interface BatchRowParseMetadata {
  sourceLine?: string
  parseWarnings: string[]
  isUncertain: boolean
  uncertaintyReason?: string
}

export interface AddLotCandidate {
  itemId: string
  name: string
  locationId: string
  quantity: number
  unit: string
  expirationDate?: string
}

export type AddLotMatch =
  | {
      kind: 'join'
      itemId: string
      currentQuantity: number
      name: string
      unit: string
    }
  | {
      kind: 'new_lot'
    }
  | {
      kind: 'lot_choice'
      candidate: AddLotCandidate
    }
  | {
      kind: 'ambiguous'
      candidates: AddLotCandidate[]
    }

export interface BatchReviewRow {
  id: string
  operation: BatchOperation
  status: BatchRowStatus
  source: BatchSource
  addData?: AddRowData
  removeData?: RemoveRowData
  addMatch?: AddLotMatch
  parseMetadata?: BatchRowParseMetadata
}

export interface BatchReviewState {
  operation: BatchOperation
  rows: BatchReviewRow[]
}

export interface BatchSubmitSummary {
  total: number
  succeeded: number
  failed: number
  failures: Array<{
    rowId: string
    error: string
  }>
}
