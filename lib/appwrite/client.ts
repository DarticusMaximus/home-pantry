import { Account, Client, Databases, type Models } from 'appwrite'
import { restoreSessionOnClient } from './session-persistence'

export type User = Models.User<Models.Preferences>

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID

if (!endpoint || !projectId) {
  throw new Error('Missing Appwrite environment variables')
}

const client = new Client().setEndpoint(endpoint).setProject(projectId)
restoreSessionOnClient(client)

const account = new Account(client)
const databases = new Databases(client)

export { client, account, databases }
