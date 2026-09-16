import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCATION_ICONS, UNITS } from '@/lib/constants'

const LOCATIONS_DOCUMENTS_PATH = '/databases/home_pantry/collections/locations/documents'
const CATEGORIES_DOCUMENTS_PATH = '/databases/home_pantry/collections/categories/documents'
const TEMPLATES_DOCUMENTS_PATH = '/databases/home_pantry/collections/item_templates/documents'
const ITEMS_DOCUMENTS_PATH = '/databases/home_pantry/collections/items/documents'
const APPWRITE_PAGE_CAP = 100

const EXPECTED_LOCATIONS = [
  { name: 'Fridge', icon: 'refrigerator', sortOrder: 1 },
  { name: 'Freezer', icon: 'snowflake', sortOrder: 2 },
  { name: 'Pantry', icon: 'warehouse', sortOrder: 3 },
]

const EXPECTED_CATEGORIES = [
  { name: 'Meat', icon: 'beef', color: '#ef4444', sortOrder: 1 },
  { name: 'Dairy', icon: 'milk', color: '#f97316', sortOrder: 2 },
  { name: 'Produce', icon: 'apple', color: '#22c55e', sortOrder: 3 },
  { name: 'Frozen', icon: 'snowflake', color: '#3b82f6', sortOrder: 4 },
  { name: 'Pantry', icon: 'package', color: '#a855f7', sortOrder: 5 },
  { name: 'Beverages', icon: 'cup-soda', color: '#06b6d4', sortOrder: 6 },
  { name: 'Condiments', icon: 'droplet', color: '#eab308', sortOrder: 7 },
  { name: 'Other', icon: 'package', color: '#6b7280', sortOrder: 8 },
]

type ExpectedTemplate = {
  name: string
  category: string
  unit: string
  quantity: number
  expDays: number | null
  location: string
  notes: string
}

const EXPECTED_TEMPLATES: ExpectedTemplate[] = [
  {
    name: 'Milk',
    category: 'Dairy',
    unit: 'gal',
    quantity: 1,
    expDays: 7,
    location: 'Fridge',
    notes: 'Check the date on the carton',
  },
  {
    name: 'Eggs',
    category: 'Dairy',
    unit: 'each',
    quantity: 12,
    expDays: 21,
    location: 'Fridge',
    notes: 'Keep in the main part of the fridge, not the door',
  },
  {
    name: 'Butter',
    category: 'Dairy',
    unit: 'lb',
    quantity: 1,
    expDays: 30,
    location: 'Fridge',
    notes: 'Extra sticks freeze well',
  },
  {
    name: 'Bread',
    category: 'Pantry',
    unit: 'each',
    quantity: 1,
    expDays: 7,
    location: 'Pantry',
    notes: '',
  },
  {
    name: 'Rice',
    category: 'Pantry',
    unit: 'bag',
    quantity: 1,
    expDays: null,
    location: 'Pantry',
    notes: 'Long shelf life',
  },
  {
    name: 'Pasta',
    category: 'Pantry',
    unit: 'box',
    quantity: 1,
    expDays: null,
    location: 'Pantry',
    notes: '',
  },
  {
    name: 'Bananas',
    category: 'Produce',
    unit: 'each',
    quantity: 1,
    expDays: 5,
    location: 'Pantry',
    notes: 'Ripen at room temperature',
  },
  {
    name: 'Apples',
    category: 'Produce',
    unit: 'lb',
    quantity: 1,
    expDays: 14,
    location: 'Fridge',
    notes: 'Crisper drawer keeps them fresh',
  },
  {
    name: 'Ground Beef',
    category: 'Meat',
    unit: 'lb',
    quantity: 1,
    expDays: 90,
    location: 'Freezer',
    notes: 'Thaw in the fridge before use',
  },
  {
    name: 'Frozen Vegetables',
    category: 'Frozen',
    unit: 'bag',
    quantity: 1,
    expDays: 365,
    location: 'Freezer',
    notes: '',
  },
  {
    name: 'Coffee',
    category: 'Beverages',
    unit: 'bag',
    quantity: 1,
    expDays: 90,
    location: 'Pantry',
    notes: 'Keep sealed for freshness',
  },
  {
    name: 'Ketchup',
    category: 'Condiments',
    unit: 'bottle',
    quantity: 1,
    expDays: 180,
    location: 'Fridge',
    notes: 'Refrigerate after opening',
  },
]

type CreatedDocumentBody = {
  documentId?: string
  data?: {
    name?: string
    icon?: string
    color?: string
    sortOrder?: number
    categoryId?: string | null
    defaultUnit?: string
    defaultQuantity?: number
    defaultExpirationDays?: number | null
    defaultStorageLocationId?: string | null
    notes?: string
  }
}

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

