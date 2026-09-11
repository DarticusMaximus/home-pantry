'use client'

import { MapPin } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

interface InlineLocationPickerProps {
  locationId: string
  locations: Array<{ id: string; name: string }>
  onSelect: (locationId: string) => void
}

export function InlineLocationPicker({
  locationId,
  locations,
  onSelect,
}: InlineLocationPickerProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()

  const selectedIndex = locations.findIndex((location) => location.id === locationId)
  const selected = locations[selectedIndex]
  const label = selected ? selected.name : 'Select location'
  const activeLocation = locations[activeIndex]

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const openPicker = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    if (locations.length === 0) return
    setActiveIndex(index)
    setOpen(true)
  }

  const handleSelect = (id: string) => {
    onSelect(id)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (locations.length === 0) return

    const lastIndex = locations.length - 1

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) {
          openPicker(selectedIndex >= 0 ? selectedIndex : 0)
        } else {
          setActiveIndex((index) => (index === lastIndex ? 0 : index + 1))
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (!open) {
          openPicker(selectedIndex >= 0 ? selectedIndex : lastIndex)
        } else {
          setActiveIndex((index) => (index === 0 ? lastIndex : index - 1))
        }
        break
      case 'Home':
        event.preventDefault()
        if (!open) openPicker(0)
        else setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        if (!open) openPicker(lastIndex)
        else setActiveIndex(lastIndex)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open && activeLocation) {
          handleSelect(activeLocation.id)
        } else {
          openPicker()
        }
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          setOpen(false)
          triggerRef.current?.focus()
        }
        break
    }
  }

  return (
    <div ref={pickerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-label="Select location"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && activeLocation ? `${listboxId}-${activeLocation.id}` : undefined
        }
        className={`flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
          selected
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}
      >
        <MapPin className="h-4 w-4" />
        <span>{label}</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg"
          id={listboxId}
          role="listbox"
          aria-label="Locations"
        >
          {locations.map((location, index) => (
            <button
              key={location.id}
              type="button"
              id={`${listboxId}-${location.id}`}
              role="option"
              tabIndex={-1}
              aria-selected={location.id === locationId}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(location.id)}
              onMouseMove={() => setActiveIndex(index)}
              className={`block w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                index === activeIndex
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {location.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
