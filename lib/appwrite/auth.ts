import { AppwriteException, ID } from 'appwrite'
import { PantryUnreachableError, withTimeout } from '@/lib/pantry-reachability'
import { account, client, type User } from './client'
import { logAppwriteError } from './error-logging'
import { forgetSessionOnClient, rememberSessionOnClient } from './session-persistence'

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

function mapAuthErrorMessage(error: AppwriteException): string {
  if (error.code === 401) {
    if (error.message.toLowerCase().includes('invalid credentials')) {
      return 'Invalid email or password. Please try again.'
    }

    return 'Your session has expired. Please sign in again.'
  }

  if (error.code === 409) {
    return 'An account with this email already exists.'
  }

  if (error.code === 429) {
    return 'Too many attempts. Please wait and try again.'
  }

  if (error.code && error.code >= 500) {
    return 'Authentication service is temporarily unavailable. Please try again.'
  }

  return error.message || 'Authentication failed'
}

function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error
  }

  if (error instanceof AppwriteException) {
    return new AuthError(mapAuthErrorMessage(error), error.code?.toString())
  }

  if (error instanceof Error) {
    return new AuthError(error.message)
  }

  return new AuthError('Authentication failed')
}

export async function login(email: string, password: string): Promise<User> {
  try {
    const session = await account.createEmailPasswordSession(email, password)
    rememberSessionOnClient(client, session.secret ?? '')
    return await account.get()
  } catch (error) {
    logAppwriteError({ service: 'auth', operation: 'login' }, error)
    throw toAuthError(error)
  }
}

export async function register(email: string, password: string, name?: string): Promise<User> {
  try {
    await account.create(ID.unique(), email, password, name)
    return await login(email, password)
  } catch (error) {
    logAppwriteError({ service: 'auth', operation: 'register' }, error)
    throw toAuthError(error)
  }
}

export async function logout(): Promise<void> {
  try {
    await account.deleteSession('current')
  } catch (error) {
    logAppwriteError({ service: 'auth', operation: 'logout' }, error)
    throw toAuthError(error)
  } finally {
    forgetSessionOnClient(client)
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await withTimeout(account.get())
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 401) {
      forgetSessionOnClient(client)
      return null
    }
    if (error instanceof PantryUnreachableError) {
      throw error
    }
    logAppwriteError({ service: 'auth', operation: 'getCurrentUser' }, error)
    throw new PantryUnreachableError()
  }
}

export async function createSessionJwt(): Promise<string | null> {
  try {
    const result = await withTimeout(account.createJWT())
    return result.jwt
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 401) {
      return null
    }
    if (error instanceof PantryUnreachableError) {
      throw error
    }
    logAppwriteError({ service: 'auth', operation: 'createSessionJwt' }, error)
    throw new PantryUnreachableError()
  }
}

export async function checkSession(): Promise<boolean> {
  try {
    await account.get()
    return true
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 401) {
      return false
    }
    logAppwriteError({ service: 'auth', operation: 'checkSession' }, error)
    return false
  }
}
