'use client'

import { Minus, Plus } from 'lucide-react'

interface OperationToggleProps {
  value: 'add' | 'remove'
  onChange: (value: 'add' | 'remove') => void
  disabled?: boolean
}

export function OperationToggle({ value, onChange, disabled }: OperationToggleProps) {
  return (
    <div
      className="flex rounded-xl overflow-hidden gap-0"
      role="radiogroup"
      aria-label="Operation mode"
      aria-disabled={disabled || undefined}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: intentional ARIA radiogroup of styled toggle buttons */}
      <button
        type="button"
        role="radio"
        aria-checked={value === 'add'}
        disabled={disabled}
        onClick={() => onChange('add')}
        className={`flex flex-1 items-center justify-center gap-1 min-h-[44px] text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          value === 'add'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-white text-gray-500 border border-gray-200'
        }`}
      >
        <Plus className="h-4 w-4" />
        <span>Add</span>
      </button>
      {/* biome-ignore lint/a11y/useSemanticElements: intentional ARIA radiogroup of styled toggle buttons */}
      <button
        type="button"
        role="radio"
        aria-checked={value === 'remove'}
        disabled={disabled}
        onClick={() => onChange('remove')}
        className={`flex flex-1 items-center justify-center gap-1 min-h-[44px] text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          value === 'remove'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-white text-gray-500 border border-gray-200'
        }`}
      >
        <Minus className="h-4 w-4" />
        <span>Remove</span>
      </button>
    </div>
  )
}
