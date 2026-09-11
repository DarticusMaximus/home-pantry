'use client'

import { Check, CheckCircle } from 'lucide-react'
import { BatchRowStatusBadge } from '@/components/ai/batch-row-status-badge'
import { InlineLocationPicker } from '@/components/ai/inline-location-picker'
import { InlineQuantityEditor } from '@/components/ai/inline-quantity-editor'
import { formatJoinNote } from '@/lib/batch/add-lot-matching'
import type { BatchReviewRow as BatchReviewRowType } from '@/types/batch-review'

interface BatchReviewRowProps {
  row: BatchReviewRowType
  locations: Array<{ id: string; name: string }>
  onQuantityChange: (rowId: string, quantity: number) => void
  onLocationChange: (rowId: string, locationId: string) => void
  onEditDetails: (rowId: string) => void
  onChangeMatch: (rowId: string) => void
  onRemoveRow: (rowId: string) => void
  onAddToLot?: (rowId: string, itemId: string) => void
  onNewLot?: (rowId: string) => void
  onConfirmGuess?: (rowId: string) => void
  isLocked?: boolean
  emptyHouse?: boolean
}

export function BatchReviewRow({
  row,
  locations,
  onQuantityChange,
  onLocationChange,
  onEditDetails,
  onChangeMatch,
  onRemoveRow,
  onAddToLot,
  onNewLot,
  onConfirmGuess,
  isLocked = false,
  emptyHouse = false,
}: BatchReviewRowProps) {
  const itemName =
    row.addData?.name ??
    (row.removeData?.type === 'unresolved'
      ? row.removeData.requestedName
      : row.removeData?.type === 'resolved'
        ? row.removeData.matchedItemName
        : 'Unknown')

  const quantity = row.addData?.quantity ?? row.removeData?.removeQuantity ?? 0
  const unit = row.addData?.unit
  const expirationDate = row.addData?.expirationDate
  const locationId = row.addData?.locationId ?? ''
  const isRemove = row.operation === 'remove'
  const isGuessed = Boolean(row.parseMetadata?.isUncertain)
  const isKnownReady = row.status === 'ready' && !isGuessed
  const uncertainCopy = isGuessed
    ? row.parseMetadata?.uncertaintyReason
      ? `Uncertain: ${row.parseMetadata.uncertaintyReason}`
      : row.parseMetadata?.parseWarnings.find((warning) => warning.startsWith('Uncertain:'))
    : undefined
  const visibleParseWarnings = (row.parseMetadata?.parseWarnings ?? []).filter(
    (warning) => !warning.startsWith('Uncertain:'),
  )
  const locationName = locations.find((location) => location.id === locationId)?.name
  const joinMatch = row.addMatch?.kind === 'join' ? row.addMatch : null
  const lotChoiceCandidate =
    row.status === 'lot_choice' && row.addMatch?.kind === 'lot_choice'
      ? row.addMatch.candidate
      : null
  const lotChoiceLocationName = lotChoiceCandidate
    ? locations.find((location) => location.id === lotChoiceCandidate.locationId)?.name
    : undefined

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        isLocked
          ? 'border-emerald-200 opacity-70'
          : isKnownReady
            ? 'border-gray-100'
            : 'border-amber-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {isLocked && <CheckCircle className="mr-1 inline h-3.5 w-3.5 text-emerald-500" />}
            {itemName}
          </p>
          {row.removeData?.type === 'resolved' && (
            <>
              <p className="mt-0.5 text-xs text-gray-500">
                {row.removeData.matchedItemName} • {row.removeData.currentQuantity} in stock
              </p>
              {row.removeData.currentQuantity - row.removeData.removeQuantity <= 0 ? (
                <p className="mt-0.5 text-xs font-medium text-amber-700">Will be gone</p>
              ) : null}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {!isLocked && isGuessed && (
            <button
              type="button"
              onClick={() => onConfirmGuess?.(row.id)}
              aria-label="Looks right"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
            >
              <Check className="h-5 w-5" />
            </button>
          )}
          <BatchRowStatusBadge status={row.status} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {!isLocked && (
          <>
            <InlineQuantityEditor
              quantity={quantity}
              onChange={(q) => onQuantityChange(row.id, q)}
              maxQuantity={
                row.removeData?.type === 'resolved' ? row.removeData.currentQuantity : undefined
              }
            />
            {unit ? <span className="text-sm text-gray-600">{unit}</span> : null}
            {!isRemove && (
              <InlineLocationPicker
                locationId={locationId}
                locations={locations}
                onSelect={(locId) => onLocationChange(row.id, locId)}
              />
            )}
          </>
        )}
      </div>

      {expirationDate ? <p className="mt-2 text-xs text-gray-500">{expirationDate}</p> : null}

      {joinMatch ? (
        <p className="mt-2 text-xs text-gray-600">
          {formatJoinNote({
            locationName,
            name: joinMatch.name,
            currentQty: joinMatch.currentQuantity,
            addQty: quantity,
            unit: joinMatch.unit,
          })}
        </p>
      ) : null}

      {lotChoiceCandidate && !isLocked && (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-amber-700">
            {`Already in ${lotChoiceLocationName || 'pantry'} · use by ${lotChoiceCandidate.expirationDate}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAddToLot?.(row.id, lotChoiceCandidate.itemId)}
              className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 min-h-[44px] flex items-center"
            >
              Add to that lot
            </button>
            <button
              type="button"
              onClick={() => onNewLot?.(row.id)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 min-h-[44px] flex items-center"
            >
              New lot
            </button>
          </div>
        </div>
      )}

      {row.status !== 'ready' &&
        row.status !== 'error' &&
        row.status !== 'lot_choice' &&
        row.status !== 'ambiguous_match' &&
        !isLocked && (
          <p className="mt-2 text-xs text-amber-700">
            {row.status === 'missing_location' && 'Select a location to continue'}
            {row.status === 'missing_name' && 'Name is required'}
            {row.status === 'missing_quantity' && 'Quantity is required'}
            {row.status === 'missing_unit' && 'Unit is required'}
          </p>
        )}

      {isRemove &&
        !isLocked &&
        (row.status === 'ambiguous_match' || (row.status === 'no_match' && !emptyHouse)) && (
          <div className="mt-2 flex items-center gap-2">
            <p className="text-xs font-medium text-amber-700">
              {row.status === 'ambiguous_match'
                ? 'Multiple matches found'
                : 'No matching item found'}
            </p>
            <button
              type="button"
              onClick={() => onChangeMatch(row.id)}
              aria-label="Choose item"
              className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 min-h-[44px] flex items-center"
            >
              Choose item →
            </button>
          </div>
        )}

      {!isRemove && row.status === 'ambiguous_match' && !isLocked && (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-xs font-medium text-amber-700">Multiple lots found</p>
          <button
            type="button"
            onClick={() => onChangeMatch(row.id)}
            aria-label="Choose lot"
            className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 min-h-[44px] flex items-center"
          >
            Choose lot →
          </button>
        </div>
      )}

      {row.parseMetadata && !isLocked && (
        <div className="mt-1.5 space-y-0.5">
          {row.parseMetadata.sourceLine && (
            <p className="text-xs text-gray-400 italic truncate">
              Source: {row.parseMetadata.sourceLine}
            </p>
          )}
          {uncertainCopy ? <p className="text-xs text-amber-600">{uncertainCopy}</p> : null}
          {visibleParseWarnings.length > 0 && (
            <p className="text-xs text-amber-600">{visibleParseWarnings.join(', ')}</p>
          )}
        </div>
      )}

      {!isLocked && (
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => onEditDetails(row.id)}
            aria-label="Edit details"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 min-h-[44px] flex items-center"
          >
            Edit details
          </button>

          {isRemove && row.status !== 'ambiguous_match' && row.status !== 'no_match' && (
            <button
              type="button"
              onClick={() => onChangeMatch(row.id)}
              aria-label="Change match"
              className="text-xs font-medium text-gray-600 hover:text-gray-700 min-h-[44px] flex items-center"
            >
              Change match
            </button>
          )}

          <button
            type="button"
            onClick={() => onRemoveRow(row.id)}
            aria-label="Drop line"
            className="ml-auto text-xs font-medium text-red-500 hover:text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            Drop line
          </button>
        </div>
      )}
    </div>
  )
}
