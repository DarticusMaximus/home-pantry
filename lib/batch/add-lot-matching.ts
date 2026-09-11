import { singularize } from '@/lib/ai/utils'
import type { AddLotCandidate, AddLotMatch, AddRowData, BatchReviewRow } from '@/types/batch-review'
import type { Item } from '@/types/item'

export type MatchAddLotInput = Pick<AddRowData, 'name' | 'unit' | 'locationId' | 'expirationDate'>

export type AddLotMatchResult =
  | { status: 'missing_location'; addMatch?: undefined }
  | { status: 'ambiguous_match'; addMatch: Extract<AddLotMatch, { kind: 'ambiguous' }> }
  | { status: 'lot_choice'; addMatch: Extract<AddLotMatch, { kind: 'lot_choice' }> }
  | { status: 'ready'; addMatch: Extract<AddLotMatch, { kind: 'join' | 'new_lot' }> }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeName(name: string): string {
  return singularize(name.trim().toLowerCase())
}

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase()
}

function normalizeExpiry(value: string | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed || !DATE_PATTERN.test(trimmed)) return null
  return trimmed
}

function toCandidate(item: Item): AddLotCandidate {
  const expiry = normalizeExpiry(item.expirationDate)
  return {
    itemId: item.id,
    name: item.name,
    locationId: item.locationId,
    quantity: item.quantity,
    unit: item.unit,
    ...(expiry ? { expirationDate: expiry } : {}),
  }
}

function isNamePlaceUnitMatch(add: MatchAddLotInput, item: Item): boolean {
  return (
    normalizeName(add.name) === normalizeName(item.name) &&
    add.locationId === item.locationId &&
    normalizeUnit(add.unit) === normalizeUnit(item.unit)
  )
}

function isCompatibleExpiry(addExpiry: string | null, liveExpiry: string | null): boolean {
  if (addExpiry === null && liveExpiry === null) return true
  return addExpiry !== null && liveExpiry !== null && addExpiry === liveExpiry
}

export function matchAddLot(add: MatchAddLotInput, inventory: Item[]): AddLotMatchResult {
  if (!add.locationId.trim()) {
    return { status: 'missing_location' }
  }

  const sameNamePlaceUnit = inventory.filter((item) => isNamePlaceUnitMatch(add, item))

  if (sameNamePlaceUnit.length >= 2) {
    return {
      status: 'ambiguous_match',
      addMatch: {
        kind: 'ambiguous',
        candidates: sameNamePlaceUnit.map(toCandidate),
      },
    }
  }

  if (sameNamePlaceUnit.length === 1) {
    const live = sameNamePlaceUnit[0]
    const addExpiry = normalizeExpiry(add.expirationDate)
    const liveExpiry = normalizeExpiry(live.expirationDate)

    if (isCompatibleExpiry(addExpiry, liveExpiry)) {
      return {
        status: 'ready',
        addMatch: {
          kind: 'join',
          itemId: live.id,
          currentQuantity: live.quantity,
          name: live.name,
          unit: live.unit,
        },
      }
    }

    if (addExpiry === null && liveExpiry !== null) {
      return {
        status: 'lot_choice',
        addMatch: {
          kind: 'lot_choice',
          candidate: toCandidate(live),
        },
      }
    }
  }

  return { status: 'ready', addMatch: { kind: 'new_lot' } }
}

function candidateEquals(a: AddLotCandidate, b: AddLotCandidate): boolean {
  return (
    a.itemId === b.itemId &&
    a.name === b.name &&
    a.locationId === b.locationId &&
    a.quantity === b.quantity &&
    a.unit === b.unit &&
    a.expirationDate === b.expirationDate
  )
}

function addMatchEquals(a?: AddLotMatch, b?: AddLotMatch): boolean {
  if (a === b) return true
  if (!a || !b) return !a && !b
  if (a.kind !== b.kind) return false
  if (a.kind === 'new_lot') return true
  if (a.kind === 'join' && b.kind === 'join') {
    return (
      a.itemId === b.itemId &&
      a.currentQuantity === b.currentQuantity &&
      a.name === b.name &&
      a.unit === b.unit
    )
  }
  if (a.kind === 'lot_choice' && b.kind === 'lot_choice') {
    return candidateEquals(a.candidate, b.candidate)
  }
  if (a.kind === 'ambiguous' && b.kind === 'ambiguous') {
    return (
      a.candidates.length === b.candidates.length &&
      a.candidates.every((candidate, index) => candidateEquals(candidate, b.candidates[index]))
    )
  }
  return false
}

export function applyAddLotMatchToRow(row: BatchReviewRow, inventory: Item[]): BatchReviewRow {
  if (row.operation !== 'add' || !row.addData) return row
  const identityExpiry =
    row.addData.pasteExpirationDate !== undefined
      ? (row.addData.pasteExpirationDate ?? undefined)
      : row.addData.expirationDate
  const result = matchAddLot(
    {
      name: row.addData.name,
      unit: row.addData.unit,
      locationId: row.addData.locationId,
      expirationDate: identityExpiry,
    },
    inventory,
  )
  if (row.status === result.status && addMatchEquals(row.addMatch, result.addMatch)) {
    return row
  }
  return {
    ...row,
    status: result.status,
    addMatch: result.addMatch,
  }
}

export function formatJoinNote(params: {
  locationName?: string
  name: string
  currentQty: number
  addQty: number
  unit: string
}): string {
  const newQty = params.currentQty + params.addQty
  const locationName = params.locationName?.trim()
  if (locationName) {
    return `${locationName} ${params.name}, ${params.currentQty} ${params.unit} → ${newQty} ${params.unit}`
  }
  return `${params.name}, ${params.currentQty} ${params.unit} → ${newQty} ${params.unit}`
}
