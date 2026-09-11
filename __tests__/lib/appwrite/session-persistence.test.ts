import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPersistedSession,
  forgetSessionOnClient,
  loadPersistedSession,
  rememberSessionOnClient,
  restoreSessionOnClient,
  SESSION_STORAGE_KEY,
  savePersistedSession,
} from '@/lib/appwrite/session-persistence'

function createTarget() {
  return { setSession: vi.fn() }
}

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.has(key) ? (store.get(key) ?? null) : null
    },
    key(index) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(String(key), String(value))
    },
  }
}

function installLocalStorage() {
  const existing = window.localStorage
  if (existing && typeof existing.getItem === 'function') {
    return existing
  }
  const storage = createMemoryStorage()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: storage,
  })
  return storage
}

describe('session persistence', () => {
  beforeEach(() => {
    const storage = installLocalStorage()
    storage.removeItem(SESSION_STORAGE_KEY)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pins SESSION_STORAGE_KEY to home-pantry-appwrite-session', () => {
    expect(SESSION_STORAGE_KEY).toBe('home-pantry-appwrite-session')
  })

  it('saves then loads the trimmed secret', () => {
    savePersistedSession('secret-1')
    expect(loadPersistedSession()).toBe('secret-1')
  })

  it('returns null after clear', () => {
    savePersistedSession('secret-1')
    clearPersistedSession()
    expect(loadPersistedSession()).toBeNull()
  })

  it('stores a trimmed secret', () => {
    savePersistedSession('  secret-1  ')
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe('secret-1')
    expect(loadPersistedSession()).toBe('secret-1')
  })

  it('does not write the key for empty or whitespace secrets', () => {
    savePersistedSession('')
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    savePersistedSession('   ')
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('rememberSessionOnClient saves and calls setSession with the secret', () => {
    const target = createTarget()
    rememberSessionOnClient(target, 'abc')
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe('abc')
    expect(loadPersistedSession()).toBe('abc')
    expect(target.setSession).toHaveBeenCalledWith('abc')
  })

  it('rememberSessionOnClient does not call setSession for an empty secret', () => {
    const target = createTarget()
    rememberSessionOnClient(target, '')
    expect(target.setSession).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('restoreSessionOnClient calls setSession with the saved secret', () => {
    savePersistedSession('secret-1')
    const target = createTarget()
    restoreSessionOnClient(target)
    expect(target.setSession).toHaveBeenCalledWith('secret-1')
  })

  it('restoreSessionOnClient does not call setSession when storage is empty', () => {
    const target = createTarget()
    restoreSessionOnClient(target)
    expect(target.setSession).not.toHaveBeenCalled()
  })

  it('forgetSessionOnClient removes the key and calls setSession with an empty string', () => {
    savePersistedSession('secret-1')
    const target = createTarget()
    forgetSessionOnClient(target)
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(loadPersistedSession()).toBeNull()
    expect(target.setSession).toHaveBeenCalledWith('')
  })

  it('is SSR-safe when window is missing', () => {
    const originalWindow = globalThis.window
    Reflect.deleteProperty(globalThis, 'window')
    if (typeof globalThis.window !== 'undefined') {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: undefined,
      })
    }

    try {
      expect(loadPersistedSession()).toBeNull()
      expect(() => savePersistedSession('secret')).not.toThrow()
      expect(() => clearPersistedSession()).not.toThrow()
      const target = createTarget()
      expect(() => restoreSessionOnClient(target)).not.toThrow()
      expect(() => rememberSessionOnClient(target, 'abc')).not.toThrow()
      expect(() => forgetSessionOnClient(target)).not.toThrow()
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
    }
  })

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const target = createTarget()
    expect(() => savePersistedSession('secret')).not.toThrow()
    expect(() => rememberSessionOnClient(target, 'secret')).not.toThrow()
  })

  it('binds restoreSessionOnClient on the singleton after Client construction', () => {
    const source = readFileSync(path.join(process.cwd(), 'lib/appwrite/client.ts'), 'utf8')
    const constructIndex = source.indexOf('new Client()')
    const restoreIndex = source.indexOf('restoreSessionOnClient(client)')
    expect(constructIndex).toBeGreaterThanOrEqual(0)
    expect(restoreIndex).toBeGreaterThan(constructIndex)
  })
})
