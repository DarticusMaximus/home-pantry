import { config } from 'dotenv'
import {
  APPWRITE_SCRIPT_ENV_VARS,
  describeResponseError,
  missingEnvMessage,
} from './lib/operator-helpers'

config({ path: '.env.local' })

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY

const DATABASE_ID = 'home_pantry'
const TEMPLATES_COLLECTION_ID = 'item_templates'
const CATEGORIES_COLLECTION_ID = 'categories'
const LOCATIONS_COLLECTION_ID = 'locations'

const templates = [
  {
    name: 'Steak',
    category: 'Meat',
    unit: 'each',
    quantity: 1,
    expDays: 180,
    location: 'Large Freezer',
    notes: 'Gets freezer burn after 6 months',
  },
  {
    name: 'Ground Beef',
    category: 'Meat',
    unit: 'lb',
    quantity: 1,
    expDays: 90,
    location: 'Large Freezer',
    notes: 'Good for tacos, spaghetti',
  },
  {
    name: 'Chicken Breast',
    category: 'Meat',
    unit: 'lb',
    quantity: 1,
    expDays: 180,
    location: 'Large Freezer',
    notes: 'Versatile, great for meal prep',
  },
  {
    name: 'Pork Chops',
    category: 'Meat',
    unit: 'each',
    quantity: 1,
    expDays: 180,
    location: 'Large Freezer',
    notes: '',
  },
  {
    name: 'Bacon',
    category: 'Meat',
    unit: 'pack',
    quantity: 1,
    expDays: 30,
    location: 'Fridge',
    notes: 'Keep refrigerated after opening',
  },
  {
    name: 'Hot Dogs',
    category: 'Meat',
    unit: 'pack',
    quantity: 1,
    expDays: 14,
    location: 'Fridge',
    notes: '',
  },
  {
    name: 'Frozen Vegetables',
    category: 'Frozen',
    unit: 'bag',
    quantity: 1,
    expDays: 365,
    location: 'Large Freezer',
    notes: 'Keep frozen until use',
  },
  {
    name: 'Frozen Pizza',
    category: 'Frozen',
    unit: 'each',
    quantity: 1,
    expDays: 180,
    location: 'Large Freezer',
    notes: '',
  },
  {
    name: 'Ice Cream',
    category: 'Frozen',
    unit: 'container',
    quantity: 1,
    expDays: 90,
    location: 'Large Freezer',
    notes: 'Store in deep freeze for longer shelf life',
  },
  {
    name: 'Frozen Berries',
    category: 'Frozen',
    unit: 'bag',
    quantity: 1,
    expDays: 365,
    location: 'Large Freezer',
    notes: 'Great for smoothies',
  },
  {
    name: 'Milk',
    category: 'Dairy',
    unit: 'gal',
    quantity: 1,
    expDays: 7,
    location: 'Fridge',
    notes: 'Check expiration date',
  },
  {
    name: 'Eggs',
    category: 'Dairy',
    unit: 'each',
    quantity: 12,
    expDays: 21,
    location: 'Fridge',
    notes: 'Store in main part of fridge, not door',
  },
  {
    name: 'Cheese (Shredded)',
    category: 'Dairy',
    unit: 'bag',
    quantity: 1,
    expDays: 14,
    location: 'Fridge',
    notes: 'Reseal tightly after opening',
  },
  {
    name: 'Butter',
    category: 'Dairy',
    unit: 'lb',
    quantity: 1,
    expDays: 30,
    location: 'Fridge',
    notes: 'Can freeze for longer storage',
  },
  {
    name: 'Yogurt',
    category: 'Dairy',
    unit: 'cup',
    quantity: 1,
    expDays: 14,
    location: 'Fridge',
    notes: '',
  },
  {
    name: 'Bread',
    category: 'Pantry',
    unit: 'each',
    quantity: 1,
    expDays: 7,
    location: 'Pantry',
    notes: 'Store at room temperature',
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
    name: 'Canned Tomatoes',
    category: 'Pantry',
    unit: 'can',
    quantity: 1,
    expDays: null,
    location: 'Pantry',
    notes: '',
  },
  {
    name: 'Cereal',
    category: 'Pantry',
    unit: 'box',
    quantity: 1,
    expDays: 30,
    location: 'Pantry',
    notes: 'Keep sealed for freshness',
  },
  {
    name: 'Orange Juice',
    category: 'Beverages',
    unit: 'bottle',
    quantity: 1,
    expDays: 14,
    location: 'Fridge',
    notes: 'Shake well before serving',
  },
  {
    name: 'Soda',
    category: 'Beverages',
    unit: 'can',
    quantity: 1,
    expDays: null,
    location: 'Pantry',
    notes: '',
  },
  {
    name: 'Coffee',
    category: 'Beverages',
    unit: 'bag',
    quantity: 1,
    expDays: 90,
    location: 'Pantry',
    notes: 'Store in airtight container',
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
  {
    name: 'Mayonnaise',
    category: 'Condiments',
    unit: 'jar',
    quantity: 1,
    expDays: 60,
    location: 'Fridge',
    notes: 'Keep refrigerated',
  },
  {
    name: 'Mustard',
    category: 'Condiments',
    unit: 'bottle',
    quantity: 1,
    expDays: 365,
    location: 'Fridge',
    notes: 'Long shelf life refrigerated',
  },
  {
    name: 'Salad Dressing',
    category: 'Condiments',
    unit: 'bottle',
    quantity: 1,
    expDays: 90,
    location: 'Fridge',
    notes: 'Check expiration date',
  },
  {
    name: 'Apples',
    category: 'Produce',
    unit: 'lb',
    quantity: 1,
    expDays: 14,
    location: 'Fridge',
    notes: 'Keep in crisper drawer',
  },
  {
    name: 'Bananas',
    category: 'Produce',
    unit: 'each',
    quantity: 1,
    expDays: 5,
    location: 'Pantry',
    notes: "Don't refrigerate",
  },
  {
    name: 'Onions',
    category: 'Produce',
    unit: 'bag',
    quantity: 1,
    expDays: 30,
    location: 'Pantry',
    notes: 'Store in cool, dry place',
  },
]

async function apiCall(path: string, method: string = 'GET', body?: object) {
  let response: Response
  try {
    response = await fetch(`${endpoint}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId as string,
        'X-Appwrite-Key': apiKey as string,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    })
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }

  if (!response.ok) {
    throw new Error(await describeResponseError(response))
  }

  return response.json()
}

function encodeQuery(method: string, values: unknown[]) {
  return `queries[]=${encodeURIComponent(JSON.stringify({ method, values }))}`
}

async function listAllTemplateDocuments() {
  const pageSize = 100
  const documents: { name: string }[] = []
  let offset = 0

  for (;;) {
    const result = await apiCall(
      `/databases/${DATABASE_ID}/collections/${TEMPLATES_COLLECTION_ID}/documents?${encodeQuery('limit', [pageSize])}&${encodeQuery('offset', [offset])}`,
    )
    const page = Array.isArray(result.documents) ? result.documents : []
    documents.push(...page)

    const total = typeof result.total === 'number' ? result.total : documents.length
    offset += page.length

    if (page.length === 0 || documents.length >= total || page.length < pageSize) {
      break
    }
  }

  return documents
}

export async function seedTemplates() {
  const missingEnv = missingEnvMessage(process.env, APPWRITE_SCRIPT_ENV_VARS)
  if (missingEnv) {
    throw new Error(missingEnv)
  }

  console.log('\n3. Checking templates...')

  // Get all categories to map names to IDs
  const categoriesResult = await apiCall(
    `/databases/${DATABASE_ID}/collections/${CATEGORIES_COLLECTION_ID}/documents`,
  )
  const categoryMap = new Map(categoriesResult.documents.map((c: any) => [c.name, c.$id]))

  // Get all locations to map names to IDs
  const locationsResult = await apiCall(
    `/databases/${DATABASE_ID}/collections/${LOCATIONS_COLLECTION_ID}/documents`,
  )
  const locationMap = new Map(locationsResult.documents.map((l: any) => [l.name, l.$id]))

  const existingTemplates = await listAllTemplateDocuments()
  const existingNames = new Set(existingTemplates.map((t) => t.name))

  let createdCount = 0
  const now = new Date().toISOString()

  for (const t of templates) {
    if (existingNames.has(t.name)) {
      continue
    }

    const categoryId = categoryMap.get(t.category)
    const locationId = locationMap.get(t.location)

    if (!categoryId) {
      console.warn(`      Warning: Category "${t.category}" not found for template "${t.name}"`)
    }
    if (!locationId) {
      console.warn(`      Warning: Location "${t.location}" not found for template "${t.name}"`)
    }

    await apiCall(
      `/databases/${DATABASE_ID}/collections/${TEMPLATES_COLLECTION_ID}/documents`,
      'POST',
      {
        documentId: 'unique()',
        data: {
          name: t.name,
          categoryId: categoryId || null,
          defaultUnit: t.unit,
          defaultQuantity: t.quantity,
          defaultExpirationDays: t.expDays,
          defaultStorageLocationId: locationId || null,
          notes: t.notes,
          createdAt: now,
          updatedAt: now,
        },
      },
    )
    console.log(`   Created template: ${t.name}`)
    createdCount++
  }

  if (createdCount === 0) {
    console.log('   Skipped - templates already exist')
  } else {
    console.log(`   Seeded ${createdCount} templates`)
  }
}