function docId(collectionId: string, name: string): string {
  return `${collectionId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function collectionIdFromUrl(url: string): string {
  return (
    String(url)
      .split('?')[0]
      ?.match(/\/collections\/([^/]+)\/documents/)?.[1] ?? ''
  )
}

function makeSeedFetchMock() {
  const documentsByCollection = new Map<string, { $id: string; name: string }[]>()

  return vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url)
    const method = init?.method ?? 'GET'

    if (!href.includes('/documents')) {
      throw new Error(`Unexpected fetch: ${method} ${href}`)
    }

    const collectionId = collectionIdFromUrl(href)
    const documents = documentsByCollection.get(collectionId) ?? []

    if (method === 'POST') {
      const body = JSON.parse(String(init?.body)) as CreatedDocumentBody
      const name = body.data?.name
      if (!name) {
        throw new Error(`Unexpected POST without a document name: ${href}`)
      }
      const doc = { $id: docId(collectionId, name), name }
      documents.push(doc)
      documentsByCollection.set(collectionId, documents)
      return jsonResponse({ $id: doc.$id }, 201)
    }

    return jsonResponse(listWindow(documents, href))
  })
}

function postBodies(fetchMock: ReturnType<typeof vi.fn>, path: string): CreatedDocumentBody[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => {
      return String(url).includes(path) && (init as RequestInit | undefined)?.method === 'POST'
    })
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as CreatedDocumentBody)
}

async function runSeed() {
  stubRequiredEnv()
  const fetchMock = makeSeedFetchMock()
  vi.stubGlobal('fetch', fetchMock)
  mockConsole()

  const { seed } = await import('@/scripts/seed')
  await seed()

  return fetchMock
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('seed content against empty collections', () => {
  it('creates exactly three starter locations with valid icons and sortOrder', async () => {
    const fetchMock = await runSeed()

    const posts = postBodies(fetchMock, LOCATIONS_DOCUMENTS_PATH)
    expect(posts).toHaveLength(EXPECTED_LOCATIONS.length)
    for (const expected of EXPECTED_LOCATIONS) {
      const posted = posts.find((body) => body.data?.name === expected.name)
      expect(posted, expected.name).toBeDefined()
      expect(posted?.data?.icon).toBe(expected.icon)
      expect(Array.from(LOCATION_ICONS)).toContain(expected.icon)
      expect(posted?.data?.sortOrder).toBe(expected.sortOrder)
    }
  })

  it('creates exactly the eight existing starter categories unchanged', async () => {
    const fetchMock = await runSeed()

    const posts = postBodies(fetchMock, CATEGORIES_DOCUMENTS_PATH)
    expect(posts).toHaveLength(EXPECTED_CATEGORIES.length)
    for (const expected of EXPECTED_CATEGORIES) {
      const posted = posts.find((body) => body.data?.name === expected.name)
      expect(posted, expected.name).toBeDefined()
      expect(posted?.data?.icon).toBe(expected.icon)
      expect(posted?.data?.color).toBe(expected.color)
      expect(posted?.data?.sortOrder).toBe(expected.sortOrder)
    }
  })

  it('creates exactly twelve starter templates and nothing in items', async () => {
    const fetchMock = await runSeed()

    const templatePosts = postBodies(fetchMock, TEMPLATES_DOCUMENTS_PATH)
    expect(templatePosts).toHaveLength(EXPECTED_TEMPLATES.length)
    const postedNames = templatePosts.map((body) => body.data?.name ?? '')
    expect(new Set(postedNames)).toEqual(new Set(EXPECTED_TEMPLATES.map((row) => row.name)))
    expect(postBodies(fetchMock, ITEMS_DOCUMENTS_PATH)).toHaveLength(0)
  })
})

describe('seed template field mapping', () => {
  it.each(
    EXPECTED_TEMPLATES,
  )('creates $name with mapped category, location, and starter defaults', async (row) => {
    const fetchMock = await runSeed()

    const posted = postBodies(fetchMock, TEMPLATES_DOCUMENTS_PATH).find(
      (body) => body.data?.name === row.name,
    )
    expect(posted, row.name).toBeDefined()
    expect(posted?.data).toMatchObject({
      categoryId: docId('categories', row.category),
      defaultStorageLocationId: docId('locations', row.location),
      defaultUnit: row.unit,
      defaultQuantity: row.quantity,
      defaultExpirationDays: row.expDays,
      notes: row.notes,
    })
    expect(Array.from(UNITS)).toContain(posted?.data?.defaultUnit ?? '')
  })
})
