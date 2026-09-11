'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { CATEGORY_COLORS } from '@/lib/constants'
import type { Category, CreateCategoryInput } from '@/types/category'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(64),
  description: z.string().max(500).optional(),
  icon: z.string().max(64).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
    .optional(),
  sortOrder: z.number().int().min(0),
})

type CategoryFormData = z.infer<typeof categorySchema>

interface CategoryFormProps {
  initialData?: Category
  onSubmit: (data: CreateCategoryInput) => void
  onCancel?: () => void
  isLoading?: boolean
}

const iconOptions = [
  { value: '', label: 'No icon', symbol: 'O' },
  { value: 'beef', label: 'Beef', symbol: '🥩' },
  { value: 'egg', label: 'Egg', symbol: '🥚' },
  { value: 'apple', label: 'Apple', symbol: '🍎' },
  { value: 'milk', label: 'Milk', symbol: '🥛' },
  { value: 'cookie', label: 'Cookie', symbol: '🍪' },
  { value: 'wine', label: 'Wine', symbol: '🍷' },
  { value: 'flame', label: 'Flame', symbol: '🔥' },
  { value: 'package', label: 'Package', symbol: '📦' },
]

export function CategoryForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: CategoryFormProps) {
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      icon: initialData?.icon ?? '',
      color: initialData?.color ?? '#6b7280',
      sortOrder: initialData?.sortOrder ?? 0,
    },
  })

  const handleSubmit = (data: CategoryFormData) => {
    onSubmit({
      name: data.name,
      description: data.description,
      icon: data.icon,
      color: data.color,
      sortOrder: data.sortOrder,
    })
  }

  const selectedColor = form.watch('color') || '#6b7280'
  const selectedIconValue = form.watch('icon') || ''
  const selectedIconOption =
    iconOptions.find((option) => option.value === selectedIconValue) ?? iconOptions[0]

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
          placeholder="e.g., Dairy"
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
        <select
          id="icon"
          {...form.register('icon')}
          className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {iconOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {`${option.symbol} ${option.label}`}
            </option>
          ))}
        </select>
        <div className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-700">
          <span aria-hidden="true">{selectedIconOption.symbol}</span>
          <span>{selectedIconOption.label}</span>
        </div>
      </div>

      <div>
        <label htmlFor="color" className="mb-1 block text-sm font-medium text-gray-700">
          Color
        </label>
        <div className="flex items-center gap-2">
          <input
            id="color"
            type="color"
            {...form.register('color')}
            className="h-11 w-11 cursor-pointer rounded-lg border border-gray-300 p-1"
            value={selectedColor}
            onChange={(e) => form.setValue('color', e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {CATEGORY_COLORS.map((color) => {
              const isSelected = selectedColor.toLowerCase() === color.toLowerCase()

              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => form.setValue('color', color)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border border-white shadow-sm ${
                    isSelected ? 'ring-2 ring-gray-900 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                  aria-pressed={isSelected}
                >
                  {isSelected && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-900">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <input
          type="text"
          {...form.register('color')}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="#000000"
        />
        {form.formState.errors.color && (
          <p className="mt-1 text-sm text-red-500">{form.formState.errors.color.message}</p>
        )}
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
            {isLoading ? 'Saving...' : initialData ? 'Update Category' : 'Add Category'}
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[44px]"
        >
          {isLoading ? 'Saving...' : initialData ? 'Update Category' : 'Add Category'}
        </button>
      )}
    </form>
  )
}
