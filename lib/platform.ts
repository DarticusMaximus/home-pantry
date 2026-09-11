export function detectPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') {
    return 'desktop'
  }

  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    return 'ios'
  }

  if (/Android/.test(navigator.userAgent)) {
    return 'android'
  }

  return 'desktop'
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches
    ) {
      return true
    }
  } catch {}

  return (
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
