import { afterEach, describe, expect, it, vi } from 'vitest'
import { APPWRITE_SCRIPT_ENV_VARS, missingEnvMessage } from '@/scripts/lib/operator-helpers'

const COLLECTIONS = ['locations', 'categories', 'item_templates', 'items'] as const

const INDEXED_COLLECTIONS = ['item_templates', 'items'] as const

const POPULATED_TEMPLATE_NAMES = [
  'Milk',
  'Eggs',
  'Butter',
  'Bread',
  'Rice',
  'Pasta',
  'Bananas',
  'Apples',
  'Ground Beef',
  'Frozen Vegetables',
  'Coffee',
  'Ketchup',
]

const FULL_SCHEMA: Record<string, { attributes: string[]; indexes: string[] }> = {
  locations: {
    attributes: ['name', 'description', 'icon', 'sortOrder', 'createdAt', 'updatedAt'],
    indexes: [],
  },
  categories: {
    attributes: ['name', 'description', 'icon', 'color', 'sortOrder', 'createdAt', 'updatedAt'],
    indexes: [],
  },
  item_templates: {
    attributes: [
      'name',
      'categoryId',
      'defaultUnit',
      'defaultQuantity',
      'defaultExpirationDays',
      'defaultStorageLocationId',
      'notes',
      'createdAt',
      'updatedAt',
    ],
    indexes: ['name_index', 'category_index'],
  },
  items: {
    attributes: [
      'name',
      'templateId',
      'categoryId',
      'locationId',
      'quantity',
      'unit',
      'expirationDate',
      'purchaseDate',
      'notes',
      'createdById',
      'createdAt',
      'updatedAt',
    ],
    indexes: [
      'name_index',
      'location_index',
      'category_index',
      'expiration_index',
      'createdby_index',
    ],
  },
}

type AttributeStatus = 'available' | 'processing' | 'failed' | 'stuck'

type StubAttribute = { key: string; type: string; status: AttributeStatus }

type StubIndex = { key: string; attributes: string[] }

type StubCollection = { attributes: StubAttribute[]; indexes: StubIndex[] }

type CallKind =
  | 'database'
  | 'collection'
  | 'attribute'
  | 'poll'
  | 'index'
  | 'seed'
  | 'delete'
  | 'other'

type RecordedResponse = {
  kind: CallKind
  collectionId: string
  key?: string
  method: string
  url: string
  status: number
  position: number
}

type AttributeCreateRecord = { collectionId: string; key: string; body: Record<string, unknown> }

type ProvisionStubOptions = {
  documents?: 'empty' | 'populated' | 'reject'
  setupError?: Error
  stuck?: Array<{ collection: string; key: string }>
  terminal?: Array<{ collection: string; key: string; status: 'failed' | 'stuck' }>
  preSeed?: {
    database?: boolean
    collections?: Record<string, { attributes?: string[]; indexes?: string[] }>
  }
}

function stubRequiredEnv() {
  vi.stubEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', 'https://appwrite.example.test/v1')
  vi.stubEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID', 'project-1')
  vi.stubEnv('APPWRITE_API_KEY', 'key-1')
}

function scrubRequiredEnv() {
  for (const name of APPWRITE_SCRIPT_ENV_VARS) {
    vi.stubEnv(name, '')
  }
}

function mockConsole() {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

async function captureError(run: () => Promise<unknown>): Promise<Error> {
  const caught = await run().catch((error: unknown) => error)
  expect(caught).toBeInstanceOf(Error)
  return caught as Error
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

function alreadyExistsResponse() {
  return {
    ok: false,
    status: 409,
    statusText: 'Conflict',
    json: async () => ({ message: 'already exists' }),
    text: async () => JSON.stringify({ message: 'already exists' }),
  }
}

function badRequestResponse(message: string) {
  return {
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    json: async () => ({ message }),
    text: async () => JSON.stringify({ message }),
  }
}

function populatedDocuments() {
  return jsonResponse({
    total: POPULATED_TEMPLATE_NAMES.length,
    documents: POPULATED_TEMPLATE_NAMES.map((name, index) => ({
      $id: `doc-${index}`,
      name,
    })),
  })
}

function emptyDocuments() {
  return jsonResponse({ total: 0, documents: [] })
}

function createdOk() {
  return jsonResponse({}, 201)
}

function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal
      if (!signal) {
        return
      }
      const onAbort = () => {
        reject(signal.reason ?? new Error('The operation was aborted'))
      }
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    })
  })
}

