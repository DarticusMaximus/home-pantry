export const SESSION_STORAGE_KEY = 'home-pantry-appwrite-session'

type SessionClient = {
  setSession: (value: string) => unknown
}

function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

export function loadPersistedSession(): string | null {
  if (!isStorageAvailable()) return null
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const trimmed = raw.trim()
    if (!trimmed) return null
    return trimmed
  } catch {
    return null
  }
}

export function savePersistedSession(secret: string): void {
  const trimmed = secret.trim()
  if (!trimmed) return
  if (!isStorageAvailable()) return
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, trimmed)
  } catch {
    return
  }
}

export function clearPersistedSession(): void {
  if (!isStorageAvailable()) return
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    return
  }
}

export function restoreSessionOnClient(target: SessionClient): void {
  try {
    const secret = loadPersistedSession()
    if (!secret) return
    target.setSession(secret)
  } catch {
    return
  }
}

export function rememberSessionOnClient(target: SessionClient, secret: string): void {
  try {
    const trimmed = secret.trim()
    if (!trimmed) return
    savePersistedSession(trimmed)
    target.setSession(trimmed)
  } catch {
    return
  }
}

export function forgetSessionOnClient(target: SessionClient): void {
  try {
    clearPersistedSession()
    target.setSession('')
  } catch {
    return
  }
}
