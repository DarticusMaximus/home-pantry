import {
  APPWRITE_SCRIPT_ENV_VARS,
  describeResponseError,
  loadLocalEnv,
  missingEnvMessage,
} from './lib/operator-helpers'

loadLocalEnv()

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY

const DATABASE_ID = 'home_pantry'
const TEMPLATES_COLLECTION_ID = 'item_templates'
const CATEGORIES_COLLECTION_ID = 'categories'
const LOCATIONS_COLLECTION_ID = 'locations'

const templates = [
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

export async function seedTemplates() {
  const missingEnv = missingEnvMessage(process.env, APPWRITE_SCRIPT_ENV_VARS)
  if (missingEnv) {
    throw new Error(missingEnv)
  }

  console.log('\n3. Checking templates...')

  const templatesResult = await apiCall(
    `/databases/${DATABASE_ID}/collections/${TEMPLATES_COLLECTION_ID}/documents?queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] }))}`,
  )

  if (templatesResult.total > 0) {
    console.log('   Skipped - templates already exist')
    return
  }

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

  let createdCount = 0
  const now = new Date().toISOString()

  for (const t of templates) {
    const categoryId = categoryMap.get(t.category)
    const locationId = locationMap.get(t.location)

    if (!categoryId) {
      console.warn(`      Warning: Category "${t.category}" not found for template "${t.name}"`)
    }
    if (!locationId) {
      console.warn(`      Warning: Location "${t.location}" not found for template "${t.name}"`)
    }
    if (!categoryId || !locationId) {
      continue
    }

    await apiCall(
      `/databases/${DATABASE_ID}/collections/${TEMPLATES_COLLECTION_ID}/documents`,
      'POST',
      {
        documentId: 'unique()',
        data: {
          name: t.name,
          categoryId,
          defaultUnit: t.unit,
          defaultQuantity: t.quantity,
          defaultExpirationDays: t.expDays,
          defaultStorageLocationId: locationId,
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
    console.warn('      Warning: No templates were created - all starter template lookups missed')
  } else {
    console.log(`   Seeded ${createdCount} templates`)
  }
}
