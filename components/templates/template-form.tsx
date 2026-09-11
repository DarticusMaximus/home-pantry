'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { UNITS } from '@/lib/constants'
import type { Category } from '@/types/category'
import type { Location } from '@/types/location'
import type { CreateTemplateInput, ItemTemplate, UpdateTemplateInput } from '@/types/template'

const templateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  categoryId: z.string().optional(),
  defaultUnit: z.string().min(1, 'Unit is required'),
  defaultQuantity: z.number().gt(0, 'Quantity must be greater than 0'),
  defaultExpirationDays: z.number().min(1).optional().nullable(),
  defaultStorageLocationId: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

type TemplateFormData = z.infer<typeof templateSchema>

interface TemplateFormProps {
  template?: ItemTemplate
  categories: Category[]
  locations: Location[]
  onSubmit: (data: CreateTemplateInput | UpdateTemplateInput) => void
  onCancel: () => void
  isLoading?: boolean
}

export function TemplateForm({
  template,
  categories,
  locations,
  onSubmit,
  onCancel,
  isLoading = false,
}: TemplateFormProps) {
  const isEditing = !!template

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name ?? '',
      categoryId: template?.categoryId ?? '',
      defaultUnit: template?.defaultUnit ?? 'each',
      defaultQuantity: template?.defaultQuantity ?? 1,
      defaultExpirationDays: template?.defaultExpirationDays ?? null,
      defaultStorageLocationId: template?.defaultStorageLocationId ?? '',
      notes: template?.notes ?? '',
    },
  })

  const handleSubmit = async (data: TemplateFormData) => {
    const formattedData: CreateTemplateInput = {
      name: data.name,
      categoryId: data.categoryId || undefined,
      defaultUnit: data.defaultUnit,
      defaultQuantity: data.defaultQuantity,
      defaultExpirationDays: data.defaultExpirationDays || undefined,
      defaultStorageLocationId: data.defaultStorageLocationId || undefined,
      notes: data.notes || undefined,
    }

    onSubmit(formattedData)
  }

  const nameError = form.formState.errors.name?.message

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="space-y-4">
        <h2 id="form-title" className="text-xl font-semibold text-gray-900">
          {isEditing ? 'Edit Template' : 'Add Template'}
        </h2>

        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            {...form.register('name')}
            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
            placeholder="e.g., Whole Milk"
          />
          {nameError && <p className="mt-1 text-sm text-red-500">{nameError}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="categoryId"
              {...form.register('categoryId')}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors bg-white"
            >
              <option value="">No Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="defaultStorageLocationId"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Default Location
            </label>
            <select
              id="defaultStorageLocationId"
              {...form.register('defaultStorageLocationId')}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors bg-white"
            >
              <option value="">No Location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="defaultQuantity"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Default Qty <span className="text-red-500">*</span>
            </label>
            <input
              id="defaultQuantity"
              type="number"
              step="0.01"
              {...form.register('defaultQuantity', { valueAsNumber: true })}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
            {form.formState.errors.defaultQuantity && (
              <p className="mt-1 text-sm text-red-500">
                {form.formState.errors.defaultQuantity.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="defaultUnit" className="mb-1 block text-sm font-medium text-gray-700">
              Unit <span className="text-red-500">*</span>
            </label>
            <select
              id="defaultUnit"
              {...form.register('defaultUnit')}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors bg-white"
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="defaultExpirationDays"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Default Expiration Days
          </label>
          <input
            id="defaultExpirationDays"
            type="number"
            {...form.register('defaultExpirationDays', {
              valueAsNumber: true,
              setValueAs: (v) => (v === '' ? null : Number(v)),
            })}
            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
            placeholder="e.g., 30"
          />
          {form.formState.errors.defaultExpirationDays && (
            <p className="mt-1 text-sm text-red-500">
              {form.formState.errors.defaultExpirationDays.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="notes"
            {...form.register('notes')}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
            placeholder="Add any default notes..."
          />
        </div>
      </div>

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
          disabled={isLoading || !form.formState.isValid}
          className="rounded-lg bg-emerald-500 px-6 py-3 font-medium text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[44px] transition-colors"
        >
          {isLoading ? 'Saving...' : isEditing ? 'Update Template' : 'Add Template'}
        </button>
      </div>
    </form>
  )
}
