import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLLECTIONS, DATABASE_ID } from '@/lib/constants'

const DATA_MODEL_FLOOR = {
  databaseId: 'home_pantry',
  collections: {
    locations: 'locations',
    categories: 'categories',
    item_templates: 'item_templates',
    items: 'items',
  },
  appwriteAttributes: {
    locations: ['name', 'description', 'icon', 'sortOrder', 'createdAt', 'updatedAt'],
    categories: ['name', 'description', 'icon', 'color', 'sortOrder', 'createdAt', 'updatedAt'],
    item_templates: [
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
    items: [
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
  },
  clientKeys: {
    Item: [
      'id',
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
    ItemTemplate: [
      'id',
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
    Location: ['id', 'name', 'description', 'icon', 'sortOrder', 'createdAt', 'updatedAt'],
    Category: ['id', 'name', 'description', 'icon', 'color', 'sortOrder', 'createdAt', 'updatedAt'],
  },
  indexes: {
    item_templates: ['name_index', 'category_index'],
    items: [
      'name_index',
      'location_index',
      'category_index',
      'expiration_index',
      'createdby_index',
    ],
  },
}

function repoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function interfaceKeys(source: string, name: string): string[] {
  const marker = `export interface ${name} {`
  const start = source.indexOf(marker)
  if (start === -1) {
    throw new Error(`Could not find export interface ${name}`)
  }
  const bodyStart = start + marker.length
  const bodyEnd = source.indexOf('}', bodyStart)
  if (bodyEnd === -1) {
    throw new Error(`Unclosed export interface ${name}`)
  }
  const keys: string[] = []
  for (const line of source.slice(bodyStart, bodyEnd).split('\n')) {
    const match = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*)\??\s*:/)
    if (match?.[1]) {
      keys.push(match[1])
    }
  }
  return keys
}

function attributeKeys(setupSource: string, arrayName: string): string[] {
  const marker = `const ${arrayName} = [`
  const start = setupSource.indexOf(marker)
  if (start === -1) {
    throw new Error(`Could not find ${arrayName}`)
  }
  const bodyStart = start + marker.length
  const bodyEnd = setupSource.indexOf(']', bodyStart)
  if (bodyEnd === -1) {
    throw new Error(`Unclosed ${arrayName}`)
  }
  return [...setupSource.slice(bodyStart, bodyEnd).matchAll(/key:\s*'([^']+)'/g)].map(
    (match) => match[1],
  )
}

function indexKeys(setupSource: string, arrayName: string): string[] {
  const marker = `const ${arrayName} = [`
  const start = setupSource.indexOf(marker)
  if (start === -1) {
    throw new Error(`Could not find ${arrayName}`)
  }
  const openIndex = start + marker.length - 1
  let depth = 0
  let closeIndex = -1
  for (let i = openIndex; i < setupSource.length; i++) {
    const char = setupSource[i]
    if (char === '[') {
      depth += 1
    } else if (char === ']') {
      depth -= 1
      if (depth === 0) {
        closeIndex = i
        break
      }
    }
  }
  if (closeIndex === -1) {
    throw new Error(`Unclosed ${arrayName}`)
  }
  return [...setupSource.slice(openIndex + 1, closeIndex).matchAll(/key:\s*'([^']+)'/g)].map(
    (match) => match[1],
  )
}

const setupSource = repoFile('scripts/setup-appwrite.ts')
const itemSource = repoFile('types/item.ts')
const templateSource = repoFile('types/template.ts')
const locationSource = repoFile('types/location.ts')
const categorySource = repoFile('types/category.ts')

