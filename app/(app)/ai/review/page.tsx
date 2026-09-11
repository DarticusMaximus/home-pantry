'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { BatchReviewScreen } from '@/components/ai/batch-review-screen'
import { useAuth } from '@/contexts/auth-context'
import { useItems } from '@/hooks/use-items'
import { useLocations } from '@/hooks/use-locations'
import { useTemplates } from '@/hooks/use-templates'
import { clearBatchReviewDraft, loadBatchReviewDraft } from '@/lib/ai/batch-review-draft'
import { applyTemplateDefaultsToRow } from '@/lib/ai/batch-template-defaults'
import { applyAddLotMatchToRow } from '@/lib/batch/add-lot-matching'
import { submitBatch } from '@/lib/batch/submit-batch'
import type { BatchOperation, BatchReviewRow, BatchSubmitSummary } from '@/types/batch-review'

export default function ReviewPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { locations: fetchedLocations = [] } = useLocations()
  const { templates } = useTemplates()
  const { items, isLoading } = useItems()

  const [draft, setDraft] = useState<{
    operation: BatchOperation
    rows: BatchReviewRow[]
  } | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const stored = loadBatchReviewDraft()
    if (stored) {
      setDraft({ operation: stored.operation, rows: stored.rows })
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!draft) return

    const rows = draft.rows.map((row) => {
      const filled = templates.length > 0 ? applyTemplateDefaultsToRow(row, templates) : row
      return items.length > 0 ? applyAddLotMatchToRow(filled, items) : filled
    })
    const changed = rows.some((row, index) => row !== draft.rows[index])
    if (changed) {
      setDraft({ ...draft, rows })
    }
  }, [draft, templates, items])

  const handleSubmit = useCallback(
    async (operation: BatchOperation, rows: BatchReviewRow[]): Promise<BatchSubmitSummary> => {
      if (!user) {
        router.push('/login')
        throw new Error('Your session ended. Please sign in again.')
      }
      return submitBatch(operation, rows, user.$id)
    },
    [user, router],
  )

  const handleDone = useCallback(() => {
    clearBatchReviewDraft()
    router.push('/')
  }, [router])

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
          aria-hidden="true"
        />
        <span className="sr-only">Loading pantry data…</span>
      </div>
    )
  }

  return (
    <BatchReviewScreen
      operation={draft?.operation ?? 'add'}
      initialRows={draft?.rows ?? []}
      locations={fetchedLocations.map((l: { id: string; name: string }) => ({
        id: l.id,
        name: l.name,
      }))}
      items={items}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      onDone={handleDone}
    />
  )
}