function callMethod(init?: RequestInit): string {
  return init?.method ?? 'GET'
}

function isAttributesListGet(url: string, init?: RequestInit): boolean {
  return callMethod(init) === 'GET' && /\/collections\/[^/]+\/attributes\/?(\?|$)/.test(String(url))
}

function isDocumentUrl(url: string): boolean {
  return String(url).includes('/documents')
}

function isSchemaDatabasePost(url: string, init?: RequestInit): boolean {
  if (callMethod(init) !== 'POST') {
    return false
  }
  const path = String(url).split('?')[0] ?? ''
  return /\/databases\/?$/.test(path)
}

function isCollectionCreatePost(url: string, init?: RequestInit): boolean {
  if (callMethod(init) !== 'POST' || !init?.body) {
    return false
  }
  const href = String(url)
  if (!href.includes('/databases/home_pantry/collections')) {
    return false
  }
  if (href.includes('/attributes') || href.includes('/indexes') || href.includes('/documents')) {
    return false
  }
  const suffix = href.split('/databases/home_pantry/collections')[1] ?? ''
  return suffix === '' || suffix === '/' || suffix.startsWith('?')
}

function isAttributeCreatePost(url: string, init?: RequestInit): boolean {
  return callMethod(init) === 'POST' && String(url).includes('/attributes/')
}

function isIndexCreatePost(url: string, init?: RequestInit): boolean {
  return callMethod(init) === 'POST' && String(url).includes('/indexes')
}

function isDeleteCall(init?: RequestInit): boolean {
  return callMethod(init) === 'DELETE'
}

function collectionIdFromUrl(url: string): string {
  return (
    String(url)
      .split('?')[0]
      ?.match(/\/collections\/([^/]+)/)?.[1] ?? ''
  )
}

function attributeTypeFromUrl(url: string): string {
  return (
    String(url)
      .split('?')[0]
      ?.match(/\/attributes\/([^/]+)/)?.[1] ?? 'string'
  )
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body) {
    return {}
  }
  try {
    return JSON.parse(String(init.body)) as Record<string, unknown>
  } catch {
    return {}
  }
}

