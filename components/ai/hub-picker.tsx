'use client'

import Link from 'next/link'

type HubPickerMode = 'recording' | 'text' | 'picture'

interface HubPickerProps {
  onSelect: (mode: HubPickerMode) => void
}

const pickerControlClass =
  'flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50'

export function HubPicker({ onSelect }: HubPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button type="button" className={pickerControlClass} onClick={() => onSelect('recording')}>
        Recording
      </button>
      <button type="button" className={pickerControlClass} onClick={() => onSelect('text')}>
        Text
      </button>
      <button type="button" className={pickerControlClass} onClick={() => onSelect('picture')}>
        Picture
      </button>
      <Link href="/items/add" className={pickerControlClass}>
        Manual
      </Link>
    </div>
  )
}
