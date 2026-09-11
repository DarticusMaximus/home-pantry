import { CANNOT_REACH_PANTRY_COPY } from '@/lib/pantry-reachability'

interface CannotReachPantryProps {
  onRetry: () => void
}

export function CannotReachPantry({ onRetry }: CannotReachPantryProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
      <p className="text-gray-900">{CANNOT_REACH_PANTRY_COPY}</p>
      <button
        type="button"
        aria-label="Try again"
        onClick={onRetry}
        className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
        style={{ minHeight: 44 }}
      >
        Try again
      </button>
    </div>
  )
}
