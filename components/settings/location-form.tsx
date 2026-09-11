'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getLocationIcon, LOCATION_ICONS } from '@/lib/constants'
import type { CreateLocationInput, Location } from '@/types/location'

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  description: z.string().max(500).optional(),
  icon: z.string().max(64).optional(),
  sortOrder: z.number().int().min(0),
})

type LocationFormData = z.infer<typeof locationSchema>

interface LocationFormProps {
  initialData?: Location
  onSubmit: (data: CreateLocationInput) => void
  onCancel?: () => void
  isLoading?: boolean
}

export function LocationForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: LocationFormProps) {
  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      icon: initialData?.icon ?? '',
      sortOrder: initialData?.sortOrder ?? 0,
    },
  })

  const handleSubmit = (data: LocationFormData) => {
    onSubmit({
      name: data.name,
      description: data.description,
      icon: data.icon,
      sortOrder: data.sortOrder,
    })
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          {...form.register('name')}
          aria-invalid={!!form.formState.errors.name}
          aria-describedby={form.formState.errors.name ? 'name-error' : undefined}
          className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="e.g., Fridge"
        />
        {form.formState.errors.name && (
          <p id="name-error" className="mt-1 text-sm text-red-500" role="alert">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          {...form.register('description')}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="Optional description..."
        />
        {form.formState.errors.description && (
          <p className="mt-1 text-sm text-red-500">{form.formState.errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="icon" className="mb-1 block text-sm font-medium text-gray-700">
          Icon
        </label>
        <div className="flex items-center gap-2">
          <select
            id="icon"
            {...form.register('icon')}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Select an icon</option>
            {LOCATION_ICONS.map((icon) => (
              <option key={icon} value={icon}>
                {icon.charAt(0).toUpperCase() + icon.slice(1)}
              </option>
            ))}
          </select>
          {form.watch('icon') && (
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-emerald-50">
              {(() => {
                const Icon = getLocationIcon(form.watch('icon'))
                return <Icon className="h-5 w-5 text-emerald-600" />
              })()}
            </div>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="sortOrder" className="mb-1 block text-sm font-medium text-gray-700">
          Sort Order
        </label>
        <input
          id="sortOrder"
          type="number"
          {...form.register('sortOrder', { valueAsNumber: true })}
          min={0}
          className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {form.formState.errors.sortOrder && (
          <p className="mt-1 text-sm text-red-500">{form.formState.errors.sortOrder.message}</p>
        )}
      </div>

      {onCancel ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 min-h-[44px] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-emerald-500 px-6 py-3 font-medium text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[44px]"
          >
            {isLoading ? 'Saving...' : initialData ? 'Update Location' : 'Add Location'}
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[44px]"
        >
          {isLoading ? 'Saving...' : initialData ? 'Update Location' : 'Add Location'}
        </button>
      )}
    </form>
  )
}
