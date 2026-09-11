import { createInterface } from 'node:readline/promises'
import { config } from 'dotenv'

config({ path: '.env.local' })

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY

const DATABASE_ID = 'home_pantry'

export function createAttributeBody(attr: {
  key: string
  required: boolean
  size?: number
  array?: boolean
  default?: unknown
  min?: number
  max?: number
}): Record<string, unknown> {
  const body: Record<string, unknown> = { key: attr.key, required: attr.required }

  if (attr.size !== undefined) body.size = attr.size
  if (attr.array !== undefined) body.array = attr.array
  if (attr.default !== undefined) body.default = attr.default
  if (attr.min !== undefined) body.min = attr.min
  if (attr.max !== undefined) body.max = attr.max

  return body
}

export type ConfirmWipeParams = {
  endpoint: string
  projectId: string
  databaseId: string
  stdin?: NodeJS.ReadStream
  stdout?: NodeJS.WritableStream
  env?: NodeJS.ProcessEnv
}

export type SetupOptions = {
  confirmWipe?: (params: ConfirmWipeParams) => Promise<boolean>
  stdin?: NodeJS.ReadStream
  stdout?: NodeJS.WritableStream
}

export function isWipeRequested(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.SETUP_WIPE === '1' || argv.includes('--wipe')
}

export async function confirmWipe({
  endpoint: wipeEndpoint,
  projectId: wipeProjectId,
  databaseId,
  stdin = process.stdin,
  stdout = process.stdout,
  env = process.env,
}: ConfirmWipeParams): Promise<boolean> {
  const prompt =
    `This will DELETE collections in database "${databaseId}" at\n` +
    `  Endpoint: ${wipeEndpoint}\n` +
    `  Project: ${wipeProjectId}\n` +
    `  Database: ${databaseId}\n` +
    `Type y to confirm wipe [y/N]: `

  if (env.SETUP_WIPE_CONFIRM === 'yes') {
    stdout.write(`${prompt}yes (SETUP_WIPE_CONFIRM)\n`)
    return true
  }

  if (!stdin.isTTY) {
    throw new Error(
      `Wipe requested but stdin is not a TTY. Refusing to wipe ${databaseId} at ${wipeEndpoint} (project ${wipeProjectId}) without confirmation. Re-run interactively, or set SETUP_WIPE_CONFIRM=yes after reviewing the target.`,
    )
  }

  const rl = createInterface({ input: stdin, output: stdout })
  try {
    const answer = await rl.question(prompt)
    return /^\s*y(es)?\s*$/i.test(answer)
  } finally {
    rl.close()
  }
}

