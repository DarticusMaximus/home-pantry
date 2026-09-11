'use client'

import { Clock } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { getLocationIcon } from '@/lib/constants'
import type { Category } from '@/types/category'
import type { Location } from '@/types/location'

interface FilterChipsProps {
  locations: Location[]
  categories: Category[]
  selectedLocationId: string | null
  onLocationChange: (id: string | null) => void
  selectedCategoryId: string | null
  onCategoryChange: (id: string | null) => void
  expiringOnly: boolean
  onExpiringChange: (value: boolean) => void
  expiringCount: number
}

const selectedClasses = 'border-emerald-300 bg-emerald-100 text-emerald-700'
const unselectedClasses = 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
const triggerClasses =
  'inline-flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors'
const pickerTriggerClasses = `${triggerClasses} max-w-[45%]`
const optionBaseClasses = 'flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm'

function pickerOptionId(listboxId: string, id: string | null) {
  return id === null ? `${listboxId}-any` : `${listboxId}-${id}`
}

function optionClassName(isActive: boolean) {
  return isActive
    ? `${optionBaseClasses} bg-emerald-50 text-emerald-700 font-medium`
    : `${optionBaseClasses} text-gray-700 hover:bg-gray-50`
}

export function FilterChips({
  locations,
  categories,
  selectedLocationId,
  onLocationChange,
  selectedCategoryId,
  onCategoryChange,
  expiringOnly,
  onExpiringChange,
  expiringCount,
}: FilterChipsProps) {
  const [openPicker, setOpenPicker] = useState<'location' | 'category' | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const locationListboxId = useId()
  const categoryListboxId = useId()

  const selectedLocation = locations.find((location) => location.id === selectedLocationId)
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId)
  const locationLabel = selectedLocation?.name ?? 'Location'
  const categoryLabel = selectedCategory?.name ?? 'Category'
  const locationOptionIds: Array<string | null> = [
    null,
    ...locations.map((location) => location.id),
  ]
  const categoryOptionIds: Array<string | null> = [
    null,
    ...categories.map((category) => category.id),
  ]

  useEffect(() => {
    if (openPicker === null) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenPicker(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openPicker])

  const handleLocationClick = (id: string) => {
    onLocationChange(selectedLocationId === id ? null : id)
    setOpenPicker(null)
  }

  const handleCategoryClick = (id: string) => {
    onCategoryChange(selectedCategoryId === id ? null : id)
    setOpenPicker(null)
  }

  const openLocationPicker = () => {
    setActiveIndex(0)
    setOpenPicker('location')
  }

  const openCategoryPicker = () => {
    setActiveIndex(0)
    setOpenPicker('category')
  }

  const handlePickerKeyDown = (event: React.KeyboardEvent, kind: 'location' | 'category') => {
    if (openPicker !== kind) return

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpenPicker(null)
      return
    }

    const optionIds = kind === 'location' ? locationOptionIds : categoryOptionIds
    const lastIndex = optionIds.length - 1
    if (lastIndex < 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => (index >= lastIndex ? 0 : index + 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => (index <= 0 ? lastIndex : index - 1))
        break
      case 'Enter':
      case ' ': {
        event.preventDefault()
        const id = optionIds[activeIndex] ?? null
        if (kind === 'location') {
          if (id === null) {
            onLocationChange(null)
            setOpenPicker(null)
          } else {
            handleLocationClick(id)
          }
        } else if (id === null) {
          onCategoryChange(null)
          setOpenPicker(null)
        } else {
          handleCategoryClick(id)
        }
        break
      }
    }
  }

  return (
    <div ref={rootRef}>
      <div className="flex flex-wrap gap-2">
        {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: active option is exposed on the open trigger */}
        <button
          type="button"
          onClick={() => (openPicker === 'location' ? setOpenPicker(null) : openLocationPicker())}
          onKeyDown={(event) => handlePickerKeyDown(event, 'location')}
          className={`${pickerTriggerClasses} ${selectedLocationId ? selectedClasses : unselectedClasses}`}
          aria-haspopup="listbox"
          aria-expanded={openPicker === 'location'}
          aria-controls={openPicker === 'location' ? locationListboxId : undefined}
          aria-activedescendant={
            openPicker === 'location'
              ? pickerOptionId(locationListboxId, locationOptionIds[activeIndex] ?? null)
              : undefined
          }
        >
          <span className="min-w-0 truncate">{locationLabel}</span>
        </button>
        {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: active option is exposed on the open trigger */}
        <button
          type="button"
          onClick={() => (openPicker === 'category' ? setOpenPicker(null) : openCategoryPicker())}
          onKeyDown={(event) => handlePickerKeyDown(event, 'category')}
          className={`${pickerTriggerClasses} ${selectedCategoryId ? selectedClasses : unselectedClasses}`}
          aria-haspopup="listbox"
          aria-expanded={openPicker === 'category'}
          aria-controls={openPicker === 'category' ? categoryListboxId : undefined}
          aria-activedescendant={
            openPicker === 'category'
              ? pickerOptionId(categoryListboxId, categoryOptionIds[activeIndex] ?? null)
              : undefined
          }
        >
          <span className="min-w-0 truncate">{categoryLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setOpenPicker(null)
            onExpiringChange(!expiringOnly)
          }}
          className={`${triggerClasses} ${expiringOnly ? selectedClasses : unselectedClasses}`}
          aria-pressed={expiringOnly}
        >
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          {expiringCount > 0 ? `Expiring soon (${expiringCount})` : 'Expiring soon'}
        </button>
      </div>

      {openPicker === 'location' && (
        <div
          id={locationListboxId}
          role="listbox"
          aria-label="Locations"
          tabIndex={0}
          onKeyDown={(event) => handlePickerKeyDown(event, 'location')}
          className="mt-2 rounded-xl border border-gray-100 bg-white py-1 shadow-sm"
        >
          <button
            type="button"
            id={pickerOptionId(locationListboxId, null)}
            role="option"
            tabIndex={-1}
            aria-selected={selectedLocationId === null}
            className={optionClassName(activeIndex === 0)}
            onMouseMove={() => setActiveIndex(0)}
            onClick={() => {
              onLocationChange(null)
              setOpenPicker(null)
            }}
          >
            Any location
          </button>
          {locations.map((location, index) => {
            const optionIndex = index + 1
            const Icon = getLocationIcon(location.icon)
            return (
              <button
                key={location.id}
                type="button"
                id={pickerOptionId(locationListboxId, location.id)}
                role="option"
                tabIndex={-1}
                aria-selected={selectedLocationId === location.id}
                className={optionClassName(optionIndex === activeIndex)}
                onMouseMove={() => setActiveIndex(optionIndex)}
                onClick={() => handleLocationClick(location.id)}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {location.name}
              </button>
            )
          })}
        </div>
      )}

      {openPicker === 'category' && (
        <div
          id={categoryListboxId}
          role="listbox"
          aria-label="Categories"
          tabIndex={0}
          onKeyDown={(event) => handlePickerKeyDown(event, 'category')}
          className="mt-2 rounded-xl border border-gray-100 bg-white py-1 shadow-sm"
        >
          <button
            type="button"
            id={pickerOptionId(categoryListboxId, null)}
            role="option"
            tabIndex={-1}
            aria-selected={selectedCategoryId === null}
            className={optionClassName(activeIndex === 0)}
            onMouseMove={() => setActiveIndex(0)}
            onClick={() => {
              onCategoryChange(null)
              setOpenPicker(null)
            }}
          >
            Any category
          </button>
          {categories.map((category, index) => (
            <button
              key={category.id}
              type="button"
              id={pickerOptionId(categoryListboxId, category.id)}
              role="option"
              tabIndex={-1}
              aria-selected={selectedCategoryId === category.id}
              className={optionClassName(index + 1 === activeIndex)}
              onMouseMove={() => setActiveIndex(index + 1)}
              onClick={() => handleCategoryClick(category.id)}
            >
              {category.color && (
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
              )}
              {category.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
