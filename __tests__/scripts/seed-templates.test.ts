import { afterEach, describe, expect, it, vi } from 'vitest'

const TEMPLATES_DOCUMENTS_PATH = '/databases/home_pantry/collections/item_templates/documents'
const CATEGORIES_DOCUMENTS_PATH = '/databases/home_pantry/collections/categories/documents'
const LOCATIONS_DOCUMENTS_PATH = '/databases/home_pantry/collections/locations/documents'
const APPWRITE_PAGE_CAP = 100

const STARTER_TEMPLATE_ORDER = [
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

const FRIDGE_ONLY_TEMPLATE_ORDER = ['Milk', 'Eggs', 'Butter', 'Apples', 'Ketchup']

function stubRequiredEnv() {
  vi.stubEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', 'https://appwrite.example.test/v1')
  vi.stubEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID', 'project-1')
  vi.stubEnv('APPWRITE_API_KEY', 'key-1')
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function mockConsole() {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

function consoleLogText(): string {
  return vi.mocked(console.log).mock.calls.flat().map(String).join(' ')
}

function consoleWarnText(): string {
  return vi.mocked(console.warn).mock.calls.flat().map(String).join(' ')
}

function parseListQueries(url: string): { method: string; values: unknown[] }[] {
  const parsed = new URL(String(url), 'https://appwrite.example.test')
  return parsed.searchParams.getAll('queries[]').map(
    (raw) =>
      JSON.parse(raw) as {
        method: string
        values: unknown[]
      },
  )
}

function listWindow(
  documents: { $id: string; name: string }[],
  url: string,
): { total: number; documents: { $id: string; name: string }[] } {
  const queries = parseListQueries(url)
  const requestedLimit = Number(queries.find((q) => q.method === 'limit')?.values[0] ?? 25)
  const limit = Math.min(requestedLimit, APPWRITE_PAGE_CAP)
  const offset = Number(queries.find((q) => q.method === 'offset')?.values[0] ?? 0)
  const cursorAfter = queries.find((q) => q.method === 'cursorAfter')?.values[0] as
    | string
    | undefined

  let start = offset
  if (cursorAfter) {
    const cursorIndex = documents.findIndex((doc) => doc.$id === cursorAfter)
    start = cursorIndex >= 0 ? cursorIndex + 1 : 0
  }

  return {
    total: documents.length,
    documents: documents.slice(start, start + limit),
  }
}

function templateCreateCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url, init]) => {
    return (
      String(url).includes(TEMPLATES_DOCUMENTS_PATH) &&
      (init as RequestInit | undefined)?.method === 'POST'
    )
  })
}

function createdTemplateNames(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return templateCreateCalls(fetchMock).map(([, init]) => {
    const body = JSON.parse(String((init as RequestInit).body)) as {
      data?: { name?: string }
    }
    return body.data?.name ?? ''
  })
}

function createdTemplateBodies(
  fetchMock: ReturnType<typeof vi.fn>,
): { data?: { categoryId?: string | null; defaultStorageLocationId?: string | null } }[] {
  return templateCreateCalls(fetchMock).map(([, init]) => {
    return JSON.parse(String((init as RequestInit).body)) as {
      data?: { categoryId?: string | null; defaultStorageLocationId?: string | null }
    }
  })
}

function lookupListCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url, init]) => {
    const href = String(url)
    const method = init?.method ?? 'GET'
    return (
      method === 'GET' &&
      (href.includes(CATEGORIES_DOCUMENTS_PATH) || href.includes(LOCATIONS_DOCUMENTS_PATH))
    )
  })
}

function isTemplatesListGet(url: string, init?: RequestInit) {
  const method = init?.method ?? 'GET'
  return method === 'GET' && String(url).includes(TEMPLATES_DOCUMENTS_PATH)
}

function lookupDocuments(options?: { locations?: { $id: string; name: string }[] }) {
  return {
    categories: [
      { $id: 'cat-meat', name: 'Meat' },
      { $id: 'cat-dairy', name: 'Dairy' },
      { $id: 'cat-produce', name: 'Produce' },
      { $id: 'cat-frozen', name: 'Frozen' },
      { $id: 'cat-pantry', name: 'Pantry' },
      { $id: 'cat-beverages', name: 'Beverages' },
      { $id: 'cat-condiments', name: 'Condiments' },
      { $id: 'cat-other', name: 'Other' },
    ],
    locations: options?.locations ?? [
      { $id: 'loc-fridge', name: 'Fridge' },
      { $id: 'loc-freezer', name: 'Freezer' },
      { $id: 'loc-pantry', name: 'Pantry' },
    ],
  }
}