function installProvisionStub(options: ProvisionStubOptions = {}) {
  const collections = new Map<string, StubCollection>()
  const responses: RecordedResponse[] = []
  const attributeCreateCalls: AttributeCreateRecord[] = []
  let databaseExists = options.preSeed?.database === true

  for (const [collectionId, spec] of Object.entries(options.preSeed?.collections ?? {})) {
    collections.set(collectionId, {
      attributes: (spec.attributes ?? []).map((key) => ({
        key,
        type: 'string',
        status: 'available' as AttributeStatus,
      })),
      indexes: (spec.indexes ?? []).map((key) => ({ key, attributes: [] })),
    })
  }

  const stuckForever = (collectionId: string, key: string) =>
    (options.stuck ?? []).some((entry) => entry.collection === collectionId && entry.key === key)

  const terminalStatusFor = (collectionId: string, key: string) =>
    (options.terminal ?? []).find((entry) => entry.collection === collectionId && entry.key === key)
      ?.status

  function record(
    kind: CallKind,
    collectionId: string,
    key: string | undefined,
    method: string,
    url: string,
    status: number,
  ) {
    responses.push({ kind, collectionId, key, method, url, status, position: responses.length })
  }

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url)
    const method = callMethod(init)

    if (options.setupError && !isAttributesListGet(href, init) && !isDocumentUrl(href)) {
      throw options.setupError
    }

    if (isDeleteCall(init)) {
      record('delete', collectionIdFromUrl(href), undefined, method, href, 204)
      return jsonResponse({}, 204)
    }

    if (isAttributesListGet(href, init)) {
      const collectionId = collectionIdFromUrl(href)
      const collection = collections.get(collectionId)
      for (const attribute of collection?.attributes ?? []) {
        if (attribute.status !== 'processing') {
          continue
        }
        if (stuckForever(collectionId, attribute.key)) {
          continue
        }
        attribute.status = terminalStatusFor(collectionId, attribute.key) ?? 'available'
      }
      const attributes = collection?.attributes ?? []
      record('poll', collectionId, undefined, method, href, 200)
      return jsonResponse({ total: attributes.length, attributes })
    }

    if (isDocumentUrl(href)) {
      const collectionId = collectionIdFromUrl(href)
      if (options.documents === 'reject') {
        throw new Error('seed failed')
      }
      if (method === 'POST') {
        const collection = collections.get(collectionId)
        const ready = (collection?.attributes ?? []).every(
          (attribute) => attribute.status === 'available',
        )
        if (!ready) {
          record('seed', collectionId, undefined, method, href, 400)
          return badRequestResponse('Collection attributes are not available')
        }
        record('seed', collectionId, undefined, method, href, 201)
        return createdOk()
      }
      record('seed', collectionId, undefined, method, href, 200)
      return options.documents === 'populated' ? populatedDocuments() : emptyDocuments()
    }

    const body = parseBody(init)

    if (isSchemaDatabasePost(href, init)) {
      if (databaseExists) {
        record('database', '', undefined, method, href, 409)
        return alreadyExistsResponse()
      }
      databaseExists = true
      record('database', '', undefined, method, href, 201)
      return createdOk()
    }

    if (isCollectionCreatePost(href, init)) {
      const collectionId = String(body.collectionId ?? '')
      if (collections.has(collectionId)) {
        record('collection', collectionId, collectionId, method, href, 409)
        return alreadyExistsResponse()
      }
      collections.set(collectionId, { attributes: [], indexes: [] })
      record('collection', collectionId, collectionId, method, href, 201)
      return createdOk()
    }

    if (isAttributeCreatePost(href, init)) {
      const collectionId = collectionIdFromUrl(href)
      const key = String(body.key ?? '')
      attributeCreateCalls.push({ collectionId, key, body })
      const collection = collections.get(collectionId) ?? { attributes: [], indexes: [] }
      if (collection.attributes.some((attribute) => attribute.key === key)) {
        record('attribute', collectionId, key, method, href, 409)
        return alreadyExistsResponse()
      }
      if (body.required === true && body.default !== undefined) {
        record('attribute', collectionId, key, method, href, 400)
        return badRequestResponse('Cannot set default value for required attribute')
      }
      collection.attributes.push({ key, type: attributeTypeFromUrl(href), status: 'processing' })
      record('attribute', collectionId, key, method, href, 202)
      return jsonResponse({ key, status: 'processing' }, 202)
    }

    if (isIndexCreatePost(href, init)) {
      const collectionId = collectionIdFromUrl(href)
      const key = String(body.key ?? '')
      const collection = collections.get(collectionId) ?? { attributes: [], indexes: [] }
      if (collection.indexes.some((index) => index.key === key)) {
        record('index', collectionId, key, method, href, 409)
        return alreadyExistsResponse()
      }
      const referenced = Array.isArray(body.attributes) ? body.attributes.map(String) : []
      for (const attributeKey of referenced) {
        const attribute = collection.attributes.find((candidate) => candidate.key === attributeKey)
        if (!attribute || attribute.status !== 'available') {
          record('index', collectionId, key, method, href, 400)
          return badRequestResponse(`Attribute not available: ${attributeKey}`)
        }
      }
      collection.indexes.push({ key, attributes: referenced })
      record('index', collectionId, key, method, href, 202)
      return jsonResponse({}, 202)
    }

    record('other', collectionIdFromUrl(href), undefined, method, href, 201)
    return createdOk()
  })

  vi.stubGlobal('fetch', fetchMock)

  return {
    fetchMock,
    responses: () => [...responses],
    nonOkResponses: () => responses.filter((response) => response.status >= 300),
    attributeCreateCalls: () => [...attributeCreateCalls],
  }
}

