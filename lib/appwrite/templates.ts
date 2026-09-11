import { Query } from 'appwrite'
import { COLLECTIONS, DATABASE_ID } from '@/lib/constants'
import type { CreateTemplateInput, ItemTemplate, UpdateTemplateInput } from '@/types/template'
import { databases } from './client'
import {
  createCrudService,
  DEFAULT_LIST_LIMIT,
  type ListOptions,
  transformDocuments,
} from './crud-service'
import { logAppwriteError } from './error-logging'

const templatesService = createCrudService<ItemTemplate, CreateTemplateInput, UpdateTemplateInput>({
  collectionId: COLLECTIONS.item_templates,
  orderBy: 'name',
  service: 'templates',
})

export function getTemplates(options: ListOptions = {}): Promise<ItemTemplate[]> {
  return templatesService.getAll(options)
}

export function getTemplateById(id: string): Promise<ItemTemplate> {
  return templatesService.getById(id)
}

export async function searchTemplates(query: string): Promise<ItemTemplate[]> {
  try {
    const queries = [
      Query.search('name', query),
      Query.orderAsc('name'),
      Query.limit(DEFAULT_LIST_LIMIT),
    ]

    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.item_templates, queries)
    return transformDocuments(response.documents as { $id: string }[])
  } catch (error) {
    logAppwriteError(
      {
        service: 'templates',
        operation: 'searchTemplates',
        collectionId: COLLECTIONS.item_templates,
      },
      error,
    )
    throw error
  }
}

export async function getTemplatesByCategory(categoryId: string): Promise<ItemTemplate[]> {
  try {
    const queries = [
      Query.equal('categoryId', categoryId),
      Query.orderAsc('name'),
      Query.limit(DEFAULT_LIST_LIMIT),
    ]

    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.item_templates, queries)
    return transformDocuments(response.documents as { $id: string }[])
  } catch (error) {
    logAppwriteError(
      {
        service: 'templates',
        operation: 'getTemplatesByCategory',
        collectionId: COLLECTIONS.item_templates,
      },
      error,
    )
    throw error
  }
}

export function createTemplate(data: CreateTemplateInput): Promise<ItemTemplate> {
  if (data.defaultQuantity <= 0) {
    return Promise.reject(new Error('Quantity must be greater than 0'))
  }
  return templatesService.create(data)
}

export function updateTemplate(id: string, data: UpdateTemplateInput): Promise<ItemTemplate> {
  if (
    'defaultQuantity' in data &&
    data.defaultQuantity !== undefined &&
    data.defaultQuantity <= 0
  ) {
    return Promise.reject(new Error('Quantity must be greater than 0'))
  }
  return templatesService.update(id, data)
}

export async function deleteTemplate(id: string): Promise<void> {
  try {
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.items, [
      Query.equal('templateId', id),
      Query.limit(DEFAULT_LIST_LIMIT),
    ])
    for (const doc of response.documents) {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.items, doc.$id, {
        templateId: '',
        updatedAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    logAppwriteError(
      {
        service: 'templates',
        operation: 'unlinkTemplateItems',
        collectionId: COLLECTIONS.items,
      },
      error,
    )
    throw error
  }

  return templatesService.delete(id)
}
