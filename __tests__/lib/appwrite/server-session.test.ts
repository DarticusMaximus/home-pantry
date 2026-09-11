import { AppwriteException } from 'appwrite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGet = vi.fn()
const mockSetJWT = vi.fn()
const mockLog = vi.fn()

vi.mock('@/lib/appwrite/error-logging', () => ({
  logAppwriteError: (...args: unknown[]) => mockLog(...args),
}))

vi.mock('appwrite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('appwrite')>()

  class MockClient {
    setEndpoint() {
      return this
    }
    setProject() {
      return this
    }
    setJWT(value: string) {
      mockSetJWT(value)
      return this
    }
  }

  class MockAccount {
    get() {
      return mockGet()
    }
  }

  return {
    ...actual,
    Client: MockClient,
    Account: MockAccount,
  }
})

import { getUserFromJwt } from '@/lib/appwrite/server-session'

describe('getUserFromJwt', () => {
  const originalEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
  const originalProject = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://appwrite.example/v1'
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'proj'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = originalEndpoint
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = originalProject
  })

  it('returns null without calling Appwrite when jwt is missing', async () => {
    expect(await getUserFromJwt(undefined)).toBeNull()
    expect(await getUserFromJwt('   ')).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockSetJWT).not.toHaveBeenCalled()
  })

  it('returns the user when jwt is valid', async () => {
    mockGet.mockResolvedValueOnce({ $id: 'user-1' })

    const result = await getUserFromJwt(' jwt-token ')

    expect(mockSetJWT).toHaveBeenCalledWith('jwt-token')
    expect(result).toEqual({ $id: 'user-1' })
  })

  it('returns null on 401 without logging', async () => {
    mockGet.mockRejectedValueOnce(
      new AppwriteException('User (role: guests) missing scope (account)', 401),
    )

    const result = await getUserFromJwt('expired')

    expect(result).toBeNull()
    expect(mockLog).not.toHaveBeenCalled()
  })

  it('rejects PantryUnreachableError and still logs on other failures', async () => {
    mockGet.mockRejectedValueOnce(new Error('timeout'))

    await expect(getUserFromJwt('jwt-token')).rejects.toMatchObject({
      name: 'PantryUnreachableError',
    })
    expect(mockLog).toHaveBeenCalledWith(
      { service: 'auth', operation: 'getUserFromJwt' },
      expect.any(Error),
    )
  })

  it('rejects PantryUnreachableError when account.get never settles', async () => {
    vi.useFakeTimers()
    mockGet.mockReturnValueOnce(new Promise(() => {}))

    const resultPromise = getUserFromJwt('jwt-token')
    vi.advanceTimersByTime(8000)

    await expect(resultPromise).rejects.toMatchObject({
      name: 'PantryUnreachableError',
    })
    expect(mockLog).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
