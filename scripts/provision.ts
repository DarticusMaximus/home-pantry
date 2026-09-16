import { pathToFileURL } from 'node:url'
import {
  APPWRITE_SCRIPT_ENV_VARS,
  describeResponseError,
  loadLocalEnv,
  missingEnvMessage,
} from './lib/operator-helpers'
import { seed } from './seed'
import { setup } from './setup-appwrite'

loadLocalEnv()

const DATABASE_ID = 'home_pantry'
const COLLECTIONS = ['locations', 'categories', 'item_templates', 'items'] as const
const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 120_000
const FETCH_TIMEOUT_MS = 30_000

type AttributeRecord = {
  key?: string
  status?: string
}

type AttributesList = {
  attributes?: AttributeRecord[]
}

async function apiGet(path: string): Promise<AttributesList> {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
  const apiKey = process.env.APPWRITE_API_KEY
  let response: Response
  try {
    response = await fetch(`${endpoint}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId as string,
        'X-Appwrite-Key': apiKey as string,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }

  if (!response.ok) {
    throw new Error(await describeResponseError(response))
  }

  return response.json() as Promise<AttributesList>
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForAttributesAvailable() {
  const startedAt = Date.now()

  for (;;) {
    let pendingCollection: (typeof COLLECTIONS)[number] | undefined

    for (const collectionId of COLLECTIONS) {
      const payload = await apiGet(
        `/databases/${DATABASE_ID}/collections/${collectionId}/attributes`,
      )
      const attributes = Array.isArray(payload.attributes) ? payload.attributes : []

      for (const attr of attributes) {
        const status = attr.status
        const key = typeof attr.key === 'string' ? attr.key : 'unknown'
        if (status === 'failed' || status === 'stuck') {
          throw new Error(`Attribute ${key} on collection ${collectionId} ${status}`)
        }
        if (status !== 'available' && pendingCollection === undefined) {
          pendingCollection = collectionId
        }
      }
    }

    if (pendingCollection === undefined) {
      return
    }

    if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
      throw new Error(`Timed out waiting for attributes on collection ${pendingCollection}`)
    }

    await sleep(POLL_INTERVAL_MS)
  }
}

export async function provision() {
  const missingEnv = missingEnvMessage(process.env, APPWRITE_SCRIPT_ENV_VARS)
  if (missingEnv) {
    throw new Error(missingEnv)
  }

  await setup({ wipe: false })
  await waitForAttributesAvailable()
  await seed()
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedAsScript) {
  provision().catch((error) => {
    console.error('Provision failed:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
