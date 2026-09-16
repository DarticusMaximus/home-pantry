import { afterEach, describe, expect, it, vi } from 'vitest'

const SENTINEL_API_KEY = ['sk-', 'sentinel-secret-value-never-print-3f9c2a'].join('')

const PLACEHOLDER_ENDPOINT = 'https://cloud.appwrite.test/v1'
const PLACEHOLDER_PROJECT_ID = 'smoke-project-1'

const DATABASE_ID = 'home_pantry'

const COLLECTIONS = ['locations', 'categories', 'item_templates', 'items'] as const

const EXPECTED_COUNTS: Record<string, number> = {
  locations: 3,
  categories: 8,
  item_templates: 12,
  items: 0,
}

const SEED_SKIP_LINES = [
  'Skipped - locations already exist',
  'Skipped - categories already exist',
  'Skipped - templates already exist',
]

const LOGIN_URL = 'http://localhost:3100/login'

type StubResponse = {
  ok: boolean
  status: number
  statusText?: string
  json: () => Promise<unknown>
  text?: () => Promise<string>
}

type StubAttribute = { key: string; type: string; status: string }

type StubIndex = { key: string; type: string; attributes: string[] }

type StubCollectionSpec = {
  missing?: boolean
  permissions?: string[]
  attributes?: StubAttribute[]
  indexes?: StubIndex[]
  documentTotal?: number
}

type RestStubOptions = {
  databaseMissing?: boolean
  forceStatus?: number
  collections?: Record<string, StubCollectionSpec>
}

type RecordedCall = { method: string; url: string; apiKeyHeader: string; projectHeader: string }

function jsonResponse(body: unknown, status = 200, statusText = ''): StubResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

function notFoundResponse(message: string): StubResponse {
  return jsonResponse({ message }, 404, 'Not Found')
}

function defaultCollections(): Record<string, StubCollectionSpec> {
  return {
    locations: {
      documentTotal: EXPECTED_COUNTS.locations,
      permissions: ['read("users")', 'create("users")', 'update("users")', 'delete("users")'],
    },
    categories: {
      documentTotal: EXPECTED_COUNTS.categories,
      permissions: ['read("users")', 'create("users")', 'update("users")', 'delete("users")'],
    },
    item_templates: {
      documentTotal: EXPECTED_COUNTS.item_templates,
      permissions: ['read("users")', 'create("users")', 'update("users")', 'delete("users")'],
      attributes: [
        { key: 'name', type: 'string', status: 'available' },
        { key: 'categoryId', type: 'string', status: 'available' },
        { key: 'defaultUnit', type: 'string', status: 'available' },
        { key: 'defaultQuantity', type: 'float', status: 'available' },
        { key: 'createdAt', type: 'string', status: 'available' },
        { key: 'updatedAt', type: 'string', status: 'available' },
      ],
      indexes: [
        { key: 'name_index', type: 'fulltext', attributes: ['name'] },
        { key: 'category_index', type: 'key', attributes: ['categoryId'] },
      ],
    },
    items: {
      documentTotal: EXPECTED_COUNTS.items,
      permissions: ['read("users")', 'create("users")', 'update("users")', 'delete("users")'],
      attributes: [
        { key: 'name', type: 'string', status: 'available' },
        { key: 'quantity', type: 'float', status: 'available' },
        { key: 'locationId', type: 'string', status: 'available' },
      ],
      indexes: [
        { key: 'name_index', type: 'fulltext', attributes: ['name'] },
        { key: 'location_index', type: 'key', attributes: ['locationId'] },
      ],
    },
  }
}

function collectionIdFromUrl(url: string): string {
  return (
    String(url)
      .split('?')[0]
      ?.match(/\/collections\/([^/]+)/)?.[1] ?? ''
  )
}

