import { Query } from 'appwrite'
import { COLLECTIONS, DATABASE_ID } from '@/lib/constants'
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@/types/category'
import { databases } from './client'
import { createCrudService, type ListOptions } from './crud-service'
import { logAppwriteError } from './error-logging'
import { type InUseCounts, InUseError } from './in-use-error'

const categoriesService = createCrudService<Category, CreateCategoryInput, UpdateCategoryInput>({
  collectionId: COLLECTIONS.categories,
  orderBy: 'sortOrder',
  service: 'categories',
})

async function countByAttribute(
  collectionId: string,
  attribute: string,
  value: string,
): Promise<number> {
  try {
    const response = await databases.listDocuments(DATABASE_ID, collectionId, [
      Query.equal(attribute, value),
      Query.limit(1),
    ])
    return typeof response.total === 'number' ? response.total : response.documents.length
  } catch (error) {
    logAppwriteError(
      {
        service: 'categories',
        operation: 'listDocuments',
        collectionId,
      },
      error,
    )
    throw error
  }
}

export function getCategories(options: ListOptions = {}): Promise<Category[]> {
  return categoriesService.getAll(options)
}

export function getCategoryById(id: string): Promise<Category> {
  return categoriesService.getById(id)
}

export function createCategory(data: CreateCategoryInput): Promise<Category> {
  return categoriesService.create(data)
}

export function updateCategory(id: string, data: UpdateCategoryInput): Promise<Category> {
  return categoriesService.update(id, data)
}

export async function getCategoryInUse(id: string): Promise<InUseCounts> {
  const [itemCount, templateCount] = await Promise.all([
    countByAttribute(COLLECTIONS.items, 'categoryId', id),
    countByAttribute(COLLECTIONS.item_templates, 'categoryId', id),
  ])
  return { itemCount, templateCount }
}

export async function deleteCategory(id: string): Promise<void> {
  const usage = await getCategoryInUse(id)
  if (usage.itemCount > 0 || usage.templateCount > 0) {
    throw new InUseError({
      resource: 'category',
      itemCount: usage.itemCount,
      templateCount: usage.templateCount,
    })
  }
  return categoriesService.delete(id)
}
