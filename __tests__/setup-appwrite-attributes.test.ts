import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

const COLLECTION_IDS = ['items', 'item_templates', 'categories', 'locations'] as const

const WIPE_CONFIRM_YES = { confirmWipe: async () => true }
const WIPE_CONFIRM_NO = { confirmWipe: async () => false }

function stubRequiredEnv() {
  vi.stubEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', 'https://appwrite.example.test/v1')
  vi.stubEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID', 'project-1')
  vi.stubEnv('APPWRITE_API_KEY', 'key-1')
}

function okResponse() {
  return { ok: true, status: 201, json: async () => ({}) }
}

function mockConsole() {
  const logs: string[] = []
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(' '))
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  return logs
}

function collectionDeleteIndex(fetchMock: ReturnType<typeof vi.fn>, collectionId: string): number {
  return fetchMock.mock.calls.findIndex(([url, init]) => {
    const method = (init as RequestInit).method
    const href = String(url)
    return (
      method === 'DELETE' &&
      (href.endsWith(`/databases/home_pantry/collections/${collectionId}`) ||
        href.includes(`/databases/home_pantry/collections/${collectionId}?`))
    )
  })
}

function collectionCreateIndex(fetchMock: ReturnType<typeof vi.fn>, collectionId: string): number {
  return fetchMock.mock.calls.findIndex(([url, init]) => {
    const method = (init as RequestInit).method
    const rawBody = (init as RequestInit).body
    if (method !== 'POST' || !rawBody) {
      return false
    }
    const href = String(url)
    const suffix = href.split('/databases/home_pantry/collections')[1]
    if (suffix !== '' && suffix !== '/') {
      return false
    }
    const body = JSON.parse(String(rawBody)) as { collectionId?: string }
    return body.collectionId === collectionId
  })
}

function expectNoCollectionDeletes(fetchMock: ReturnType<typeof vi.fn>) {
  for (const collectionId of COLLECTION_IDS) {
    expect(collectionDeleteIndex(fetchMock, collectionId), `must not DELETE ${collectionId}`).toBe(
      -1,
    )
  }
}

function expectCollectionsVerified(fetchMock: ReturnType<typeof vi.fn>) {
  for (const collectionId of COLLECTION_IDS) {
    expect(
      collectionCreateIndex(fetchMock, collectionId),
      `missing POST for ${collectionId}`,
    ).toBeGreaterThanOrEqual(0)
  }
}

