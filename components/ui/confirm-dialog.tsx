'use client'

import { useRef } from 'react'
import { useFocusTrap } from '@/hooks/use-focus-trap'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  variant?: 'default' | 'destructive'
  hideCancel?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  variant = 'default',
  hideCancel = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    open,
    dialogRef,
    onCancel: () => onOpenChange(false),
    initialFocusRef: hideCancel ? confirmButtonRef : cancelButtonRef,
  })

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onOpenChange(false)
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      <div ref={dialogRef} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h3 id="dialog-title" className="mb-2 text-lg font-semibold text-gray-900">
          {title}
        </h3>
        <p id="dialog-description" className="mb-6 text-sm text-gray-500">
          {description}
        </p>
        <div className="flex gap-3">
          {!hideCancel && (
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1 rounded-lg px-4 py-3 font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 min-h-[44px]"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 rounded-lg px-4 py-3 font-medium text-white disabled:opacity-50 min-h-[44px] ${
              variant === 'destructive'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            {isLoading ? 'Loading...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
