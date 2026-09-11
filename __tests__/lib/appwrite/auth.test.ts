import { AppwriteException, type Models } from 'appwrite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthError,
  checkSession,
  createSessionJwt,
  getCurrentUser,
  login,
  logout,
  register,
} from '@/lib/appwrite/auth'
import { SESSION_STORAGE_KEY } from '@/lib/appwrite/session-persistence'

const mockUser = {
  $id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
} as Models.User<Models.Preferences>

const mockLog = vi.fn()

vi.mock('@/lib/appwrite/error-logging', () => ({
  logAppwriteError: (...args: unknown[]) => mockLog(...args),
}))

vi.mock('@/lib/appwrite/client', () => ({
  account: {
    createEmailPasswordSession: vi.fn(),
    get: vi.fn(),
    deleteSession: vi.fn(),
    create: vi.fn(),
    createJWT: vi.fn(),
  },
  client: {
    setSession: vi.fn(),
  },
}))

import { account, client } from '@/lib/appwrite/client'

const mockedAccount = vi.mocked(account)
const mockedSetSession = vi.mocked(client.setSession)

function installLocalStorage() {
  const existing = window.localStorage
  if (existing && typeof existing.getItem === 'function') {
    return existing
  }
  const store = new Map<string, string>()
  const storage: Storage = {
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
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: storage,
  })
  return storage
}