function readHeader(init: RequestInit | undefined, name: string): string {
  const headers = init?.headers
  if (!headers) {
    return ''
  }
  if (headers instanceof Headers) {
    return headers.get(name) ?? ''
  }
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key === name)
    return entry ? String(entry[1]) : ''
  }
  const record = headers as Record<string, string>
  return record[name] ?? ''
}

function installRestStub(options: RestStubOptions = {}) {
  const collections = { ...defaultCollections(), ...options.collections }
  const calls: RecordedCall[] = []

  const fetchMock = vi.fn(async (url: string, init?: RequestInit): Promise<StubResponse> => {
    const href = String(url)
    const method = init?.method ?? 'GET'
    calls.push({
      method,
      url: href,
      apiKeyHeader: readHeader(init, 'X-Appwrite-Key'),
      projectHeader: readHeader(init, 'X-Appwrite-Project'),
    })

    if (options.forceStatus !== undefined) {
      return jsonResponse({ message: 'forced failure' }, options.forceStatus, 'Server Error')
    }

    if (href.includes('/attributes')) {
      const collectionId = collectionIdFromUrl(href)
      const spec = collections[collectionId]
      if (!spec || spec.missing) {
        return notFoundResponse(`Collection ${collectionId} not found`)
      }
      const attributes = spec.attributes ?? []
      return jsonResponse({
        total: attributes.length,
        attributesTotal: attributes.length,
        attributes,
      })
    }

    if (href.includes('/indexes')) {
      const collectionId = collectionIdFromUrl(href)
      const spec = collections[collectionId]
      if (!spec || spec.missing) {
        return notFoundResponse(`Collection ${collectionId} not found`)
      }
      const indexes = spec.indexes ?? []
      return jsonResponse({ total: indexes.length, indexes })
    }

    if (href.includes('/documents')) {
      const collectionId = collectionIdFromUrl(href)
      const spec = collections[collectionId]
      if (!spec || spec.missing) {
        return notFoundResponse(`Collection ${collectionId} not found`)
      }
      return jsonResponse({ total: spec.documentTotal ?? 0, documents: [] })
    }

    const collectionMatch = String(href)
      .split('?')[0]
      ?.match(/\/collections\/([^/]+)\/?$/)
    if (collectionMatch) {
      const collectionId = collectionMatch[1] ?? ''
      const spec = collections[collectionId]
      if (!spec || spec.missing) {
        return notFoundResponse(`Collection ${collectionId} not found`)
      }
      const permissions = spec.permissions ?? []
      return jsonResponse({
        $id: collectionId,
        name: collectionId,
        permissions,
        $permissions: permissions,
        documentSecurity: false,
      })
    }

    if (new RegExp(`/databases/${DATABASE_ID}/?$`).test(String(href).split('?')[0] ?? '')) {
      if (options.databaseMissing) {
        return notFoundResponse('Database not found')
      }
      return jsonResponse({ $id: DATABASE_ID, name: 'Home Pantry' })
    }

    return jsonResponse({}, 404, 'Not Found')
  })

  vi.stubGlobal('fetch', fetchMock)

  return { fetchMock, calls: () => [...calls] }
}

function smokeContext() {
  return {
    endpoint: PLACEHOLDER_ENDPOINT,
    projectId: PLACEHOLDER_PROJECT_ID,
    apiKey: SENTINEL_API_KEY,
  }
}

function fullEnv(): Record<string, string> {
  return {
    NEXT_PUBLIC_APPWRITE_ENDPOINT: PLACEHOLDER_ENDPOINT,
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: PLACEHOLDER_PROJECT_ID,
    APPWRITE_API_KEY: SENTINEL_API_KEY,
  }
}

async function captureError(run: () => Promise<unknown>): Promise<Error> {
  const caught = await run().catch((error: unknown) => error)
  expect(caught).toBeInstanceOf(Error)
  return caught as Error
}

