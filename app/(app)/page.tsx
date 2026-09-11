'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DashboardLaunchpad } from '@/components/home/dashboard-launchpad'
import { FilterChips } from '@/components/home/filter-chips'
import { SearchBar } from '@/components/home/search-bar'
import { SearchResults } from '@/components/home/search-results'
import { CannotReachPantry } from '@/components/ui/cannot-reach-pantry'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSearchMode } from '@/contexts/search-mode-context'
import { useCategories } from '@/hooks/use-categories'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { useItems } from '@/hooks/use-items'
import { useLocations } from '@/hooks/use-locations'
import { useQuantity } from '@/hooks/use-quantity'
import { useSearchItems } from '@/hooks/use-search'
import { deleteItem } from '@/lib/appwrite/items'
import { zeroQuantityConfirmCopy } from '@/lib/inventory/zero-quantity-confirm'
import { isExpiringSoon } from '@/lib/utils/expiration'
import type { Item } from '@/types/item'

export default function HomePage() {
  const router = useRouter()
  const { items, isLoading: itemsLoading, error: itemsError, refetch: refetchItems } = useItems()
  const {
    locations,
    isLoading: locationsLoading,
    error: locationsError,
    refetch: refetchLocations,
  } = useLocations()
  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCategories()
  const { isSearching, setIsSearching, registerClearFilters, focusField, clearFocusField } =
    useSearchMode()
  const [pendingZeroItem, setPendingZeroItem] = useState<Item | null>(null)
  const [zeroDeleteError, setZeroDeleteError] = useState<string | null>(null)
  const [isZeroConfirming, setIsZeroConfirming] = useState(false)
  const zeroConfirmInFlightRef = useRef(false)
  const {
    incrementQuantity,
    decrementQuantity,
    partialUse,
    patchItems,
    clearPatchesOnRefetch,
    cancelPendingWrites,
    restorePendingWrites,
    error: quantityError,
  } = useQuantity(refetchItems, { onZeroIntent: setPendingZeroItem })

  const patchedItems = useMemo(() => patchItems(items), [patchItems, items])
  const searchState = useSearchItems(patchedItems)

  useEffect(() => {
    clearPatchesOnRefetch(items)
  }, [items, clearPatchesOnRefetch])

  useEffect(() => {
    registerClearFilters(searchState.clearFilters)
  }, [searchState.clearFilters, registerClearFilters])

  const hasListError = itemsError !== null || locationsError !== null || categoriesError !== null
  const listsInFlight = itemsLoading || locationsLoading || categoriesLoading
  const [holdUnreachable, setHoldUnreachable] = useState(false)
  if (hasListError && !holdUnreachable) {
    setHoldUnreachable(true)
  } else if (!hasListError && !listsInFlight && holdUnreachable) {
    setHoldUnreachable(false)
  }
  const pantryUnreachable = hasListError || holdUnreachable
  const isLoading = listsInFlight
  const showSkeleton = useDelayedLoading(isLoading && !pantryUnreachable)

  const handleRetryPantry = useCallback(() => {
    refetchItems()
    refetchLocations()
    refetchCategories()
  }, [refetchItems, refetchLocations, refetchCategories])

  const expiringCount = patchedItems.filter((item) => isExpiringSoon(item.expirationDate)).length

  const handleClear = useCallback(() => {
    searchState.clearFilters()
  }, [searchState])

  const handleCollapse = useCallback(() => {
    searchState.clearFilters()
    setIsSearching(false)
  }, [searchState, setIsSearching])

  const handleExpiringClick = useCallback(() => {
    searchState.setExpiringOnly(true)
    setIsSearching(true)
  }, [searchState, setIsSearching])

  const handleLocationClick = useCallback(
    (locationId: string) => {
      searchState.setSelectedLocationId(locationId)
      setIsSearching(true)
    },
    [searchState, setIsSearching],
  )

  const handleEditItem = useCallback(
    (item: Item) => {
      router.push(`/items/${item.id}/edit`)
    },
    [router],
  )

  const handleAddItemShortcut = useCallback(() => {
    const encoded = encodeURIComponent(searchState.searchQuery)
    router.push(`/items/add?name=${encoded}`)
  }, [router, searchState.searchQuery])

  const handleZeroConfirm = useCallback(async () => {
    if (!pendingZeroItem || zeroConfirmInFlightRef.current) return
    zeroConfirmInFlightRef.current = true
    setIsZeroConfirming(true)
    try {
      cancelPendingWrites(pendingZeroItem.id)
      await deleteItem(pendingZeroItem.id)
      setPendingZeroItem(null)
      setZeroDeleteError(null)
      clearPatchesOnRefetch()
      refetchItems()
    } catch {
      setPendingZeroItem(null)
      setZeroDeleteError('Failed to update. Try again.')
    } finally {
      zeroConfirmInFlightRef.current = false
      setIsZeroConfirming(false)
    }
  }, [pendingZeroItem, cancelPendingWrites, clearPatchesOnRefetch, refetchItems])

  const zeroCopy = pendingZeroItem ? zeroQuantityConfirmCopy(pendingZeroItem.name) : null

  return (
    <div className="p-4">
      {(quantityError || zeroDeleteError) && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {quantityError || zeroDeleteError}
        </div>
      )}
      {pantryUnreachable ? (
        <CannotReachPantry onRetry={handleRetryPantry} />
      ) : isSearching ? (
        <div className="space-y-4">
          <SearchBar
            query={searchState.searchQuery}
            onQueryChange={searchState.setSearchQuery}
            onClear={handleClear}
            onCollapse={handleCollapse}
            isExpanded={isSearching}
            focusOnExpand={focusField}
            onFocusApplied={clearFocusField}
          />

          <FilterChips
            locations={locations}
            categories={categories}
            selectedLocationId={searchState.selectedLocationId}
            onLocationChange={searchState.setSelectedLocationId}
            selectedCategoryId={searchState.selectedCategoryId}
            onCategoryChange={searchState.setSelectedCategoryId}
            expiringOnly={searchState.expiringOnly}
            onExpiringChange={searchState.setExpiringOnly}
            expiringCount={expiringCount}
          />

          <SearchResults
            items={searchState.filteredItems}
            locations={locations}
            categories={categories}
            isLoading={showSkeleton}
            searchQuery={searchState.searchQuery}
            onEdit={handleEditItem}
            onAddItemShortcut={handleAddItemShortcut}
            onIncrement={incrementQuantity}
            onDecrement={decrementQuantity}
            onPartialUse={partialUse}
          />
        </div>
      ) : (
        <DashboardLaunchpad
          items={patchedItems}
          locations={locations}
          categories={categories}
          isLoading={showSkeleton}
          onExpiringClick={handleExpiringClick}
          onLocationClick={handleLocationClick}
        />
      )}
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