describe('auth lib', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const storage = installLocalStorage()
    storage.removeItem(SESSION_STORAGE_KEY)
  })

  describe('login', () => {
    it('creates session and returns user on successful login', async () => {
      mockedAccount.createEmailPasswordSession.mockResolvedValueOnce({
        secret: 'sess-secret-1',
      } as Models.Session)
      mockedAccount.get.mockResolvedValueOnce(mockUser)

      const result = await login('test@example.com', 'password123')

      expect(mockedAccount.createEmailPasswordSession).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      )
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe('sess-secret-1')
      expect(mockedSetSession).toHaveBeenCalledWith('sess-secret-1')
      expect(mockedSetSession.mock.invocationCallOrder[0]).toBeLessThan(
        mockedAccount.get.mock.invocationCallOrder[0],
      )
      expect(mockedAccount.get).toHaveBeenCalled()
      expect(result).toEqual(mockUser)
    })

    it('throws AuthError on AppwriteException', async () => {
      const appwriteError = new AppwriteException('Invalid credentials', 401)
      mockedAccount.createEmailPasswordSession.mockRejectedValueOnce(appwriteError)

      await expect(login('test@example.com', 'wrong')).rejects.toMatchObject({
        name: 'AuthError',
        message: 'Invalid email or password. Please try again.',
        code: '401',
      })
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
      expect(mockedSetSession).not.toHaveBeenCalled()
    })

    it('does not persist or setSession when the create-session secret is empty', async () => {
      mockedAccount.createEmailPasswordSession.mockResolvedValueOnce({
        secret: '',
      } as Models.Session)
      mockedAccount.get.mockResolvedValueOnce(mockUser)

      const result = await login('test@example.com', 'password123')

      expect(result).toEqual(mockUser)
      expect(mockedAccount.get).toHaveBeenCalled()
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
      expect(mockedSetSession).not.toHaveBeenCalled()
    })

    it('wraps non-Appwrite errors as AuthError', async () => {
      const genericError = new Error('Network error')
      mockedAccount.createEmailPasswordSession.mockRejectedValueOnce(genericError)

      await expect(login('test@example.com', 'password')).rejects.toMatchObject({
        name: 'AuthError',
        message: 'Network error',
      })
    })
  })

  describe('register', () => {
    it('creates account and logs in user', async () => {
      mockedAccount.create.mockResolvedValueOnce({} as Models.User<Models.Preferences>)
      mockedAccount.createEmailPasswordSession.mockResolvedValueOnce({
        secret: 'sess-secret-1',
      } as Models.Session)
      mockedAccount.get.mockResolvedValueOnce(mockUser)

      const result = await register('test@example.com', 'password123', 'Test User')

      expect(mockedAccount.create).toHaveBeenCalledWith(
        expect.any(String),
        'test@example.com',
        'password123',
        'Test User',
      )
      expect(mockedAccount.createEmailPasswordSession).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      )
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe('sess-secret-1')
      expect(result).toEqual(mockUser)
    })

    it('creates account without name', async () => {
      mockedAccount.create.mockResolvedValueOnce({} as Models.User<Models.Preferences>)
      mockedAccount.createEmailPasswordSession.mockResolvedValueOnce({
        secret: 'sess-secret-1',
      } as Models.Session)
      mockedAccount.get.mockResolvedValueOnce(mockUser)

      const result = await register('test@example.com', 'password123')

      expect(mockedAccount.create).toHaveBeenCalledWith(
        expect.any(String),
        'test@example.com',
        'password123',
        undefined,
      )
      expect(result).toEqual(mockUser)
    })

    it('throws AuthError on AppwriteException', async () => {
      const appwriteError = new AppwriteException('Email already exists', 409)
      mockedAccount.create.mockRejectedValueOnce(appwriteError)

      await expect(register('test@example.com', 'password')).rejects.toMatchObject({
        name: 'AuthError',
        message: 'An account with this email already exists.',
        code: '409',
      })
    })

    it('wraps non-Appwrite errors as AuthError', async () => {
      const genericError = new Error('Network error')
      mockedAccount.create.mockRejectedValueOnce(genericError)

      await expect(register('test@example.com', 'password')).rejects.toMatchObject({
        name: 'AuthError',
        message: 'Network error',
      })
    })
  })

  describe('logout', () => {
    it('deletes current session', async () => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'sess-secret-1')
      mockedAccount.deleteSession.mockResolvedValueOnce({} as Models.Session)

      await logout()

      expect(mockedAccount.deleteSession).toHaveBeenCalledWith('current')
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
      expect(mockedSetSession).toHaveBeenCalledWith('')
    })

    it('throws AuthError on AppwriteException', async () => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'sess-secret-1')
      const appwriteError = new AppwriteException('Session not found', 404)
      mockedAccount.deleteSession.mockRejectedValueOnce(appwriteError)

      await expect(logout()).rejects.toMatchObject({
        name: 'AuthError',
        message: 'Session not found',
        code: '404',
      })
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
      expect(mockedSetSession).toHaveBeenCalledWith('')
    })

    it('wraps non-Appwrite errors as AuthError', async () => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'sess-secret-1')
      const genericError = new Error('Network error')
      mockedAccount.deleteSession.mockRejectedValueOnce(genericError)

      await expect(logout()).rejects.toMatchObject({
        name: 'AuthError',
        message: 'Network error',
      })
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
      expect(mockedSetSession).toHaveBeenCalledWith('')
    })
  })

  describe('getCurrentUser', () => {
    it('returns user when session exists', async () => {
      mockedAccount.get.mockResolvedValueOnce(mockUser)

      const result = await getCurrentUser()

      expect(result).toEqual(mockUser)
    })

    it('returns null on Appwrite 401', async () => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'sess-secret-1')
      mockedAccount.get.mockRejectedValueOnce(new AppwriteException('Unauthorized', 401))

      const result = await getCurrentUser()

      expect(result).toBeNull()
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
      expect(mockedSetSession).toHaveBeenCalledWith('')
    })

    it('rejects PantryUnreachableError on Appwrite 500', async () => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'sess-secret-1')
      mockedAccount.get.mockRejectedValueOnce(new AppwriteException('Server error', 500))

      await expect(getCurrentUser()).rejects.toMatchObject({
        name: 'PantryUnreachableError',
      })
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe('sess-secret-1')
      expect(mockedSetSession).not.toHaveBeenCalled()
    })

    it('rejects PantryUnreachableError on network Error', async () => {
      mockedAccount.get.mockRejectedValueOnce(new Error('No session'))

      await expect(getCurrentUser()).rejects.toMatchObject({
        name: 'PantryUnreachableError',
      })
    })

    it('does not forget the persisted session on network Error', async () => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'sess-secret-1')
      mockedAccount.get.mockRejectedValueOnce(new Error('offline'))

      await expect(getCurrentUser()).rejects.toMatchObject({
        name: 'PantryUnreachableError',
      })
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe('sess-secret-1')
      expect(mockedSetSession).not.toHaveBeenCalled()
    })

    it('rejects PantryUnreachableError when account.get never settles', async () => {
      vi.useFakeTimers()
      mockedAccount.get.mockReturnValueOnce(new Promise(() => {}))

      const resultPromise = getCurrentUser()
      vi.advanceTimersByTime(8000)

      await expect(resultPromise).rejects.toMatchObject({
        name: 'PantryUnreachableError',
      })
      vi.useRealTimers()
    })
  })

  describe('createSessionJwt', () => {
    it('returns the jwt when the current session can mint one', async () => {
      mockedAccount.createJWT.mockResolvedValueOnce({ jwt: 'jwt-from-browser' })

      const result = await createSessionJwt()

      expect(result).toBe('jwt-from-browser')
    })

    it('returns null on a 401', async () => {
      mockedAccount.createJWT.mockRejectedValueOnce(new AppwriteException('No session', 401))

      const result = await createSessionJwt()

      expect(result).toBeNull()
    })

    it('rejects PantryUnreachableError on network Error without clearing the session', async () => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'sess-secret-1')
      mockedAccount.createJWT.mockRejectedValueOnce(new Error('Network error'))

      await expect(createSessionJwt()).rejects.toMatchObject({
        name: 'PantryUnreachableError',
      })
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe('sess-secret-1')
      expect(mockedSetSession).not.toHaveBeenCalled()
      expect(mockLog).toHaveBeenCalledWith(
        { service: 'auth', operation: 'createSessionJwt' },
        expect.any(Error),
      )
    })

    it('rejects PantryUnreachableError on Appwrite 500 without clearing the session', async () => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'sess-secret-1')
      mockedAccount.createJWT.mockRejectedValueOnce(new AppwriteException('Server error', 500))

      await expect(createSessionJwt()).rejects.toMatchObject({
        name: 'PantryUnreachableError',
      })
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe('sess-secret-1')
      expect(mockedSetSession).not.toHaveBeenCalled()
      expect(mockLog).toHaveBeenCalledWith(
        { service: 'auth', operation: 'createSessionJwt' },
        expect.any(Error),
      )
    })

    it('rejects PantryUnreachableError when account.createJWT never settles', async () => {
      vi.useFakeTimers()
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'sess-secret-1')
      mockedAccount.createJWT.mockReturnValueOnce(new Promise(() => {}))

      const resultPromise = createSessionJwt()
      vi.advanceTimersByTime(8000)

      await expect(resultPromise).rejects.toMatchObject({
        name: 'PantryUnreachableError',
      })
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe('sess-secret-1')
      expect(mockedSetSession).not.toHaveBeenCalled()
      expect(mockLog).not.toHaveBeenCalled()
      vi.useRealTimers()
    })
  })

  describe('checkSession', () => {
    it('returns true when session is valid', async () => {
      mockedAccount.get.mockResolvedValueOnce(mockUser)

      const result = await checkSession()

      expect(result).toBe(true)
    })

    it('returns false when no session', async () => {
      mockedAccount.get.mockRejectedValueOnce(new Error('No session'))

      const result = await checkSession()

      expect(result).toBe(false)
    })
  })

  describe('AuthError', () => {
    it('creates error with message and code', () => {
      const error = new AuthError('Test error', '401')

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('401')
      expect(error.name).toBe('AuthError')
    })

    it('creates error without code', () => {
      const error = new AuthError('Test error')

      expect(error.message).toBe('Test error')
      expect(error.code).toBeUndefined()
    })
  })

  describe('error mapping edge cases', () => {
    it('handles generic 401 error', async () => {
      const error = new AppwriteException('Some other 401', 401)
      mockedAccount.createEmailPasswordSession.mockRejectedValueOnce(error)
      await expect(login('a', 'b')).rejects.toMatchObject({
        message: 'Your session has expired. Please sign in again.',
      })
    })

    it('handles 429 error', async () => {
      const error = new AppwriteException('Rate limit', 429)
      mockedAccount.createEmailPasswordSession.mockRejectedValueOnce(error)
      await expect(login('a', 'b')).rejects.toMatchObject({
        message: 'Too many attempts. Please wait and try again.',
      })
    })

    it('handles 500 error', async () => {
      const error = new AppwriteException('Server error', 500)
      mockedAccount.createEmailPasswordSession.mockRejectedValueOnce(error)
      await expect(login('a', 'b')).rejects.toMatchObject({
        message: 'Authentication service is temporarily unavailable. Please try again.',
      })
    })

    it('handles non-Error objects', async () => {
      mockedAccount.createEmailPasswordSession.mockRejectedValueOnce('string error')
      await expect(login('a', 'b')).rejects.toMatchObject({
        message: 'Authentication failed',
      })
    })

    it('returns same AuthError if already an AuthError', async () => {
      const authError = new AuthError('Already auth error')
      // This is internal to toAuthError but we can trigger it via login if we could mock toAuthError,
      // but it's not exported. We can just test that login throws it.
      mockedAccount.createEmailPasswordSession.mockImplementationOnce(() => {
        throw authError
      })
      await expect(login('a', 'b')).rejects.toBe(authError)
    })
  })
})