export async function setup(options: SetupOptions = {}) {
  if (!endpoint || !projectId || !apiKey) {
    console.error('Missing environment variables')
    process.exit(1)
  }

  console.log('Setting up Appwrite database and collections...')
  console.log(`Endpoint: ${endpoint}`)
  console.log(`Project: ${projectId}`)
  console.log(`Database: ${DATABASE_ID}`)

  async function apiCall(path: string, method: string = 'POST', body?: object) {
    const response = await fetch(`${endpoint}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId as string,
        'X-Appwrite-Key': apiKey as string,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    let payload: { message?: string } = {}
    try {
      payload = await response.json()
    } catch {
      payload = {}
    }

    if (!response.ok) {
      return {
        error: payload.message || JSON.stringify(payload),
        status: response.status,
      }
    }

    return { data: payload, status: response.status }
  }

  async function deleteCollection(collectionId: string) {
    const result = await apiCall(`/databases/${DATABASE_ID}/collections/${collectionId}`, 'DELETE')
    if (result.status === 404) {
      console.log(`   Collection ${collectionId} not found, skipping wipe...`)
      return
    }
    if (result.error) {
      console.error(`   Error deleting ${collectionId}:`, result.error)
      throw new Error(`Failed to delete collection ${collectionId}: ${result.error}`)
    }
    console.log(`   Deleted collection: ${collectionId}`)
  }

  function assertCollectionCreated(
    result: { error?: string },
    collectionId: string,
    allowAlreadyExists: boolean,
  ) {
    if (result.error) {
      if (allowAlreadyExists && result.error.includes('already exists')) {
        console.log(`   Collection ${collectionId} already exists, skipping...`)
        return
      }
      throw new Error(`Failed to create collection ${collectionId}: ${result.error}`)
    }
    console.log(`   Created collection: ${collectionId}`)
  }

  function assertSchemaPartCreated(
    result: { error?: string },
    kind: 'attribute' | 'index',
    name: string,
  ) {
    if (result.error) {
      if (result.error.includes('already exists')) {
        const label = kind === 'attribute' ? 'Attribute' : 'Index'
        console.log(`   ${label} ${name} already exists, skipping...`)
        return
      }
      throw new Error(`Failed to create ${kind} ${name}: ${result.error}`)
    }
    console.log(`   Added ${kind}: ${name}`)
  }

  console.log('\n1. Creating database...')
  const dbResult = await apiCall('/databases', 'POST', {
    databaseId: DATABASE_ID,
    name: 'Home Pantry',
  })

  if (dbResult.error) {
    if (dbResult.error.includes('already exists')) {
      console.log('   Database already exists, skipping...')
    } else {
      console.error('   Error:', dbResult.error)
    }
  } else {
    console.log(`   Created database: ${DATABASE_ID}`)
  }

  let wipe = false
  if (isWipeRequested()) {
    console.log('\n2. Wipe requested for existing collections...')
    console.log(`   Wipe target: ${endpoint} / ${projectId} / ${DATABASE_ID}`)
    const confirmed = await (options.confirmWipe ?? confirmWipe)({
      endpoint,
      projectId,
      databaseId: DATABASE_ID,
      stdin: options.stdin,
      stdout: options.stdout,
    })
    if (confirmed) {
      wipe = true
      console.log('   Confirmed. Wiping existing collections...')
      for (const collectionId of ['items', 'item_templates', 'categories', 'locations']) {
        await deleteCollection(collectionId)
      }
    } else {
      console.log('   Wipe declined. Continuing create-if-missing / verify-only...')
    }
  } else {
    console.log(
      '\n2. Create-if-missing / verify-only (no collection wipe). Use --wipe or SETUP_WIPE=1 to wipe.',
    )
  }

  console.log('\n3. Creating locations collection...')
  const locResult = await apiCall(`/databases/${DATABASE_ID}/collections`, 'POST', {
    collectionId: 'locations',
    name: 'Locations',
    permissions: ['read("users")', 'create("users")', 'update("users")', 'delete("users")'],
    documentSecurity: false,
  })

  assertCollectionCreated(locResult, 'locations', !wipe)

  console.log('   Adding attributes to locations...')
  const locationsAttributes = [
    { key: 'name', type: 'string', size: 128, required: true },
    { key: 'description', type: 'string', size: 500, required: false },
    { key: 'icon', type: 'string', size: 64, required: false },
    {
      key: 'sortOrder',
      type: 'integer',
      min: -2147483648,
      max: 2147483647,
      required: false,
      default: 0,
    },
    { key: 'createdAt', type: 'string', size: 255, required: true },
    { key: 'updatedAt', type: 'string', size: 255, required: true },
  ]

  for (const attr of locationsAttributes) {
    const attrResult = await apiCall(
      `/databases/${DATABASE_ID}/collections/locations/attributes/${attr.type}`,
      'POST',
      createAttributeBody(attr),
    )
    assertSchemaPartCreated(attrResult, 'attribute', attr.key)
  }

  console.log('\n3. Creating categories collection...')
  const catResult = await apiCall(`/databases/${DATABASE_ID}/collections`, 'POST', {
    collectionId: 'categories',
    name: 'Categories',
    permissions: ['read("users")', 'create("users")', 'update("users")', 'delete("users")'],
    documentSecurity: false,
  })

  assertCollectionCreated(catResult, 'categories', !wipe)

  console.log('   Adding attributes to categories...')
  const categoriesAttributes = [
    { key: 'name', type: 'string', size: 64, required: true },
    { key: 'description', type: 'string', size: 500, required: false },
    { key: 'icon', type: 'string', size: 64, required: false },
    { key: 'color', type: 'string', size: 16, required: false },
    {
      key: 'sortOrder',
      type: 'integer',
      min: -2147483648,
      max: 2147483647,
      required: false,
      default: 0,
    },
    { key: 'createdAt', type: 'string', size: 255, required: true },
    { key: 'updatedAt', type: 'string', size: 255, required: true },
  ]

  for (const attr of categoriesAttributes) {
    const attrResult = await apiCall(
      `/databases/${DATABASE_ID}/collections/categories/attributes/${attr.type}`,
      'POST',
      createAttributeBody(attr),
    )
    assertSchemaPartCreated(attrResult, 'attribute', attr.key)
  }

  console.log('\n4. Creating item_templates collection...')
  const itemTemplatesResult = await apiCall(`/databases/${DATABASE_ID}/collections`, 'POST', {
    collectionId: 'item_templates',
    name: 'Item Templates',
    permissions: ['read("users")', 'create("users")', 'update("users")', 'delete("users")'],
    documentSecurity: false,
  })

  assertCollectionCreated(itemTemplatesResult, 'item_templates', !wipe)

  console.log('   Adding attributes to item_templates...')
  const itemTemplatesAttributes = [
    { key: 'name', type: 'string', size: 255, required: true },
    { key: 'categoryId', type: 'string', size: 255, required: false },
    { key: 'defaultUnit', type: 'string', size: 50, required: true, default: 'each' },
    { key: 'defaultQuantity', type: 'float', required: true, default: 1.0 },
    { key: 'defaultExpirationDays', type: 'integer', required: false },
    { key: 'defaultStorageLocationId', type: 'string', size: 255, required: false },
    { key: 'notes', type: 'string', size: 1000, required: false },
    { key: 'createdAt', type: 'string', size: 255, required: true },
    { key: 'updatedAt', type: 'string', size: 255, required: true },
  ]

  for (const attr of itemTemplatesAttributes) {
    const attrResult = await apiCall(
      `/databases/${DATABASE_ID}/collections/item_templates/attributes/${attr.type}`,
      'POST',
      createAttributeBody(attr),
    )
    assertSchemaPartCreated(attrResult, 'attribute', attr.key)
  }

  console.log('   Adding indexes to item_templates...')
  const itemTemplatesIndexes = [
    { key: 'name_index', type: 'fulltext', attributes: ['name'] },
    { key: 'category_index', type: 'key', attributes: ['categoryId'] },
  ]

  for (const index of itemTemplatesIndexes) {
    const indexResult = await apiCall(
      `/databases/${DATABASE_ID}/collections/item_templates/indexes`,
      'POST',
      {
        key: index.key,
        type: index.type,
        attributes: index.attributes,
      },
    )
    assertSchemaPartCreated(indexResult, 'index', index.key)
  }

  console.log('\n6. Creating items collection...')
  const itemsResult = await apiCall(`/databases/${DATABASE_ID}/collections`, 'POST', {
    collectionId: 'items',
    name: 'Items',
    permissions: ['read("users")', 'create("users")', 'update("users")', 'delete("users")'],
    documentSecurity: false,
  })

  assertCollectionCreated(itemsResult, 'items', !wipe)

  console.log('   Adding attributes to items...')
  const itemsAttributes = [
    { key: 'name', type: 'string', size: 255, required: true },
    { key: 'templateId', type: 'string', size: 255, required: false },
    { key: 'categoryId', type: 'string', size: 255, required: false },
    { key: 'locationId', type: 'string', size: 255, required: true },
    { key: 'quantity', type: 'float', required: false, default: 1.0 },
    { key: 'unit', type: 'string', size: 50, required: false, default: 'each' },
    { key: 'expirationDate', type: 'string', size: 255, required: false },
    { key: 'purchaseDate', type: 'string', size: 255, required: false },
    { key: 'notes', type: 'string', size: 1000, required: false },
    { key: 'createdById', type: 'string', size: 255, required: true },
    { key: 'createdAt', type: 'string', size: 255, required: true },
    { key: 'updatedAt', type: 'string', size: 255, required: true },
  ]

  for (const attr of itemsAttributes) {
    const attrResult = await apiCall(
      `/databases/${DATABASE_ID}/collections/items/attributes/${attr.type}`,
      'POST',
      createAttributeBody(attr),
    )
    assertSchemaPartCreated(attrResult, 'attribute', attr.key)
  }

  console.log('   Adding indexes to items...')
  const itemsIndexes = [
    { key: 'name_index', type: 'fulltext', attributes: ['name'] },
    { key: 'location_index', type: 'key', attributes: ['locationId'] },
    { key: 'category_index', type: 'key', attributes: ['categoryId'] },
    { key: 'expiration_index', type: 'key', attributes: ['expirationDate'] },
    { key: 'createdby_index', type: 'key', attributes: ['createdById'] },
  ]

  for (const index of itemsIndexes) {
    const indexResult = await apiCall(
      `/databases/${DATABASE_ID}/collections/items/indexes`,
      'POST',
      {
        key: index.key,
        type: index.type,
        attributes: index.attributes,
      },
    )
    assertSchemaPartCreated(indexResult, 'index', index.key)
  }

  console.log('\nSetup complete!')
  console.log('\nNext steps:')
  console.log('1. Wait 10-20 seconds for collections to be fully ready')
  console.log('2. Run: pnpm seed')
}

if (process.env.NODE_ENV !== 'test') {
  setup().catch((error) => {
    console.error('Setup failed:', error)
    process.exit(1)
  })
}
