'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useTemplateSearch } from '@/hooks/use-templates'
import { UNITS } from '@/lib/constants'
import { itemDefaultsFromTemplate } from '@/lib/inventory/restock-from-template'
import { zeroQuantityConfirmCopy } from '@/lib/inventory/zero-quantity-confirm'
import type { Category } from '@/types/category'
import type { Item, ItemFormOutput } from '@/types/item'
import type { Location } from '@/types/location'
import type { ItemTemplate } from '@/types/template'

function createItemSchema(isEditing: boolean) {
  return z.object({
    name: z.string().trim().min(1, 'Name is required').max(255),
    templateId: z.string().optional(),
    locationId: z.string().min(1, 'Location is required'),
    categoryId: z.string().optional(),
    quantity: isEditing ? z.number() : z.number().gt(0, 'Quantity must be greater than 0'),
    unit: z.string().min(1, 'Unit is required'),
    expirationDate: z.string().optional(),
    purchaseDate: z.string().optional(),
    notes: z.string().max(1000).optional(),
  })
}

type ItemFormData = z.infer<ReturnType<typeof createItemSchema>>

interface ItemFormProps {
  initialData?: Item
  defaultName?: string
  restockTemplate?: ItemTemplate
  categories: Category[]
  locations: Location[]
  onSubmit: (data: ItemFormOutput) => void
  onRemove?: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function ItemForm({
  initialData,
  defaultName,
  restockTemplate,
  categories,
  locations,
  onSubmit,
  onRemove,
  onCancel,
  isLoading = false,
}: ItemFormProps) {
  const isEditing = !!initialData
  const [templateQuery, setTemplateQuery] = useState(initialData?.name ?? defaultName ?? '')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ItemTemplate | null>(null)
  const [showZeroConfirm, setShowZeroConfirm] = useState(false)
  const [zeroCopy, setZeroCopy] = useState(() => zeroQuantityConfirmCopy(''))

  const form = useForm<ItemFormData>({
    resolver: zodResolver(createItemSchema(isEditing)),
    defaultValues: {
      name: initialData?.name ?? defaultName ?? '',
      templateId: initialData?.templateId ?? '',
      locationId: initialData?.locationId ?? '',
      categoryId: initialData?.categoryId ?? '',
      quantity: initialData?.quantity ?? 1,
      unit: initialData?.unit ?? 'each',
      expirationDate: initialData?.expirationDate ?? '',
      purchaseDate: initialData?.purchaseDate ?? '',
      notes: initialData?.notes ?? '',
    },
  })

  const { results: templateResults, isLoading: isSearchingTemplates } =
    useTemplateSearch(templateQuery)

  const applyRestockDefaults = useCallback(
    (template: ItemTemplate) => {
      const defaults = itemDefaultsFromTemplate(template)
      form.setValue('name', defaults.name, { shouldValidate: true })
      form.setValue('templateId', defaults.templateId, { shouldValidate: true })
      form.setValue('quantity', defaults.quantity, { shouldValidate: true })
      form.setValue('unit', defaults.unit, { shouldValidate: true })
      form.setValue('locationId', defaults.locationId, { shouldValidate: true })
      form.setValue('categoryId', defaults.categoryId, { shouldValidate: true })
      form.setValue('notes', defaults.notes, { shouldValidate: true })
      form.setValue('purchaseDate', defaults.purchaseDate, { shouldValidate: true })
      form.setValue('expirationDate', defaults.expirationDate, { shouldValidate: true })
      setTemplateQuery(defaults.name)
      setSelectedTemplate(template)
      setShowAutocomplete(false)
    },
    [form],
  )

  useEffect(() => {
    if (!restockTemplate) return
    applyRestockDefaults(restockTemplate)
  }, [restockTemplate, applyRestockDefaults])

  const handleTemplateSelect = (template: ItemTemplate) => {
    applyRestockDefaults(template)
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    form.setValue('name', value)
    setTemplateQuery(value)
    setShowAutocomplete(value.length >= 2)
    if (selectedTemplate && value !== selectedTemplate.name) {
      setSelectedTemplate(null)
      form.setValue('templateId', '')
    }
  }

  const handleSubmit = async (data: ItemFormData) => {
    if (isEditing && data.quantity <= 0) {
      setZeroCopy(zeroQuantityConfirmCopy(data.name))
      setShowZeroConfirm(true)
      return
    }

    const formattedData: ItemFormOutput = {
      name: data.name,
      templateId: data.templateId || undefined,
      locationId: data.locationId,
      categoryId: data.categoryId || undefined,
      quantity: data.quantity,
      unit: data.unit,
      expirationDate: data.expirationDate || undefined,
      purchaseDate: data.purchaseDate || undefined,
      notes: data.notes || undefined,
    }

    onSubmit(formattedData)
  }

  const handleZeroDialogChange = (open: boolean) => {
    if (!open && initialData) {
      form.setValue('quantity', initialData.quantity)
    }
    setShowZeroConfirm(open)
  }

  const handleZeroConfirm = () => {
    setShowZeroConfirm(false)
    onRemove?.()
  }

  const nameError = form.formState.errors.name?.message
  const locationError = form.formState.errors.locationId?.message

  return (
    <>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h2 id="form-title" className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Item' : 'Add Item'}
          </h2>

          <div className="relative">
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              {...form.register('name')}
              onChange={handleNameChange}
              onFocus={() => {
                if (form.getValues('name').length >= 2) {
                  setShowAutocomplete(true)
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowAutocomplete(false), 200)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              placeholder="e.g., Whole Milk"
              autoComplete="off"
            />
            {nameError && <p className="mt-1 text-sm text-red-500">{nameError}</p>}

            {showAutocomplete && templateQuery.length >= 2 && (
              <div className="absolute z-10 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                {isSearchingTemplates ? (
                  <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                ) : templateResults.length > 0 ? (
                  templateResults.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleTemplateSelect(template)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-gray-900">{template.name}</div>
                      <div className="text-xs text-gray-500">
                        {template.defaultQuantity} {template.defaultUnit}
                        {template.categoryId &&
                          ` • ${categories.find((c) => c.id === template.categoryId)?.name || 'Category'}`}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500">No templates found</div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="locationId" className="mb-1 block text-sm font-medium text-gray-700">
                Location <span className="text-red-500">*</span>
              </label>
              <select
                id="locationId"
                {...form.register('locationId')}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors bg-white"
              >
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              {locationError && <p className="mt-1 text-sm text-red-500">{locationError}</p>}
            </div>

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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantity" className="mb-1 block text-sm font-medium text-gray-700">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                id="quantity"
                type="number"
                step="0.01"
                min={isEditing ? undefined : 0}
                {...form.register('quantity', { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
              {form.formState.errors.quantity && (
                <p className="mt-1 text-sm text-red-500">
                  {form.formState.errors.quantity.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="unit" className="mb-1 block text-sm font-medium text-gray-700">
                Unit <span className="text-red-500">*</span>
              </label>
              <select
                id="unit"
                {...form.register('unit')}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="purchaseDate"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Purchase Date
              </label>
              <input
                id="purchaseDate"
                type="date"
                {...form.register('purchaseDate')}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="expirationDate"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Expiration Date
              </label>
              <input
                id="expirationDate"
                type="date"
                {...form.register('expirationDate')}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
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
              placeholder="Add any notes..."
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
            {isLoading ? 'Saving...' : isEditing ? 'Update Item' : 'Add Item'}
          </button>
        </div>
      </form>
      {isEditing && (
        <ConfirmDialog
          open={showZeroConfirm}
          onOpenChange={handleZeroDialogChange}
          title={zeroCopy.title}
          description={zeroCopy.description}
          confirmText={zeroCopy.confirmText}
          onConfirm={handleZeroConfirm}
          isLoading={isLoading}
          variant="destructive"
        />
      )}
    </>
  )
}
