import { afterEach, describe, expect, it, vi } from 'vitest'
import { APPWRITE_SCRIPT_ENV_VARS, missingEnvMessage } from '@/scripts/lib/operator-helpers'

const COLLECTIONS = ['locations', 'categories', 'item_templates', 'items'] as const

const POPULATED_TEMPLATE_NAMES = [
  'Steak',
  'Ground Beef',
  'Chicken Breast',
  'Pork Chops',
  'Bacon',
  'Hot Dogs',
  'Frozen Vegetables',
  'Frozen Pizza',
  'Ice Cream',
  'Frozen Berries',
  'Milk',
  'Eggs',
  'Cheese (Shredded)',
  'Butter',
  'Yogurt',
  'Bread',
  'Rice',
  'Pasta',
  'Canned Tomatoes',
  'Cereal',
  'Orange Juice',
  'Soda',
  'Coffee',
  'Ketchup',
  'Mayonnaise',
  'Mustard',
  'Salad Dressing',
  'Apples',
  'Bananas',
  'Onions',
]

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

function attributesResponse(status: 'available' | 'processing' | 'failed' | 'stuck', key = 'name') {
  return jsonResponse({
    total: 1,
    attributes: [{ key, status }],
  })
}

function callMethod(init?: RequestInit): string {
  return init?.method ?? 'GET'
}

function isAttributesListGet(url: string, init?: RequestInit): boolean {
  return callMethod(init) === 'GET' && /\/collections\/[^/]+\/attributes\/?(\?|$)/.test(String(url))
}

function collectionIdFromAttributesUrl(url: string): string {
  return String(url).match(/\/collections\/([^/]+)\/attributes/)?.[1] ?? ''
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

function collectionIdFromCreateBody(init?: RequestInit): string {
  if (!init?.body) {
    return ''
  }
  return (JSON.parse(String(init.body)) as { collectionId?: string }).collectionId ?? ''
}

function isAttributeCreatePost(url: string, init?: RequestInit): boolean {
  return callMethod(init) === 'POST' && String(url).includes('/attributes/')
}

function isIndexCreatePost(url: string, init?: RequestInit): boolean {
  return callMethod(init) === 'POST' && String(url).includes('/indexes')
}

function isDocumentPost(url: string, init?: RequestInit): boolean {
  return callMethod(init) === 'POST' && isDocumentUrl(url)
}

function isDeleteCall(init?: RequestInit): boolean {
  return callMethod(init) === 'DELETE'
}

function deleteCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => isDeleteCall(init as RequestInit | undefined))
}

function documentPosts(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url, init]) =>
    isDocumentPost(String(url), init as RequestInit | undefined),
  )
}

function documentCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url]) => isDocumentUrl(String(url)))
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