function makeFetchMock(options: {
  existingTemplates?: { $id: string; name: string }[]
  locations?: { $id: string; name: string }[]
  onTemplatesList?: () => Promise<unknown> | unknown
}) {
  const lookups = lookupDocuments({ locations: options.locations })
  const existingTemplates = options.existingTemplates ?? []

  return vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url)
    const method = init?.method ?? 'GET'

    if (method === 'GET' && href.includes(CATEGORIES_DOCUMENTS_PATH)) {
      return jsonResponse({
        total: lookups.categories.length,
        documents: lookups.categories,
      })
    }

    if (method === 'GET' && href.includes(LOCATIONS_DOCUMENTS_PATH)) {
      return jsonResponse({
        total: lookups.locations.length,
        documents: lookups.locations,
      })
    }

    if (isTemplatesListGet(href, init)) {
      if (options.onTemplatesList) {
        return options.onTemplatesList()
      }
      return jsonResponse(listWindow(existingTemplates, href))
    }

    if (method === 'POST' && href.includes(TEMPLATES_DOCUMENTS_PATH)) {
      return jsonResponse({ $id: 'created' }, 201)
    }

    throw new Error(`Unexpected fetch: ${method} ${href}`)
  })
}

async function loadSeedTemplates() {
  const { seedTemplates } = await import('@/scripts/seed-templates')
  return seedTemplates
}

describe('seedTemplates', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('aborts without creating templates when the existing-templates fetch rejects', async () => {
    stubRequiredEnv()
    const fetchMock = makeFetchMock({
      onTemplatesList: () => Promise.reject(new Error('transient list failure')),
    })
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const seedTemplates = await loadSeedTemplates()

    await expect(seedTemplates()).rejects.toThrow('transient list failure')
    expect(createdTemplateNames(fetchMock)).toEqual([])
  })

  it('aborts without creating templates when the existing-templates list returns a non-OK response', async () => {
    stubRequiredEnv()
    const fetchMock = makeFetchMock({
      onTemplatesList: () => jsonResponse({ message: 'list failed' }, 500),
    })
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const seedTemplates = await loadSeedTemplates()

    await expect(seedTemplates()).rejects.toThrow('list failed')
    expect(createdTemplateNames(fetchMock)).toEqual([])
  })

  it('skips seeding entirely, without map fetches, when any template already exists', async () => {
    stubRequiredEnv()
    const fetchMock = makeFetchMock({
      existingTemplates: [{ $id: 'existing-family-recipe', name: 'Family Recipe' }],
    })
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const seedTemplates = await loadSeedTemplates()
    await seedTemplates()

    expect(createdTemplateNames(fetchMock)).toEqual([])
    expect(lookupListCalls(fetchMock)).toHaveLength(0)
    expect(consoleLogText()).toContain('Skipped - templates already exist')
  })

  it('skips templates whose location lookup misses and never posts null relations', async () => {
    stubRequiredEnv()
    const fetchMock = makeFetchMock({
      locations: [{ $id: 'loc-fridge', name: 'Fridge' }],
    })
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const seedTemplates = await loadSeedTemplates()
    await seedTemplates()

    expect(createdTemplateNames(fetchMock)).toEqual(FRIDGE_ONLY_TEMPLATE_ORDER)
    const warnings = consoleWarnText()
    expect(warnings).toContain('Ground Beef')
    expect(warnings).toContain('Frozen Vegetables')
    for (const body of createdTemplateBodies(fetchMock)) {
      expect(body.data?.categoryId).not.toBeNull()
      expect(body.data?.defaultStorageLocationId).not.toBeNull()
    }
  })

  it('warns instead of claiming existing templates when every lookup misses on an empty collection', async () => {
    stubRequiredEnv()
    const fetchMock = makeFetchMock({
      locations: [{ $id: 'loc-cellar', name: 'Cellar' }],
    })
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const seedTemplates = await loadSeedTemplates()
    await seedTemplates()

    expect(createdTemplateNames(fetchMock)).toEqual([])
    expect(consoleLogText()).not.toContain('Skipped - templates already exist')
    expect(vi.mocked(console.warn).mock.calls.length).toBeGreaterThan(0)
  })

  it('seeds all twelve starter templates in array order against an empty collection', async () => {
    stubRequiredEnv()
    const fetchMock = makeFetchMock({})
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const seedTemplates = await loadSeedTemplates()
    await seedTemplates()

    expect(createdTemplateNames(fetchMock)).toEqual(STARTER_TEMPLATE_ORDER)
    expect(consoleLogText()).toContain('Seeded 12 templates')
  })
})
