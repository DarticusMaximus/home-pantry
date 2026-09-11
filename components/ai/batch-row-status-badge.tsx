'use client'

import type { BatchRowStatus } from '@/types/batch-review'

interface BatchRowStatusBadgeProps {
  status: BatchRowStatus
}

const STATUS_CONFIG: Record<BatchRowStatus, { label: string; className: string }> = {
  ready: {
    label: 'Ready',
    className: 'bg-emerald-50 text-emerald-700',
  },
  missing_name: {
    label: 'Needs info',
    className: 'bg-amber-50 text-amber-700',
  },
  missing_quantity: {
    label: 'Needs info',
    className: 'bg-amber-50 text-amber-700',
  },
  missing_unit: {
    label: 'Needs info',
    className: 'bg-amber-50 text-amber-700',
  },
  missing_location: {
    label: 'Needs info',
    className: 'bg-amber-50 text-amber-700',
  },
  ambiguous_match: {
    label: 'Multiple matches',
    className: 'bg-amber-50 text-amber-700',
  },
  no_match: {
    label: 'Match needed',
    className: 'bg-amber-50 text-amber-700',
  },
  lot_choice: {
    label: 'Choose lot',
    className: 'bg-amber-50 text-amber-700',
  },
  error: {
    label: 'Error',
    className: 'bg-red-50 text-red-700',
  },
}

export function BatchRowStatusBadge({ status }: BatchRowStatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  )
}
