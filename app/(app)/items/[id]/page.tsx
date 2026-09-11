'use client'

import { Edit, Minus, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BackLink } from '@/components/layout/back-link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton/skeleton'
import { useCategories } from '@/hooks/use-categories'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { useDeleteItem } from '@/hooks/use-item-mutations'
import { useItem } from '@/hooks/use-items'
import { useLocations } from '@/hooks/use-locations'
import { useQuantity } from '@/hooks/use-quantity'
import { deleteItem } from '@/lib/appwrite/items'
import { DELETE_RETRY_COPY } from '@/lib/household-copy'
import { zeroQuantityConfirmCopy } from '@/lib/inventory/zero-quantity-confirm'
import { daysUntilExpiration, getExpirationStatus } from '@/lib/utils/expiration'
import type { Item } from '@/types/item'

function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'Not set'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ItemDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { item, isLoading, error, refetch: refetchItem } = useItem(id)
  const showSkeleton = useDelayedLoading(isLoading)
  const { locations } = useLocations()
  const { categories } = useCategories()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isEditingQuantity, setIsEditingQuantity] = useState(false)
  const [editQuantityValue, setEditQuantityValue] = useState('')
  const [directEditError, setDirectEditError] = useState<string | null>(null)
  const [pendingZeroItem, setPendingZeroItem] = useState<Item | null>(null)
  const [isZeroConfirming, setIsZeroConfirming] = useState(false)
  const zeroConfirmInFlightRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    incrementQuantity,
    decrementQuantity,
    setQuantity,
    patchItem,
    clearPatchesOnRefetch,
    cancelPendingWrites,
    restorePendingWrites,
    error: quantityError,
  } = useQuantity(refetchItem, { onZeroIntent: setPendingZeroItem })

  const patchedItem = item ? patchItem(item) : null

  useEffect(() => {
    clearPatchesOnRefetch(item ? [item] : [])
  }, [item, clearPatchesOnRefetch])

  const handleIncrement = useCallback(() => {
    if (item) incrementQuantity(item)
  }, [item, incrementQuantity])

  const handleDecrement = useCallback(() => {
    if (item) decrementQuantity(item)
  }, [item, decrementQuantity])

  const handleQuantityTap = useCallback(() => {
    if (!patchedItem) return
    setDirectEditError(null)
    setEditQuantityValue(String(patchedItem.quantity))
    setIsEditingQuantity(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }, [patchedItem])

  const commitDirectInput = useCallback(async () => {
    if (!item || !patchedItem) return
    setIsEditingQuantity(false)
    const parsed = parseFloat(editQuantityValue)
    if (isNaN(parsed) || parsed < 0 || editQuantityValue.trim() === '') {
      setDirectEditError('Quantity must be a positive number')
      return
    }
    setDirectEditError(null)
    if (parsed === 0) {
      setPendingZeroItem(patchedItem)
      return
    }
    if (parsed === patchedItem.quantity) return
    await setQuantity(item, parsed)
  }, [item, patchedItem, editQuantityValue, setQuantity])

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitDirectInput()
      } else if (e.key === 'Escape') {
        setIsEditingQuantity(false)
      }
    },
    [commitDirectInput],
  )

  const deleteMutation = useDeleteItem(() => {
    setShowDeleteDialog(false)
    router.push('/')
  })

  const locationName = item ? locations.find((l) => l.id === item.locationId)?.name : ''
  const categoryName =
    item && item.categoryId ? categories.find((c) => c.id === item.categoryId)?.name : ''
  const category = item && item.categoryId ? categories.find((c) => c.id === item.categoryId) : null
  const expirationStatus = item ? getExpirationStatus(item.expirationDate) : null
  const expirationDays = item?.expirationDate ? daysUntilExpiration(item.expirationDate) : null

  const handleDelete = async () => {
    setDeleteError(null)
    try {
      await deleteMutation.mutate(id)
    } catch {
      setDeleteError(DELETE_RETRY_COPY)
      setShowDeleteDialog(false)
    }
  }

  const handleZeroConfirm = useCallback(async () => {
    if (!pendingZeroItem || zeroConfirmInFlightRef.current) return
    zeroConfirmInFlightRef.current = true
    setIsZeroConfirming(true)
    try {
      cancelPendingWrites(pendingZeroItem.id)
      await deleteItem(pendingZeroItem.id)
      setPendingZeroItem(null)
      router.push('/')
    } catch {
      setPendingZeroItem(null)
      setDeleteError('Failed to update. Try again.')
    } finally {
      zeroConfirmInFlightRef.current = false
      setIsZeroConfirming(false)
    }
  }, [pendingZeroItem, cancelPendingWrites, router])

  const zeroCopy = pendingZeroItem ? zeroQuantityConfirmCopy(pendingZeroItem.name) : null

  if (showSkeleton) {
    return (
      <div className="p-4 pb-24">
        <div className="mb-6 flex items-center gap-2">
          <BackLink href="/" />
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-11 w-11 rounded-lg" />
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-11 w-11 rounded-lg" />
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 pb-24">
        <div className="mb-6 flex items-center gap-2">
          <BackLink href="/" />
          <h1 className="text-xl font-semibold text-gray-900">Item Detail</h1>
        </div>
        <div className="rounded-xl bg-red-50 p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load item</p>
          <p className="mt-1 text-sm text-red-500">
            Something went wrong loading this item. Try again to reload.
          </p>
          <button
            type="button"
            onClick={() => refetchItem()}
            className="mt-4 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="mt-2 inline-block font-semibold text-emerald-600 hover:underline"
          >
            Go back home
          </Link>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="p-4 pb-24">
        <div className="mb-6 flex items-center gap-2">
          <BackLink href="/" />
          <h1 className="text-xl font-semibold text-gray-900">Item Detail</h1>
        </div>
        <div className="rounded-xl bg-gray-50 p-6 text-center">
          <p className="text-gray-500 font-medium">Item not found</p>
          <p className="mt-1 text-sm text-gray-400">
            This item may have been deleted or doesn't exist.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block font-semibold text-emerald-600 hover:underline"
          >
            Go back home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BackLink href="/" />
          <h1 className="text-xl font-semibold text-gray-900">{item.name}</h1>
        </div>
        <Link
          href={`/items/${id}/edit`}
          aria-label="Edit"
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Edit className="h-5 w-5" />
        </Link>
      </div>

      {deleteError && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{deleteError}</div>
      )}

      {(quantityError || directEditError) && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {quantityError || directEditError}
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDecrement}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0"
              aria-label="Decrease quantity by 1"
            >
              <Minus className="h-5 w-5" />
            </button>

            <div className="flex-1 text-center">
              {isEditingQuantity ? (
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  step="any"
                  value={editQuantityValue}
                  onChange={(e) => setEditQuantityValue(e.target.value)}
                  onBlur={commitDirectInput}
                  onKeyDown={handleInputKeyDown}
                  className="w-24 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-2xl font-bold text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={handleQuantityTap}
                  className="inline-block rounded-lg bg-emerald-50 px-4 py-1.5 text-2xl font-bold text-gray-900 hover:bg-emerald-100 transition-colors"
                  aria-label="Tap to edit quantity"
                >
                  {patchedItem!.quantity} {patchedItem!.unit}
                </button>
              )}
              <p className="text-sm text-gray-500 mt-1">Quantity</p>
            </div>

            <button
              type="button"
              onClick={handleIncrement}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors flex-shrink-0"
              aria-label="Increase quantity by 1"
            >
              <Plus className="h-5 w-5" />
            </button>

            {expirationStatus && !isEditingQuantity && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
                  expirationStatus === 'expired'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {expirationStatus === 'expired'
                  ? `Expired ${expirationDays !== null ? `${Math.abs(expirationDays)} day${Math.abs(expirationDays) !== 1 ? 's' : ''} ago` : ''}`
                  : expirationDays !== null && expirationDays === 0
                    ? 'Expires today'
                    : `Expires in ${expirationDays} day${expirationDays !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <h2 className="mb-3 text-sm font-medium text-gray-500">Details</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Location</span>
              <span className="font-medium text-gray-900">{locationName || 'Unknown'}</span>
            </div>
            {categoryName && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Category</span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: category?.color ? `${category.color}20` : '#f3f4f6',
                    color: category?.color || '#374151',
                  }}
                >
                  {categoryName}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Purchase Date</span>
              <span className="text-gray-900">{formatDate(item.purchaseDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Expiration Date</span>
              <span className="text-gray-900">{formatDate(item.expirationDate)}</span>
            </div>
          </div>
        </div>

        {item.notes && (
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <h2 className="mb-2 text-sm font-medium text-gray-500">Notes</h2>
            <p className="text-gray-900 whitespace-pre-wrap">{item.notes}</p>
          </div>
        )}

        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <h2 className="mb-3 text-sm font-medium text-gray-500">History</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Created</span>
              <span className="text-sm text-gray-900">{formatDate(item.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Last Updated</span>
              <span className="text-sm text-gray-900">{formatDate(item.updatedAt)}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-red-600 font-medium hover:bg-red-100 transition-colors min-h-[44px]"
        >
          <Trash2 className="h-5 w-5" />
          Delete Item
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Item"
        description="Are you sure you want to delete this item? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isLoading}
        variant="destructive"
      />
      <ConfirmDialog
        open={pendingZeroItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (!zeroConfirmInFlightRef.current && pendingZeroItem) {
              restorePendingWrites(pendingZeroItem.id)
            }
            setPendingZeroItem(null)
          }
        }}
        title={zeroCopy?.title ?? ''}
        description={zeroCopy?.description ?? ''}
        confirmText={zeroCopy?.confirmText ?? 'Remove'}
        onConfirm={handleZeroConfirm}
        isLoading={isZeroConfirming}
        variant="destructive"
      />
    </div>
  )
}