describe('data-model snapshot (Stage 01 floor)', () => {
  it('DATABASE_ID and COLLECTIONS match the floor', () => {
    expect(DATABASE_ID).toBe(DATA_MODEL_FLOOR.databaseId)
    expect({ ...COLLECTIONS }).toEqual(DATA_MODEL_FLOOR.collections)
    expect(Object.keys(COLLECTIONS)).toEqual(Object.keys(DATA_MODEL_FLOOR.collections))
  })

  it('Appwrite attribute keys match the floor in order', () => {
    expect(attributeKeys(setupSource, 'locationsAttributes')).toEqual(
      DATA_MODEL_FLOOR.appwriteAttributes.locations,
    )
    expect(attributeKeys(setupSource, 'categoriesAttributes')).toEqual(
      DATA_MODEL_FLOOR.appwriteAttributes.categories,
    )
    expect(attributeKeys(setupSource, 'itemTemplatesAttributes')).toEqual(
      DATA_MODEL_FLOOR.appwriteAttributes.item_templates,
    )
    expect(attributeKeys(setupSource, 'itemsAttributes')).toEqual(
      DATA_MODEL_FLOOR.appwriteAttributes.items,
    )
  })

  it('client interface keys match the floor in order', () => {
    expect(interfaceKeys(itemSource, 'Item')).toEqual(DATA_MODEL_FLOOR.clientKeys.Item)
    expect(interfaceKeys(templateSource, 'ItemTemplate')).toEqual(
      DATA_MODEL_FLOOR.clientKeys.ItemTemplate,
    )
    expect(interfaceKeys(locationSource, 'Location')).toEqual(DATA_MODEL_FLOOR.clientKeys.Location)
    expect(interfaceKeys(categorySource, 'Category')).toEqual(DATA_MODEL_FLOOR.clientKeys.Category)
  })

  it('index keys match the floor in order', () => {
    expect(indexKeys(setupSource, 'itemTemplatesIndexes')).toEqual(
      DATA_MODEL_FLOOR.indexes.item_templates,
    )
    expect(indexKeys(setupSource, 'itemsIndexes')).toEqual(DATA_MODEL_FLOOR.indexes.items)
  })

  it('records the floor in .ssc/baseline/data-model.md', () => {
    const markdownPath = path.join(process.cwd(), '.ssc/baseline/data-model.md')
    expect(existsSync(markdownPath), 'missing .ssc/baseline/data-model.md').toBe(true)

    const markdown = readFileSync(markdownPath, 'utf8')

    expect(markdown).toContain(DATA_MODEL_FLOOR.databaseId)
    for (const collectionId of Object.values(DATA_MODEL_FLOOR.collections)) {
      expect(markdown).toContain(collectionId)
    }
    for (const key of Object.values(DATA_MODEL_FLOOR.appwriteAttributes).flat()) {
      expect(markdown, `attribute ${key}`).toContain(key)
    }
    expect(markdown).toContain('items.quantity')
    expect(markdown).toContain('items.unit')
    expect(markdown).toContain('1.0')
    expect(markdown).toContain("'each'")
    expect(markdown).toMatch(/Item\.quantity/)
    expect(markdown).toMatch(/Item\.unit/)
    expect(markdown).toMatch(/optional/)
    expect(markdown).toMatch(/required/)
    expect(markdown).toContain('documentSecurity: false')
    expect(markdown).toContain('$id')
    for (const indexName of Object.values(DATA_MODEL_FLOOR.indexes).flat()) {
      expect(markdown, `index ${indexName}`).toContain(indexName)
    }
  })

  it('omits tags and isPartialTrackable from item_templates / ItemTemplate', () => {
    expect(DATA_MODEL_FLOOR.appwriteAttributes.item_templates).not.toContain('tags')
    expect(DATA_MODEL_FLOOR.appwriteAttributes.item_templates).not.toContain('isPartialTrackable')
    expect(DATA_MODEL_FLOOR.clientKeys.ItemTemplate).not.toContain('tags')
    expect(DATA_MODEL_FLOOR.clientKeys.ItemTemplate).not.toContain('isPartialTrackable')

    const markdown = repoFile('.ssc/baseline/data-model.md')
    expect(markdown).toMatch(
      /item_templates[\s\S]{0,80}ItemTemplate[\s\S]{0,40}omit `tags` and `isPartialTrackable`/,
    )
    expect(templateSource).not.toContain('tags')
    expect(templateSource).not.toContain('isPartialTrackable')
    expect(setupSource).not.toContain('isPartialTrackable')
    expect(setupSource).not.toMatch(/key:\s*'tags'/)
  })

  it('fails closed on floor regressions', () => {
    expect({ ...DATA_MODEL_FLOOR.collections, extra: 'extra' }).not.toEqual(
      DATA_MODEL_FLOOR.collections,
    )

    const ghostFlag = 'is' + 'Active'
    const templateWithGhostFlag = `export interface ItemTemplate {
  id: string
  name: string
  ${ghostFlag}: boolean
}`
    expect(interfaceKeys(templateWithGhostFlag, 'ItemTemplate')).toContain(ghostFlag)
    expect(interfaceKeys(templateWithGhostFlag, 'ItemTemplate')).not.toEqual(
      DATA_MODEL_FLOOR.clientKeys.ItemTemplate,
    )

    const attributesWithoutGhostFlag = `const itemTemplatesAttributes = [
  { key: 'name', type: 'string' },
  { key: 'createdAt', type: 'string' },
]`
    expect(attributeKeys(attributesWithoutGhostFlag, 'itemTemplatesAttributes')).not.toContain(
      ghostFlag,
    )

    const reorderedAttributes = `const locationsAttributes = [
  { key: 'description', type: 'string' },
  { key: 'name', type: 'string' },
  { key: 'icon', type: 'string' },
  { key: 'sortOrder', type: 'integer' },
  { key: 'createdAt', type: 'string' },
  { key: 'updatedAt', type: 'string' },
]`
    expect(attributeKeys(reorderedAttributes, 'locationsAttributes')).not.toEqual(
      DATA_MODEL_FLOOR.appwriteAttributes.locations,
    )

    const nestedIndexSource = `const itemsIndexes = [
  { key: 'name_index', type: 'fulltext', attributes: ['name'] },
  { key: 'location_index', type: 'key', attributes: ['locationId'] },
]`
    expect(indexKeys(nestedIndexSource, 'itemsIndexes')).toEqual(['name_index', 'location_index'])
  })
})