describe('Appwrite attribute provisioning', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('forwards defined defaults, including false and zero, in attribute requests', async () => {
    stubRequiredEnv()
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { createAttributeBody, setup } = await import('@/scripts/setup-appwrite')

    expect(createAttributeBody({ key: 'count', required: false, default: 0 })).toMatchObject({
      default: 0,
    })

    await setup()

    const requestBody = (collection: string, key: string) => {
      const call = fetchMock.mock.calls.find(([url, init]) => {
        const rawBody = (init as RequestInit).body
        if (!rawBody) {
          return false
        }
        const body = JSON.parse(String(rawBody))
        return String(url).includes(`/collections/${collection}/attributes/`) && body.key === key
      })
      return JSON.parse(String((call?.[1] as RequestInit).body))
    }

    expect(requestBody('locations', 'sortOrder')).toMatchObject({ default: 0 })
    expect(requestBody('item_templates', 'defaultUnit')).toMatchObject({ default: 'each' })
    expect(requestBody('item_templates', 'defaultQuantity')).toMatchObject({ default: 1 })
    expect(requestBody('items', 'unit')).toMatchObject({ default: 'each' })
  })

  it('does not DELETE collections without SETUP_WIPE or --wipe and still verifies collections', async () => {
    stubRequiredEnv()
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { setup } = await import('@/scripts/setup-appwrite')
    await setup()

    expectNoCollectionDeletes(fetchMock)
    expectCollectionsVerified(fetchMock)
  })

  it('does not DELETE collections when wipe is requested but confirm is declined', async () => {
    stubRequiredEnv()
    vi.stubEnv('SETUP_WIPE', '1')
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { setup } = await import('@/scripts/setup-appwrite')
    await setup(WIPE_CONFIRM_NO)

    expectNoCollectionDeletes(fetchMock)
    expectCollectionsVerified(fetchMock)
  })

  it('DELETEs the four collections before recreating them when SETUP_WIPE=1 and confirm is yes', async () => {
    stubRequiredEnv()
    vi.stubEnv('SETUP_WIPE', '1')
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { setup } = await import('@/scripts/setup-appwrite')
    await setup(WIPE_CONFIRM_YES)

    for (const collectionId of COLLECTION_IDS) {
      const deleteIndex = collectionDeleteIndex(fetchMock, collectionId)
      const createIndex = collectionCreateIndex(fetchMock, collectionId)
      expect(deleteIndex, `missing DELETE for ${collectionId}`).toBeGreaterThanOrEqual(0)
      expect(createIndex, `missing POST for ${collectionId}`).toBeGreaterThanOrEqual(0)
      expect(deleteIndex, `DELETE ${collectionId} must run before POST`).toBeLessThan(createIndex)
    }
  })

  it('DELETEs the four collections before recreating them when --wipe is passed and confirm is yes', async () => {
    stubRequiredEnv()
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()
    const originalArgv = process.argv
    process.argv = [...originalArgv, '--wipe']

    try {
      const { setup } = await import('@/scripts/setup-appwrite')
      await setup(WIPE_CONFIRM_YES)

      for (const collectionId of COLLECTION_IDS) {
        const deleteIndex = collectionDeleteIndex(fetchMock, collectionId)
        const createIndex = collectionCreateIndex(fetchMock, collectionId)
        expect(deleteIndex, `missing DELETE for ${collectionId}`).toBeGreaterThanOrEqual(0)
        expect(createIndex, `missing POST for ${collectionId}`).toBeGreaterThanOrEqual(0)
        expect(deleteIndex, `DELETE ${collectionId} must run before POST`).toBeLessThan(createIndex)
      }
    } finally {
      process.argv = originalArgv
    }
  })

  it('continues to recreate collections when DELETE returns 404', async () => {
    stubRequiredEnv()
    vi.stubEnv('SETUP_WIPE', '1')
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return {
          ok: false,
          status: 404,
          json: async () => ({ message: 'Collection not found' }),
        }
      }
      return okResponse()
    })
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { setup } = await import('@/scripts/setup-appwrite')
    await setup(WIPE_CONFIRM_YES)

    expectCollectionsVerified(fetchMock)
  })

  it.each([
    401, 403, 409, 500,
  ])('aborts setup and does not POST collections when DELETE returns %s', async (status) => {
    stubRequiredEnv()
    vi.stubEnv('SETUP_WIPE', '1')
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return {
          ok: false,
          status,
          json: async () => ({ message: `delete failed ${status}` }),
        }
      }
      return okResponse()
    })
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { setup } = await import('@/scripts/setup-appwrite')
    await expect(setup(WIPE_CONFIRM_YES)).rejects.toThrow(/Failed to delete collection/)

    for (const collectionId of COLLECTION_IDS) {
      expect(
        collectionCreateIndex(fetchMock, collectionId),
        `must not POST ${collectionId} after a failed wipe`,
      ).toBe(-1)
    }
  })

  it('aborts when collection POST already exists instead of skipping recreate', async () => {
    stubRequiredEnv()
    vi.stubEnv('SETUP_WIPE', '1')
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const href = String(url)
      const suffix = href.split('/databases/home_pantry/collections')[1]
      const isCollectionCreate =
        init?.method === 'POST' && (suffix === '' || suffix === '/') && Boolean(init.body)
      if (isCollectionCreate) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ message: 'Collection already exists' }),
        }
      }
      return okResponse()
    })
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { setup } = await import('@/scripts/setup-appwrite')
    await expect(setup(WIPE_CONFIRM_YES)).rejects.toThrow(/Failed to create collection/)

    const attributePosts = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/collections/locations/attributes/'),
    )
    expect(
      attributePosts,
      'must not keep adding attributes on an un-wiped collection',
    ).toHaveLength(0)
  })

  it('skips already-existing collections without wiping and still provisions attributes', async () => {
    stubRequiredEnv()
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const href = String(url)
      const suffix = href.split('/databases/home_pantry/collections')[1]
      const isCollectionCreate =
        init?.method === 'POST' && (suffix === '' || suffix === '/') && Boolean(init.body)
      if (isCollectionCreate) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ message: 'Collection already exists' }),
        }
      }
      return okResponse()
    })
    vi.stubGlobal('fetch', fetchMock)
    const logs = mockConsole()

    const { setup } = await import('@/scripts/setup-appwrite')
    await setup()

    expectNoCollectionDeletes(fetchMock)
    const attributePosts = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/collections/locations/attributes/'),
    )
    expect(attributePosts.length).toBeGreaterThan(0)
    expect(logs.join('\n')).toContain('Setup complete!')
  })

  it('rejects setup and does not print Setup complete when an attribute POST returns 500', async () => {
    stubRequiredEnv()
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/collections/locations/attributes/')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: 'attribute create failed' }),
        }
      }
      return okResponse()
    })
    vi.stubGlobal('fetch', fetchMock)
    const logs = mockConsole()

    const { setup } = await import('@/scripts/setup-appwrite')
    await expect(setup()).rejects.toThrow(/Failed to create attribute/)
    expect(logs.join('\n')).not.toContain('Setup complete!')
  })

  it('rejects setup and does not print Setup complete when an index POST fails', async () => {
    stubRequiredEnv()
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/collections/item_templates/indexes')) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ message: 'index create failed: attribute still processing' }),
        }
      }
      return okResponse()
    })
    vi.stubGlobal('fetch', fetchMock)
    const logs = mockConsole()

    const { setup } = await import('@/scripts/setup-appwrite')
    await expect(setup()).rejects.toThrow(/Failed to create index/)
    expect(logs.join('\n')).not.toContain('Setup complete!')
  })

  it('refuses to wipe when SETUP_WIPE is set but stdin is not a TTY', async () => {
    stubRequiredEnv()
    vi.stubEnv('SETUP_WIPE', '1')
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const stdin = Object.assign(new PassThrough(), { isTTY: false })
    const { setup } = await import('@/scripts/setup-appwrite')
    await expect(setup({ stdin: stdin as unknown as NodeJS.ReadStream })).rejects.toThrow(
      /not a TTY/,
    )
    expectNoCollectionDeletes(fetchMock)
  })

  it('wipes when SETUP_WIPE=1 and SETUP_WIPE_CONFIRM=yes without a TTY', async () => {
    stubRequiredEnv()
    vi.stubEnv('SETUP_WIPE', '1')
    vi.stubEnv('SETUP_WIPE_CONFIRM', 'yes')
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const logs = mockConsole()

    const stdin = Object.assign(new PassThrough(), { isTTY: false })
    const { setup } = await import('@/scripts/setup-appwrite')
    await setup({
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: new PassThrough(),
    })

    for (const collectionId of COLLECTION_IDS) {
      expect(collectionDeleteIndex(fetchMock, collectionId)).toBeGreaterThanOrEqual(0)
    }
    expect(logs.join('\n')).toContain('https://appwrite.example.test/v1')
    expect(logs.join('\n')).toContain('home_pantry')
  })

  it('confirmWipe echoes endpoint, project, and database and defaults to no', async () => {
    stubRequiredEnv()
    const stdin = Object.assign(new PassThrough(), { isTTY: true })
    const stdout = new PassThrough()
    const chunks: string[] = []
    stdout.on('data', (chunk: Buffer | string) => {
      chunks.push(String(chunk))
    })

    const { confirmWipe } = await import('@/scripts/setup-appwrite')
    const pending = confirmWipe({
      endpoint: 'https://appwrite.example.test/v1',
      projectId: 'project-1',
      databaseId: 'home_pantry',
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout,
    })
    stdin.write('\n')
    stdin.end()

    await expect(pending).resolves.toBe(false)
    const text = chunks.join('')
    expect(text).toContain('https://appwrite.example.test/v1')
    expect(text).toContain('project-1')
    expect(text).toContain('home_pantry')
  })
})
