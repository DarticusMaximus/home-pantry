'use client'

import { useEffect, useRef, useState } from 'react'

export function useDelayedLoading(isLoading: boolean, delayMs = 150, minDisplayMs = 250): boolean {
  const [showSkeleton, setShowSkeleton] = useState(false)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasShowingRef = useRef(false)

  useEffect(() => {
    if (isLoading) {
      if (showTimerRef.current) clearTimeout(showTimerRef.current)
      showTimerRef.current = setTimeout(() => {
        setShowSkeleton(true)
        wasShowingRef.current = true
      }, delayMs)
    } else {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current)
        showTimerRef.current = null
      }

      if (wasShowingRef.current) {
        if (minDisplayTimerRef.current) clearTimeout(minDisplayTimerRef.current)
        minDisplayTimerRef.current = setTimeout(() => {
          setShowSkeleton(false)
          wasShowingRef.current = false
        }, minDisplayMs)
      } else {
        setShowSkeleton(false)
      }
    }

    return () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current)
        showTimerRef.current = null
      }
      if (minDisplayTimerRef.current) {
        clearTimeout(minDisplayTimerRef.current)
        minDisplayTimerRef.current = null
      }
    }
  }, [isLoading, delayMs, minDisplayMs])

  return showSkeleton
}