async function loadProvision() {
  return import('@/scripts/provision')
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('provision', () => {
  it('provisions a fresh project end to end with only 2xx responses', async () => {
    stubRequiredEnv()
    const stub = installProvisionStub({ documents: 'empty' })
    mockConsole()

    const { provision } = await loadProvision()
    await provision()

    expect(stub.nonOkResponses()).toEqual([])

    const responses = stub.responses()
    const firstPoll = (collectionId: string) =>
      responses.find(
        (response) => response.kind === 'poll' && response.collectionId === collectionId,
      )

    for (const collectionId of COLLECTIONS) {
      const attributePosts = responses.filter(
        (response) => response.kind === 'attribute' && response.collectionId === collectionId,
      )
      expect(attributePosts.length, collectionId).toBeGreaterThan(0)
      const poll = firstPoll(collectionId)
      expect(poll, collectionId).toBeDefined()
      expect(poll?.position ?? -1, collectionId).toBeGreaterThan(
        attributePosts[attributePosts.length - 1]?.position ?? -1,
      )
    }

    for (const collectionId of INDEXED_COLLECTIONS) {
      const indexPosts = responses.filter(
        (response) => response.kind === 'index' && response.collectionId === collectionId,
      )
      expect(indexPosts.length, collectionId).toBeGreaterThan(0)
      expect(indexPosts[0]?.position ?? -1, collectionId).toBeGreaterThan(
        firstPoll(collectionId)?.position ?? -1,
      )
    }

    const seedPosts = responses.filter(
      (response) => response.kind === 'seed' && response.method === 'POST',
    )
    expect(seedPosts.length).toBeGreaterThan(0)
    for (const collectionId of COLLECTIONS) {
      expect(seedPosts[0]?.position ?? -1, collectionId).toBeGreaterThan(
        firstPoll(collectionId)?.position ?? -1,
      )
    }

    expect(responses.filter((response) => response.kind === 'delete')).toHaveLength(0)
  })

  it('never creates an attribute with required true and a default', async () => {
    stubRequiredEnv()
    const stub = installProvisionStub({ documents: 'empty' })
    mockConsole()

    const { provision } = await loadProvision()
    await provision()

    const offenders = stub
      .attributeCreateCalls()
      .filter(({ body }) => body.default !== undefined && body.required !== false)
    expect(offenders).toEqual([])
  })

  it('rejects when an attribute never leaves processing, naming the pending collection, without seeding', async () => {
    stubRequiredEnv()
    vi.useFakeTimers()
    const stub = installProvisionStub({
      documents: 'empty',
      stuck: [{ collection: 'items', key: 'quantity' }],
    })
    mockConsole()

    const { provision } = await loadProvision()
    const pending = provision()
    const errorPromise = captureError(() => pending)
    await vi.advanceTimersByTimeAsync(120_000)
    const error = await errorPromise

    expect(error.message).toContain('items')
    expect(stub.responses().filter((response) => response.kind === 'seed')).toHaveLength(0)
  })

  it('rejects a failed attribute naming the collection and key and does not seed', async () => {
    stubRequiredEnv()
    const stub = installProvisionStub({
      documents: 'empty',
      terminal: [{ collection: 'locations', key: 'name', status: 'failed' }],
    })
    mockConsole()

    const { provision } = await loadProvision()
    const error = await captureError(provision)

    expect(error.message).toContain('locations')
    expect(error.message).toContain('name')
    expect(error.message.toLowerCase()).toContain('failed')
    expect(stub.responses().filter((response) => response.kind === 'seed')).toHaveLength(0)
  })

  it('rejects a stuck attribute naming the collection and key and does not seed', async () => {
    stubRequiredEnv()
    const stub = installProvisionStub({
      documents: 'empty',
      terminal: [{ collection: 'item_templates', key: 'categoryId', status: 'stuck' }],
    })
    mockConsole()

    const { provision } = await loadProvision()
    const error = await captureError(provision)

    expect(error.message).toContain('item_templates')
    expect(error.message).toContain('categoryId')
    expect(error.message.toLowerCase()).toContain('stuck')
    expect(stub.responses().filter((response) => response.kind === 'seed')).toHaveLength(0)
  })

  it('heals a half-built project without deleting or recreating existing parts', async () => {
    stubRequiredEnv()
    const stub = installProvisionStub({
      documents: 'empty',
      preSeed: {
        database: true,
        collections: {
          locations: FULL_SCHEMA.locations,
          item_templates: { attributes: ['name'] },
        },
      },
    })
    mockConsole()

    const { provision } = await loadProvision()
    await provision()

    const responses = stub.responses()
    expect(responses.filter((response) => response.kind === 'delete')).toHaveLength(0)
    expect(responses.filter((response) => response.status === 400)).toHaveLength(0)

    const recreatedExistingParts = responses.filter(
      (response) =>
        response.status < 300 &&
        (response.kind === 'collection' || response.kind === 'attribute') &&
        (response.collectionId === 'locations' ||
          (response.collectionId === 'item_templates' &&
            response.kind === 'attribute' &&
            response.key === 'name')),
    )
    expect(recreatedExistingParts).toHaveLength(0)

    const createdTemplateAttributes = responses
      .filter(
        (response) =>
          response.kind === 'attribute' &&
          response.collectionId === 'item_templates' &&
          response.status < 300,
      )
      .map((response) => response.key)
    expect(createdTemplateAttributes).not.toContain('name')
    expect(createdTemplateAttributes).toEqual(
      expect.arrayContaining([
        'categoryId',
        'defaultUnit',
        'defaultQuantity',
        'notes',
        'createdAt',
        'updatedAt',
      ]),
    )

    const createdIndexes = responses
      .filter((response) => response.kind === 'index' && response.status < 300)
      .map((response) => response.key)
    expect(createdIndexes).toEqual(
      expect.arrayContaining([
        'name_index',
        'category_index',
        'location_index',
        'expiration_index',
        'createdby_index',
      ]),
    )

    expect(
      responses.some((response) => response.kind === 'seed' && response.method === 'POST'),
    ).toBe(true)
  })

  it('never issues DELETE even when SETUP_WIPE and SETUP_WIPE_CONFIRM are set', async () => {
    stubRequiredEnv()
    vi.stubEnv('SETUP_WIPE', '1')
    vi.stubEnv('SETUP_WIPE_CONFIRM', 'yes')
    const stub = installProvisionStub({
      documents: 'empty',
      preSeed: { database: true, collections: FULL_SCHEMA },
    })
    mockConsole()

    const { provision } = await loadProvision()
    await provision()

    expect(stub.responses().filter((response) => response.kind === 'delete')).toHaveLength(0)
  })

  it('is idempotent against an already-provisioned project', async () => {
    stubRequiredEnv()
    const stub = installProvisionStub({
      documents: 'populated',
      preSeed: { database: true, collections: FULL_SCHEMA },
    })
    mockConsole()

    const { provision } = await loadProvision()
    await provision()

    const responses = stub.responses()
    expect(responses.filter((response) => response.status === 400)).toHaveLength(0)
    expect(responses.filter((response) => response.kind === 'delete')).toHaveLength(0)

    const successfulCreates = responses.filter(
      (response) =>
        response.status < 300 &&
        (response.kind === 'database' ||
          response.kind === 'collection' ||
          response.kind === 'attribute' ||
          response.kind === 'index'),
    )
    expect(successfulCreates).toHaveLength(0)

    const collectionProbes = responses.filter((response) => response.kind === 'collection')
    expect(collectionProbes.map((response) => response.collectionId).sort()).toEqual(
      [...COLLECTIONS].sort(),
    )
    for (const probe of collectionProbes) {
      expect(probe.status).toBe(409)
    }

    expect(
      responses.filter((response) => response.kind === 'seed' && response.method === 'POST'),
    ).toHaveLength(0)

    const logged = vi.mocked(console.log).mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('Skipped - locations already exist')
    expect(logged).toContain('Skipped - categories already exist')
    expect(logged).toContain('Skipped - templates already exist')
  })

  it('rejects when a setup fetch fails', async () => {
    stubRequiredEnv()
    installProvisionStub({ setupError: new Error('Appwrite unreachable') })
    mockConsole()

    const { provision } = await loadProvision()
    const error = await captureError(provision)

    expect(error.message).toContain('Appwrite unreachable')
  })

  it('rejects when a seed fetch fails after attributes are available', async () => {
    stubRequiredEnv()
    const stub = installProvisionStub({
      documents: 'reject',
      preSeed: { database: true, collections: FULL_SCHEMA },
    })
    mockConsole()

    const { provision } = await loadProvision()
    const error = await captureError(provision)

    expect(error.message).toContain('seed failed')
    expect(stub.responses().some((response) => response.kind === 'poll')).toBe(true)
  })

  it('names missing environment variables and does not fetch', async () => {
    scrubRequiredEnv()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { provision } = await loadProvision()
    const error = await captureError(provision)

    expect(error.message).toBe(missingEnvMessage({}, [...APPWRITE_SCRIPT_ENV_VARS]))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not fetch on import when NODE_ENV is production', async () => {
    stubRequiredEnv()
    vi.stubEnv('NODE_ENV', 'production')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    await import('@/scripts/provision')
    await import('@/scripts/setup-appwrite')
    await import('@/scripts/seed')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a never-resolving fetch within about 30s', async () => {
    stubRequiredEnv()
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hangingFetch())
    mockConsole()

    const { provision } = await loadProvision()
    const pending = provision()
    const errorPromise = captureError(() => pending)
    await vi.advanceTimersByTimeAsync(30_000)
    const error = await errorPromise

    expect(error).toBeInstanceOf(Error)
  })
})
