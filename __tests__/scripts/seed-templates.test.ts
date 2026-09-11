import { afterEach, describe, expect, it, vi } from 'vitest'

const TEMPLATES_DOCUMENTS_PATH = '/databases/home_pantry/collections/item_templates/documents'
const CATEGORIES_DOCUMENTS_PATH = '/databases/home_pantry/collections/categories/documents'
const LOCATIONS_DOCUMENTS_PATH = '/databases/home_pantry/collections/locations/documents'
const APPWRITE_PAGE_CAP = 100

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

function isTemplatesListGet(url: string, init?: RequestInit) {
  const method = init?.method ?? 'GET'
  return method === 'GET' && String(url).includes(TEMPLATES_DOCUMENTS_PATH)
}

function lookupDocuments() {
  return {
    categories: [
      { $id: 'cat-meat', name: 'Meat' },
      { $id: 'cat-dairy', name: 'Dairy' },
    ],
    locations: [
      { $id: 'loc-fridge', name: 'Fridge' },
      { $id: 'loc-freezer', name: 'Large Freezer' },
    ],
  }
}

function makeFetchMock(options: {
  existingTemplates?: { $id: string; name: string }[]
  onTemplatesList?: () => Promise<unknown> | unknown
}) {
  const lookups = lookupDocuments()
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

describe('seedTemplates idempotency', () => {
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

    const { seedTemplates } = await import('@/scripts/seed-templates')

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

    const { seedTemplates } = await import('@/scripts/seed-templates')

    await expect(seedTemplates()).rejects.toThrow('list failed')
    expect(createdTemplateNames(fetchMock)).toEqual([])
  })

  it('does not re-create template names that appear after the first 100 list results', async () => {
    stubRequiredEnv()
    const existingTemplates = [
      ...Array.from({ length: APPWRITE_PAGE_CAP }, (_, i) => ({
        $id: `other-${i}`,
        name: `Other ${i}`,
      })),
      { $id: 'existing-milk', name: 'Milk' },
    ]
    const fetchMock = makeFetchMock({ existingTemplates })
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { seedTemplates } = await import('@/scripts/seed-templates')
    await seedTemplates()

    const created = createdTemplateNames(fetchMock)
    expect(created).not.toContain('Milk')
    expect(created.length).toBeGreaterThan(0)
  })

  it('skips already-seeded names and creates only the missing templates', async () => {
    stubRequiredEnv()
    const fetchMock = makeFetchMock({
      existingTemplates: [
        { $id: 'existing-milk', name: 'Milk' },
        { $id: 'existing-eggs', name: 'Eggs' },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { seedTemplates } = await import('@/scripts/seed-templates')
    await seedTemplates()

    const created = createdTemplateNames(fetchMock)
    expect(created).not.toContain('Milk')
    expect(created).not.toContain('Eggs')
    expect(created).toContain('Steak')
    expect(created).toHaveLength(28)
  })
})
