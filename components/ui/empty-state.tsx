import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  heading: string
  body: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, heading, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <Icon className="mb-3 h-12 w-12 text-gray-300" />
      <h3 className="text-lg font-semibold text-gray-900">{heading}</h3>
      <p className="mt-1 text-sm text-gray-500">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