async function loadSmoke() {
  return import('@/scripts/smoke-image')
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('smoke-image env validation', () => {
  it('accepts a complete environment', async () => {
    const { validateSmokeEnv } = await loadSmoke()
    expect(validateSmokeEnv(fullEnv())).toBeNull()
  })

  it('names a missing NEXT_PUBLIC_APPWRITE_ENDPOINT without printing the API key', async () => {
    const { validateSmokeEnv } = await loadSmoke()
    const env = fullEnv()
    delete env.NEXT_PUBLIC_APPWRITE_ENDPOINT
    const message = validateSmokeEnv(env)
    expect(message).toBeTruthy()
    expect(message).toContain('NEXT_PUBLIC_APPWRITE_ENDPOINT')
    expect(message).not.toContain(SENTINEL_API_KEY)
  })

  it('names a missing NEXT_PUBLIC_APPWRITE_PROJECT_ID without printing the API key', async () => {
    const { validateSmokeEnv } = await loadSmoke()
    const env = fullEnv()
    delete env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
    const message = validateSmokeEnv(env)
    expect(message).toBeTruthy()
    expect(message).toContain('NEXT_PUBLIC_APPWRITE_PROJECT_ID')
    expect(message).not.toContain(SENTINEL_API_KEY)
  })

  it('names a missing APPWRITE_API_KEY without printing the key value', async () => {
    const { validateSmokeEnv } = await loadSmoke()
    const env = fullEnv()
    delete env.APPWRITE_API_KEY
    const message = validateSmokeEnv(env)
    expect(message).toBeTruthy()
    expect(message).toContain('APPWRITE_API_KEY')
    expect(message).not.toContain(SENTINEL_API_KEY)
  })
})

describe('smoke-image REST assertions', () => {
  it('resolves when database, collections, attributes, indexes, permissions, and counts all match, using only GET requests with the API key header', async () => {
    const smoke = await loadSmoke()
    const stub = installRestStub()
    const ctx = smokeContext()

    await smoke.assertDatabaseExists(ctx)
    for (const collectionId of COLLECTIONS) {
      await smoke.assertCollectionExists(ctx, collectionId)
      await smoke.assertReadUsersPermission(ctx, collectionId)
      await smoke.assertDocumentCount(ctx, collectionId, EXPECTED_COUNTS[collectionId])
    }
    await smoke.assertAttributeAvailable(ctx, 'item_templates', 'defaultUnit')
    await smoke.assertAttributeAvailable(ctx, 'item_templates', 'defaultQuantity')
    await smoke.assertFulltextIndex(ctx, 'item_templates', 'name_index')
    await smoke.assertFulltextIndex(ctx, 'items', 'name_index')

    const calls = stub.calls()
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call.method).toBe('GET')
      expect(call.apiKeyHeader).toBe(SENTINEL_API_KEY)
      expect(call.projectHeader).toBe(PLACEHOLDER_PROJECT_ID)
      expect(call.url.startsWith(PLACEHOLDER_ENDPOINT)).toBe(true)
    }
  })

  it('rejects a missing home_pantry database naming the database id', async () => {
    const smoke = await loadSmoke()
    installRestStub({ databaseMissing: true })
    const error = await captureError(() => smoke.assertDatabaseExists(smokeContext()))
    expect(error.message).toContain(DATABASE_ID)
  })

  it('rejects a missing items collection naming items', async () => {
    const smoke = await loadSmoke()
    installRestStub({ collections: { items: { missing: true } } })
    const error = await captureError(() => smoke.assertCollectionExists(smokeContext(), 'items'))
    expect(error.message).toContain('items')
  })

  it('rejects an absent attribute naming the collection and attribute key', async () => {
    const smoke = await loadSmoke()
    installRestStub({
      collections: {
        item_templates: {
          documentTotal: EXPECTED_COUNTS.item_templates,
          attributes: [
            { key: 'name', type: 'string', status: 'available' },
            { key: 'defaultQuantity', type: 'float', status: 'available' },
          ],
          indexes: [{ key: 'name_index', type: 'fulltext', attributes: ['name'] }],
        },
      },
    })
    const error = await captureError(() =>
      smoke.assertAttributeAvailable(smokeContext(), 'item_templates', 'defaultUnit'),
    )
    expect(error.message).toContain('item_templates')
    expect(error.message).toContain('defaultUnit')
  })

  it('rejects an attribute that is not available naming the key and status', async () => {
    const smoke = await loadSmoke()
    installRestStub({
      collections: {
        item_templates: {
          documentTotal: EXPECTED_COUNTS.item_templates,
          attributes: [{ key: 'defaultUnit', type: 'string', status: 'processing' }],
        },
      },
    })
    const error = await captureError(() =>
      smoke.assertAttributeAvailable(smokeContext(), 'item_templates', 'defaultUnit'),
    )
    expect(error.message).toContain('defaultUnit')
    expect(error.message).toContain('processing')
  })

  it('rejects a missing fulltext index naming the collection and index key', async () => {
    const smoke = await loadSmoke()
    installRestStub({
      collections: {
        items: {
          documentTotal: EXPECTED_COUNTS.items,
          indexes: [{ key: 'location_index', type: 'key', attributes: ['locationId'] }],
        },
      },
    })
    const error = await captureError(() =>
      smoke.assertFulltextIndex(smokeContext(), 'items', 'name_index'),
    )
    expect(error.message).toContain('items')
    expect(error.message).toContain('name_index')
  })

  it('rejects a name_index that is not fulltext naming the fulltext requirement', async () => {
    const smoke = await loadSmoke()
    installRestStub({
      collections: {
        items: {
          documentTotal: EXPECTED_COUNTS.items,
          indexes: [{ key: 'name_index', type: 'key', attributes: ['name'] }],
        },
      },
    })
    const error = await captureError(() =>
      smoke.assertFulltextIndex(smokeContext(), 'items', 'name_index'),
    )
    expect(error.message).toContain('name_index')
    expect(error.message).toContain('fulltext')
  })

  it('rejects a collection without read("users") naming the collection and permission', async () => {
    const smoke = await loadSmoke()
    installRestStub({
      collections: {
        categories: {
          documentTotal: EXPECTED_COUNTS.categories,
          permissions: ['create("users")', 'update("users")'],
        },
      },
    })
    const error = await captureError(() =>
      smoke.assertReadUsersPermission(smokeContext(), 'categories'),
    )
    expect(error.message).toContain('categories')
    expect(error.message).toContain('read("users")')
  })

  it('rejects a wrong document count naming collection, expected, and actual', async () => {
    const smoke = await loadSmoke()
    installRestStub({
      collections: {
        locations: {
          documentTotal: 5,
          permissions: ['read("users")'],
        },
      },
    })
    const error = await captureError(() =>
      smoke.assertDocumentCount(smokeContext(), 'locations', EXPECTED_COUNTS.locations),
    )
    expect(error.message).toContain('locations')
    expect(error.message).toContain('3')
    expect(error.message).toContain('5')
  })
})

