'use client'

import { Filter, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BackLink } from '@/components/layout/back-link'
import { TemplateForm } from '@/components/templates/template-form'
import { TemplateList } from '@/components/templates/template-list'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useCategories } from '@/hooks/use-categories'
import { useLocations } from '@/hooks/use-locations'
import {
  useCreateTemplate,
  useDeleteTemplate,
  useUpdateTemplate,
} from '@/hooks/use-template-mutations'
import { useTemplates } from '@/hooks/use-templates'
import { DELETE_RETRY_COPY, SAVE_RETRY_COPY } from '@/lib/household-copy'
import type { CreateTemplateInput, ItemTemplate, UpdateTemplateInput } from '@/types/template'

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ItemTemplate | null>(null)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { templates, isLoading, error, refetch } = useTemplates()
  const { categories } = useCategories()
  const { locations } = useLocations()

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingTemplate(null)
    setActionError(null)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const createMutation = useCreateTemplate(() => {
    refetch()
    closeForm()
    showSuccess('Template created successfully')
  })

  const updateMutation = useUpdateTemplate(() => {
    refetch()
    closeForm()
    showSuccess('Template updated successfully')
  })

  const deleteMutation = useDeleteTemplate(() => {
    refetch()
    setDeletingTemplateId(null)
    showSuccess('Template deleted successfully')
  })

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch = template.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      const matchesCategory = !selectedCategoryId || template.categoryId === selectedCategoryId
      return matchesSearch && matchesCategory
    })
  }, [templates, debouncedSearchQuery, selectedCategoryId])

  const mutationError =
    actionError ??
    (createMutation.error || updateMutation.error
      ? SAVE_RETRY_COPY
      : deleteMutation.error
        ? DELETE_RETRY_COPY
        : null)

  const handleEdit = (template: ItemTemplate) => {
    setActionError(null)
    setEditingTemplate(template)
    setIsFormOpen(true)
  }

  const handleDelete = (id: string) => {
    setActionError(null)
    setDeletingTemplateId(id)
  }

  const handleAddClick = () => {
    setActionError(null)
    setEditingTemplate(null)
    setIsFormOpen(true)
  }

  const handleFormSubmit = async (data: CreateTemplateInput | UpdateTemplateInput) => {
    setActionError(null)
    try {
      if (editingTemplate) {
        await updateMutation.mutateWithId(editingTemplate.id, data as UpdateTemplateInput)
      } else {
        await createMutation.mutate(data as CreateTemplateInput)
      }
    } catch {
      setActionError(SAVE_RETRY_COPY)
    }
  }

  const confirmDelete = async () => {
    if (!deletingTemplateId) return
    setActionError(null)
    try {
      await deleteMutation.mutate(deletingTemplateId)
    } catch {
      setActionError(DELETE_RETRY_COPY)
    }
  }

  const errorBanner = mutationError ? (
    <div className="rounded-xl bg-red-50 p-4 text-center">
      <p className="text-red-600">{mutationError}</p>
    </div>
  ) : null

  return (
    <div className="p-4 pb-24">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BackLink href="/settings" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Item Templates</h1>
            <p className="text-sm text-gray-500">Create presets for quick item entry</p>
          </div>
        </div>

        {successMessage && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700 animate-in fade-in slide-in-from-top-2">
            {successMessage}
          </div>
        )}

        {!isFormOpen && errorBanner}

        {!isFormOpen && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <label htmlFor="search" className="sr-only">
                Search templates
              </label>
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="search"
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-48">
                <label htmlFor="category-filter" className="sr-only">
                  Filter by category
                </label>
                <Filter className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <select
                  id="category-filter"
                  value={selectedCategoryId || ''}
                  onChange={(e) => setSelectedCategoryId(e.target.value || null)}
                  className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-gray-900 appearance-none bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddClick}
                className="flex items-center gap-1 rounded-lg bg-emerald-500 px-4 py-2 font-medium text-white hover:bg-emerald-600 transition-colors min-h-[44px]"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">Add Template</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {isFormOpen ? (
        <div className="rounded-xl bg-white p-6 shadow-xl">
          {errorBanner ? <div className="mb-4">{errorBanner}</div> : null}
          <TemplateForm
            template={editingTemplate || undefined}
            categories={categories}
            locations={locations}
            onSubmit={handleFormSubmit}
            onCancel={closeForm}
            isLoading={createMutation.isLoading || updateMutation.isLoading}
          />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load templates</p>
          <p className="mt-1 text-sm text-red-500">
            Something went wrong loading templates. Try again to reload.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 font-semibold text-red-700 hover:underline transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <TemplateList
          templates={filteredTemplates}
          categories={categories}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deletingTemplateId !== null}
        onOpenChange={(open) => !open && setDeletingTemplateId(null)}
        title="Delete Template"
        description="Are you sure you want to delete this template? This will not affect any existing items created from this template."
        confirmText="Delete"
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isLoading}
        variant="destructive"
      />
    </div>
  )
}
