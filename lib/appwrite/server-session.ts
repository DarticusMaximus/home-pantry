import { Account, AppwriteException, Client } from 'appwrite'
import { PantryUnreachableError, withTimeout } from '@/lib/pantry-reachability'
import type { User } from './client'
import { logAppwriteError } from './error-logging'

export async function getUserFromJwt(jwt: string | undefined | null): Promise<User | null> {
  const token = jwt?.trim()
  if (!token) {
    return null
  }

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
  if (!endpoint || !projectId) {
    return null
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(token)
  const account = new Account(client)

  try {
    return await withTimeout(account.get())
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 401) {
      return null
    }
    if (error instanceof PantryUnreachableError) {
      throw error
    }
    logAppwriteError({ service: 'auth', operation: 'getUserFromJwt' }, error)
    throw new PantryUnreachableError()
  }
}