function installFetch(
  attributeStatus: (
    collectionId: string,
    pollIndex: number,
  ) => 'available' | 'processing' | 'failed' | 'stuck',
  options: {
    alreadyExists?: boolean
    documents?: 'empty' | 'populated' | 'reject'
    setupError?: Error
  } = {},
) {
  const polls = new Map<string, number>()
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (options.setupError && !isAttributesListGet(url, init) && !isDocumentUrl(url)) {
      throw options.setupError
    }

    if (isDeleteCall(init)) {
      return jsonResponse({}, 204)
    }

    if (isAttributesListGet(url, init)) {
      const collectionId = collectionIdFromAttributesUrl(url)
      const next = (polls.get(collectionId) ?? 0) + 1
      polls.set(collectionId, next)
      const status = attributeStatus(collectionId, next)
      const key = collectionId === 'item_templates' && status === 'stuck' ? 'categoryId' : 'name'
      return attributesResponse(status, key)
    }

    if (isDocumentUrl(url)) {
      if (options.documents === 'reject') {
        throw new Error('seed failed')
      }
      if (callMethod(init) === 'POST') {
        return createdOk()
      }
      return options.documents === 'populated' ? populatedDocuments() : emptyDocuments()
    }

    if (options.alreadyExists && callMethod(init) === 'POST') {
      return alreadyExistsResponse()
    }

    return createdOk()
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
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
  it('runs setup then polls attributes until available then seeds', async () => {
    stubRequiredEnv()
    const fetchMock = installFetch(() => 'available', { documents: 'empty' })
    mockConsole()

    const { provision } = await loadProvision()
    await provision()

    const labels = fetchMock.mock.calls.map(([url, init]) => {
      const href = String(url)
      const request = init as RequestInit | undefined
      if (isSchemaDatabasePost(href, request)) {
        return 'database'
      }
      if (isCollectionCreatePost(href, request)) {
        return `collection:${collectionIdFromCreateBody(request)}`
      }
      if (isAttributeCreatePost(href, request)) {
        return 'attribute'
      }
      if (isIndexCreatePost(href, request)) {
        return 'index'
      }
      if (isAttributesListGet(href, request)) {
        return `poll:${collectionIdFromAttributesUrl(href)}`
      }
      if (isDocumentUrl(href)) {
        return 'seed'
      }
      return null
    })

    const databaseAt = labels.indexOf('database')
    const locationsAt = labels.indexOf('collection:locations')
    const categoriesAt = labels.indexOf('collection:categories')
    const templatesAt = labels.indexOf('collection:item_templates')
    const itemsAt = labels.indexOf('collection:items')
    const attributeAt = labels.indexOf('attribute')
    const indexAt = labels.indexOf('index')
    const firstPollAt = labels.findIndex((label) => label?.startsWith('poll:'))
    const firstSeedAt = labels.indexOf('seed')

    expect(databaseAt).toBeGreaterThanOrEqual(0)
    expect(locationsAt).toBeGreaterThan(databaseAt)
    expect(categoriesAt).toBeGreaterThan(locationsAt)
    expect(templatesAt).toBeGreaterThan(categoriesAt)
    expect(itemsAt).toBeGreaterThan(templatesAt)
    expect(attributeAt).toBeGreaterThan(locationsAt)
    expect(indexAt).toBeGreaterThan(attributeAt)
    expect(firstPollAt).toBeGreaterThan(Math.max(attributeAt, indexAt, itemsAt))
    expect(firstSeedAt).toBeGreaterThan(firstPollAt)

    for (const collectionId of COLLECTIONS) {
      expect(labels).toContain(`poll:${collectionId}`)
    }
    expect(deleteCalls(fetchMock)).toHaveLength(0)
  })

  it('retries attributes that are processing until they become available before seeding', async () => {
    stubRequiredEnv()
    vi.useFakeTimers()
    const fetchMock = installFetch((_collectionId, pollIndex) =>
      pollIndex === 1 ? 'processing' : 'available',
    )
    mockConsole()

    const { provision } = await loadProvision()
    const pending = provision()
    await vi.advanceTimersByTimeAsync(2_000)
    await pending

    const firstSeedAt = fetchMock.mock.calls.findIndex(([url]) => isDocumentUrl(String(url)))
    expect(firstSeedAt).toBeGreaterThan(-1)

    const pollsBeforeSeed = fetchMock.mock.calls
      .slice(0, firstSeedAt)
      .filter(([url, init]) => isAttributesListGet(String(url), init as RequestInit | undefined))
    expect(pollsBeforeSeed.length).toBeGreaterThanOrEqual(COLLECTIONS.length * 2)

    for (const collectionId of COLLECTIONS) {
      const polls = pollsBeforeSeed.filter(
        ([url]) => collectionIdFromAttributesUrl(String(url)) === collectionId,
      )
      expect(polls.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('rejects a failed attribute naming the collection and key and does not seed', async () => {
    stubRequiredEnv()
    const fetchMock = installFetch((collectionId) =>
      collectionId === 'locations' ? 'failed' : 'available',
    )
    mockConsole()

    const { provision } = await loadProvision()
    const error = await captureError(provision)

    expect(error.message).toContain('locations')
    expect(error.message).toContain('name')
    expect(error.message.toLowerCase()).toContain('failed')
    expect(documentCalls(fetchMock)).toHaveLength(0)
  })

  it('rejects a stuck attribute naming the collection and key and does not seed', async () => {
    stubRequiredEnv()
    const fetchMock = installFetch((collectionId) =>
      collectionId === 'item_templates' ? 'stuck' : 'available',
    )
    mockConsole()

    const { provision } = await loadProvision()
    const error = await captureError(provision)

    expect(error.message).toContain('item_templates')
    expect(error.message).toContain('categoryId')
    expect(error.message.toLowerCase()).toContain('stuck')
    expect(documentCalls(fetchMock)).toHaveLength(0)
  })

  it('rejects when attribute polling exceeds 120s naming the pending collection', async () => {
    stubRequiredEnv()
    vi.useFakeTimers()
    const fetchMock = installFetch(() => 'processing')
    mockConsole()

    const { provision } = await loadProvision()
    const pending = provision()
    const errorPromise = captureError(() => pending)
    await vi.advanceTimersByTimeAsync(120_000)
    const error = await errorPromise

    expect(error.message).toMatch(/locations|categories|item_templates|items/)
    expect(documentCalls(fetchMock)).toHaveLength(0)
  })

  it('never issues DELETE even when SETUP_WIPE and SETUP_WIPE_CONFIRM are set', async () => {
    stubRequiredEnv()
    vi.stubEnv('SETUP_WIPE', '1')
    vi.stubEnv('SETUP_WIPE_CONFIRM', 'yes')
    const fetchMock = installFetch(() => 'available', { documents: 'empty' })
    mockConsole()

    const { provision } = await loadProvision()
    await provision()

    expect(deleteCalls(fetchMock)).toHaveLength(0)
  })

  it('is idempotent against an already-provisioned project', async () => {
    stubRequiredEnv()
    const fetchMock = installFetch(() => 'available', {
      alreadyExists: true,
      documents: 'populated',
    })
    mockConsole()

    const { provision } = await loadProvision()
    await provision()

    expect(deleteCalls(fetchMock)).toHaveLength(0)
    expect(documentPosts(fetchMock)).toHaveLength(0)
  })

  it('rejects when a setup fetch fails', async () => {
    stubRequiredEnv()
    installFetch(() => 'available', { setupError: new Error('Appwrite unreachable') })
    mockConsole()

    const { provision } = await loadProvision()
    const error = await captureError(provision)

    expect(error.message).toContain('Appwrite unreachable')
  })

  it('rejects when a seed fetch fails after attributes are available', async () => {
    stubRequiredEnv()
    const fetchMock = installFetch(() => 'available', { documents: 'reject' })
    mockConsole()

    const { provision } = await loadProvision()
    const error = await captureError(provision)

    expect(error.message).toContain('seed failed')
    expect(
      fetchMock.mock.calls.some(([url, init]) =>
        isAttributesListGet(String(url), init as RequestInit | undefined),
      ),
    ).toBe(true)
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
