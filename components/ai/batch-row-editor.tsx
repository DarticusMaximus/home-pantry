'use client'

import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import type { BatchReviewRow } from '@/types/batch-review'

interface BatchRowEditorProps {
  open: boolean
  row: BatchReviewRow | null
  onSave: (rowId: string, updatedRow: BatchReviewRow) => void
  onCancel: () => void
}

function getRemoveName(row: BatchReviewRow): string {
  if (!row.removeData) return ''
  return row.removeData.type === 'resolved'
    ? row.removeData.matchedItemName
    : row.removeData.requestedName
}

export function BatchRowEditor({ open, row, onSave, onCancel }: BatchRowEditorProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('each')
  const [categoryId, setCategoryId] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [notes, setNotes] = useState('')

  const isRemove = row?.operation === 'remove'
  const canSave = name.trim().length > 0

  useFocusTrap({ open, dialogRef, onCancel })

  useEffect(() => {
    if (open && row) {
      const resolvedName = isRemove ? getRemoveName(row) : (row.addData?.name ?? '')
      setName(resolvedName)
      setUnit(row.addData?.unit ?? 'each')
      setCategoryId(row.addData?.categoryId ?? '')
      setExpirationDate(row.addData?.expirationDate ?? '')
      setPurchaseDate(row.addData?.purchaseDate ?? '')
      setNotes(row.addData?.notes ?? '')

      requestAnimationFrame(() => {
        const firstInput = dialogRef.current?.querySelector<HTMLInputElement>('input')
        firstInput?.focus()
      })
    }
  }, [open, row, isRemove])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel()
    }
  }

  const handleSave = () => {
    if (!row) return

    const trimmedName = name.trim()
    if (!trimmedName) return

    if (isRemove && row.removeData) {
      const updatedRow: BatchReviewRow = {
        ...row,
        removeData:
          row.removeData.type === 'resolved'
            ? { ...row.removeData, matchedItemName: trimmedName }
            : { ...row.removeData, requestedName: trimmedName },
      }
      onSave(row.id, updatedRow)
      return
    }

    const updatedRow: BatchReviewRow = {
      ...row,
      addData: row.addData
        ? {
            ...row.addData,
            name: trimmedName,
            unit,
            categoryId: categoryId || undefined,
            expirationDate: expirationDate || undefined,
            purchaseDate: purchaseDate || undefined,
            notes: notes || undefined,
          }
        : row.addData,
    }

    onSave(row.id, updatedRow)
  }

  if (!open || !row) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit item"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-t-2xl sm:rounded-xl bg-white p-6 shadow-lg max-h-[80vh] overflow-y-auto"
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {isRemove ? 'Edit remove item' : 'Edit item'}
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="editor-name" className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="editor-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {!isRemove && (
            <>
              <div>
                <label
                  htmlFor="editor-unit"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Unit
                </label>
                <select
                  id="editor-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  <option value="each">each</option>
                  <option value="bag">bag</option>
                  <option value="bottle">bottle</option>
                  <option value="box">box</option>
                  <option value="can">can</option>
                  <option value="lb">lb</option>
                  <option value="oz">oz</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="gal">gal</option>
                  <option value="qt">qt</option>
                  <option value="pt">pt</option>
                  <option value="cup">cup</option>
                  <option value="pack">pack</option>
                  <option value="jar">jar</option>
                  <option value="container">container</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="editor-purchase-date"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Purchase Date
                  </label>
                  <input
                    id="editor-purchase-date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editor-expiration-date"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Expiration Date
                  </label>
                  <input
                    id="editor-expiration-date"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="editor-notes"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Notes
                </label>
                <textarea
                  id="editor-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Add notes..."
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white hover:bg-emerald-600 min-h-[44px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}
