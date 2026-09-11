'use client'

interface InlineQuantityEditorProps {
  quantity: number
  onChange: (quantity: number) => void
  maxQuantity?: number
}

export function InlineQuantityEditor({
  quantity,
  onChange,
  maxQuantity,
}: InlineQuantityEditorProps) {
  const isAtMin = quantity <= 0
  const isAtMax = maxQuantity !== undefined && quantity >= maxQuantity

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, quantity - 1))}
        disabled={isAtMin}
        aria-label="Decrement quantity"
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span className="text-lg font-medium">−</span>
      </button>
      <span className="min-w-[2.5rem] text-center text-sm font-semibold text-gray-900">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() =>
          onChange(maxQuantity === undefined ? quantity + 1 : Math.min(maxQuantity, quantity + 1))
        }
        disabled={isAtMax}
        aria-label="Increment quantity"
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span className="text-lg font-medium">+</span>
      </button>
    </div>
  )
}
