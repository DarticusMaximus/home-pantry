import { config } from 'dotenv'
import { seedTemplates } from './seed-templates'

config({ path: '.env.local' })

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const DATABASE_ID = 'home_pantry'

const defaultLocations = [
  { name: 'Fridge', icon: 'refrigerator', sortOrder: 1 },
  { name: 'Fridge Freezer', icon: 'snowflake', sortOrder: 2 },
  { name: 'Large Freezer', icon: 'snowflake', sortOrder: 3 },
  { name: 'Deep Freezer', icon: 'archive', sortOrder: 4 },
  { name: 'Pantry', icon: 'warehouse', sortOrder: 5 },
]

const defaultCategories = [
  { name: 'Meat', icon: 'beef', color: '#ef4444', sortOrder: 1 },
  { name: 'Dairy', icon: 'milk', color: '#f97316', sortOrder: 2 },
  { name: 'Produce', icon: 'apple', color: '#22c55e', sortOrder: 3 },
  { name: 'Frozen', icon: 'snowflake', color: '#3b82f6', sortOrder: 4 },
  { name: 'Pantry', icon: 'package', color: '#a855f7', sortOrder: 5 },
  { name: 'Beverages', icon: 'cup-soda', color: '#06b6d4', sortOrder: 6 },
  { name: 'Condiments', icon: 'droplet', color: '#eab308', sortOrder: 7 },
  { name: 'Other', icon: 'package', color: '#6b7280', sortOrder: 8 },
]

async function apiCall(path: string, method: string = 'GET', body?: object) {
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Project': projectId as string,
      'X-Appwrite-Key': apiKey as string,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || JSON.stringify(error))
  }

  return response.json()
}

async function seed() {
  console.log('Starting seed...')

  // Check and seed locations
  console.log('\n1. Checking locations...')
  const locationsResult = await apiCall(
    `/databases/${DATABASE_ID}/collections/locations/documents?queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] }))}`,
  )

  if (locationsResult.total > 0) {
    console.log('   Skipped - locations already exist')
  } else {
    console.log('   Creating default locations...')
    await Promise.all(
      defaultLocations.map(async (loc) => {
        const now = new Date().toISOString()
        await apiCall(`/databases/${DATABASE_ID}/collections/locations/documents`, 'POST', {
          documentId: 'unique()',
          data: {
            name: loc.name,
            icon: loc.icon,
            sortOrder: loc.sortOrder,
            createdAt: now,
            updatedAt: now,
          },
        })
        console.log(`   Created: ${loc.name}`)
      }),
    )
    console.log(`   Seeded ${defaultLocations.length} locations`)
  }

  // Check and seed categories
  console.log('\n2. Checking categories...')
  const categoriesResult = await apiCall(
    `/databases/${DATABASE_ID}/collections/categories/documents?queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] }))}`,
  )

  if (categoriesResult.total > 0) {
    console.log('   Skipped - categories already exist')
  } else {
    console.log('   Creating default categories...')
    await Promise.all(
      defaultCategories.map(async (cat) => {
        const now = new Date().toISOString()
        await apiCall(`/databases/${DATABASE_ID}/collections/categories/documents`, 'POST', {
          documentId: 'unique()',
          data: {
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            sortOrder: cat.sortOrder,
            createdAt: now,
            updatedAt: now,
          },
        })
        console.log(`   Created: ${cat.name}`)
      }),
    )
    console.log(`   Seeded ${defaultCategories.length} categories`)
  }

  // Seed templates
  await seedTemplates()

  console.log('\nSeed complete!')
}

seed().catch((error) => {
  console.error('Seed failed:', error.message)
  process.exit(1)
})
