'use client'

import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { Item } from '@/types/item'

interface QuantityControlsProps {
  item: Item
  quantity: number
  onIncrement: () => void
  onDecrement: () => void
  onPartialUse: (amountToRemove: number) => void
}

function formatQuantity(qty: number, unit: string): string {
  const formattedQty = Number.isInteger(qty) ? qty.toString() : qty.toFixed(1)
  return `${formattedQty} ${unit}`
}

export function QuantityControls({
  item,
  quantity,
  onIncrement,
  onDecrement,
  onPartialUse,
}: QuantityControlsProps) {
  const [isSliderOpen, setIsSliderOpen] = useState(false)
  const [sliderValue, setSliderValue] = useState(0)

  const handleChevronClick = useCallback(() => {
    setIsSliderOpen((prev) => !prev)
    setSliderValue(0)
  }, [])

  const handleApply = useCallback(() => {
    if (sliderValue > 0) {
      onPartialUse(sliderValue)
    }
    setIsSliderOpen(false)
    setSliderValue(0)
  }, [sliderValue, onPartialUse])

  const handleCancel = useCallback(() => {
    setIsSliderOpen(false)
    setSliderValue(0)
  }, [])

  const remaining = quantity - sliderValue

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDecrement}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 active:bg-gray-300 min-w-[44px] min-h-[44px]"
          aria-label="Decrease quantity"
        >
          <Minus className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={handleChevronClick}
          className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1 text-sm font-medium bg-emerald-50 text-emerald-700 rounded-lg min-h-[44px]"
          aria-label={isSliderOpen ? 'Close partial use slider' : 'Open partial use slider'}
          data-testid="quantity-badge"
        >
          {formatQuantity(quantity, item.unit)}
          {isSliderOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={onIncrement}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500 text-white transition-colors hover:bg-emerald-600 active:bg-emerald-700 min-w-[44px] min-h-[44px]"
          aria-label="Increase quantity"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {isSliderOpen && (
        <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
          <div className="text-sm font-medium text-gray-700">
            Remove: {formatQuantity(sliderValue, item.unit)}
          </div>

          <input
            type="range"
            min={0}
            max={quantity}
            step="0.1"
            value={sliderValue}
            onChange={(e) =>
              setSliderValue(Math.round(Number.parseFloat(e.target.value) * 10) / 10)
            }
            className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            aria-label="Amount to remove"
          />

          <div className="text-sm text-gray-500">
            Remaining: {formatQuantity(remaining, item.unit)}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={sliderValue === 0}
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
