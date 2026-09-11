'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface UseFocusTrapOptions {
  open: boolean
  dialogRef: React.RefObject<HTMLElement | null>
  onCancel?: () => void
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export function useFocusTrap({ open, dialogRef, onCancel, initialFocusRef }: UseFocusTrapOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      initialFocusRef?.current?.focus()
    } else if (wasOpenRef.current) {
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }

    wasOpenRef.current = open
  }, [open, initialFocusRef])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return

      if (e.key === 'Escape') {
        onCancel?.()
        return
      }

      if (e.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement as HTMLElement | null
      const isFocusInDialog = activeElement ? dialog.contains(activeElement) : false

      if (!isFocusInDialog) {
        e.preventDefault()
        if (e.shiftKey) {
          last.focus()
        } else {
          first.focus()
        }
        return
      }

      if (e.shiftKey && (activeElement === first || activeElement === initialFocusRef?.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel, dialogRef, initialFocusRef])
}
