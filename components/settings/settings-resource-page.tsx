'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'
import { BackLink } from '@/components/layout/back-link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ListRowSkeleton } from '@/components/ui/skeleton/list-row-skeleton'
import type { InUseCounts } from '@/lib/appwrite/in-use-error'
import { DELETE_RETRY_COPY } from '@/lib/household-copy'

type BlockDialog = {
  name: string
  itemCount: number
  templateCount: number
}

interface DeleteMutation {
  mutate: (id: string) => Promise<void>
  isLoading: boolean
  error: Error | null
}

export interface SettingsResourcePageProps<T extends { id: string; name: string }> {
  title: string
  backHref: string
  addHref: string
  loadErrorCopy: string
  deleteTitle: string
  deleteDescription: string
  fallbackName: string
  items: T[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
  deleteMutation: DeleteMutation
  getInUse: (id: string) => Promise<InUseCounts>
  formatInUseCopy: (name: string, counts: InUseCounts) => string
  onEdit: (id: string) => void
  onAdd: () => void
  renderList: (props: {
    items: T[]
    onEdit: (id: string) => void
    onDelete: (id: string) => void
    onAdd: () => void
  }) => ReactNode
}

function actionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function SettingsResourcePage<T extends { id: string; name: string }>({
  title,
  backHref,
  addHref,
  loadErrorCopy,
  deleteTitle,
  deleteDescription,
  fallbackName,
  items,
  isLoading,
  error,
  refetch,
  deleteMutation,
  getInUse,
  formatInUseCopy,
  onEdit,
  onAdd,
  renderList,
}: SettingsResourcePageProps<T>) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [blockDialog, setBlockDialog] = useState<BlockDialog | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [inUsePending, setInUsePending] = useState(false)

  const visibleError = actionError ?? (deleteMutation.error ? DELETE_RETRY_COPY : null)

  const handleDelete = async (id: string) => {
    if (inUsePending) return
    setActionError(null)
    setInUsePending(true)
    try {
      const usage = await getInUse(id)
      if (usage.itemCount > 0 || usage.templateCount > 0) {
        const item = items.find((row) => row.id === id)
        setBlockDialog({
          name: item?.name ?? fallbackName,
          itemCount: usage.itemCount,
          templateCount: usage.templateCount,
        })
        return
      }
      setDeleteId(id)
    } catch (e) {
      setActionError(actionErrorMessage(e, 'Failed to check if this can be deleted'))
    } finally {
      setInUsePending(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setActionError(null)
    try {
      await deleteMutation.mutate(deleteId)
      setDeleteId(null)
    } catch {
      setActionError(DELETE_RETRY_COPY)
      setDeleteId(null)
    }
  }

  const closeBlockDialog = () => {
    setBlockDialog(null)
  }

  const addLink = (
    <Link
      href={addHref}
      className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 font-medium text-white hover:bg-emerald-600 min-h-[44px]"
    >
      <Plus className="h-5 w-5" />
      Add
    </Link>
  )

  const titleRow = (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <BackLink href={backHref} />
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      </div>
      {addLink}
    </div>
  )

  if (error) {
    return (
      <div className="p-4">
        {titleRow}
        <div className="rounded-xl bg-red-50 p-4 text-center">
          <p className="text-red-600">{loadErrorCopy}</p>
          <button
            type="button"
            onClick={refetch}
            className="mt-2 font-medium text-red-700 hover:underline transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      {titleRow}

      {visibleError && (
        <div className="mb-4 rounded-xl bg-red-50 p-4 text-center">
          <p className="text-red-600">{visibleError}</p>
        </div>
      )}

      {inUsePending && (
        <output className="mb-2 block text-sm text-gray-500">
          Checking whether this can be deleted…
        </output>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {['a', 'b', 'c'].map((k) => (
            <ListRowSkeleton key={k} />
          ))}
        </div>
      ) : (
        renderList({ items, onEdit, onDelete: handleDelete, onAdd })
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={deleteTitle}
        description={deleteDescription}
        confirmText="Delete"
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isLoading}
        variant="destructive"
      />

      <ConfirmDialog
        open={blockDialog !== null}
        onOpenChange={(open) => !open && setBlockDialog(null)}
        title="Can't delete"
        description={
          blockDialog
            ? formatInUseCopy(blockDialog.name, {
                itemCount: blockDialog.itemCount,
                templateCount: blockDialog.templateCount,
              })
            : ''
        }
        confirmText="OK"
        hideCancel
        onConfirm={closeBlockDialog}
      />
    </div>
  )
}