describe('smoke-image readiness poll', () => {
  it('resolves once /login returns 200 on the third poll', async () => {
    const smoke = await loadSmoke()
    const statuses = [503, 503, 200]
    const fetchImpl = vi.fn(async (_url: string) => jsonResponse({}, statuses.shift() ?? 200))

    await smoke.waitForReady({
      url: LOGIN_URL,
      intervalMs: 1,
      timeoutMs: 5_000,
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/login')
  })

  it('times out naming /login when it never returns 200', async () => {
    const smoke = await loadSmoke()
    vi.useFakeTimers()
    const fetchImpl = vi.fn(async (_url: string) => jsonResponse({}, 503))

    const pending = smoke.waitForReady({
      url: LOGIN_URL,
      intervalMs: 100,
      timeoutMs: 1_000,
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
    })
    const errorPromise = captureError(() => pending)
    await vi.advanceTimersByTimeAsync(2_000)
    const error = await errorPromise

    expect(error.message).toContain('/login')
    expect(error.message).toMatch(/time(d)? ?out/i)
  })

  it('rejects with a named network error when fetch rejects', async () => {
    const smoke = await loadSmoke()
    const fetchImpl = vi.fn(async (_url: string) => {
      throw new Error('connect ECONNREFUSED')
    })

    const error = await captureError(() =>
      smoke.waitForReady({
        url: LOGIN_URL,
        intervalMs: 1,
        timeoutMs: 5_000,
        fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
      }),
    )

    expect(error.message).toContain('/login')
    expect(error.message).toMatch(/network/i)
  })
})

describe('smoke-image log scanning', () => {
  const CLEAN_LOGS = [
    '▲ Next.js 15',
    '- Local: http://localhost:3000',
    '✓ Ready in 431ms',
    '   Creating default locations...',
    '   Seeded 3 locations',
  ].join('\n')

  const PASS_2_LOGS = [
    ...CLEAN_LOGS.split('\n'),
    ...SEED_SKIP_LINES.map((line) => `   ${line}`),
  ].join('\n')

  it('passes clean logs', async () => {
    const { scanLogs } = await loadSmoke()
    expect(scanLogs(CLEAN_LOGS)).toEqual({ ok: true, problems: [] })
  })

  it('flags the dotenv injecting env line', async () => {
    const { scanLogs } = await loadSmoke()
    const result = scanLogs(`${CLEAN_LOGS}\n[dotenv@17.2.1] injecting env (3) from .env.local`)
    expect(result.ok).toBe(false)
    expect(result.problems.join(' ')).toContain('injecting env')
  })

  it('flags provisioning 400 lines', async () => {
    const { scanLogs } = await loadSmoke()
    const result = scanLogs(
      `${CLEAN_LOGS}\nPOST /v1/databases/home_pantry/collections/locations/attributes/string 400 12ms`,
    )
    expect(result.ok).toBe(false)
    expect(result.problems.join(' ')).toContain('400')
  })

  it('flags fatal error lines', async () => {
    const { scanLogs } = await loadSmoke()
    const result = scanLogs(
      `${CLEAN_LOGS}\nError: fatal - provisioning aborted during attribute creation`,
    )
    expect(result.ok).toBe(false)
    expect(result.problems.join(' ')).toMatch(/fatal/i)
  })

  it('requires the seed skip lines when requireSeedSkips is set', async () => {
    const { scanLogs } = await loadSmoke()
    const result = scanLogs(CLEAN_LOGS, { requireSeedSkips: true })
    expect(result.ok).toBe(false)
    const joined = result.problems.join(' ')
    for (const line of SEED_SKIP_LINES) {
      expect(joined).toContain(line)
    }
  })

  it('passes pass-2 logs containing the seed skip lines', async () => {
    const { scanLogs } = await loadSmoke()
    expect(scanLogs(PASS_2_LOGS, { requireSeedSkips: true })).toEqual({ ok: true, problems: [] })
  })
})

describe('smoke-image secret masking', () => {
  it('masks the API key value', async () => {
    const { maskSecret } = await loadSmoke()
    const masked = maskSecret(SENTINEL_API_KEY)
    expect(typeof masked).toBe('string')
    expect(masked.length).toBeGreaterThan(0)
    expect(masked).not.toContain(SENTINEL_API_KEY)
  })

  it('never includes the API key in an error built from a failed REST response', async () => {
    const smoke = await loadSmoke()
    installRestStub({ forceStatus: 500 })
    const error = await captureError(() => smoke.assertCollectionExists(smokeContext(), 'items'))
    expect(error.message).toContain('500')
    expect(error.message).not.toContain(SENTINEL_API_KEY)
  })
})
