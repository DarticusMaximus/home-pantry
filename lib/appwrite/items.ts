import { Query } from 'appwrite'
import { COLLECTIONS, DATABASE_ID } from '@/lib/constants'
import type { CreateItemInput, Item, UpdateItemInput } from '@/types/item'
import { databases } from './client'
import {
  createCrudService,
  DEFAULT_LIST_LIMIT,
  type ListOptions,
  transformDocuments,
} from './crud-service'
import { logAppwriteError } from './error-logging'

const itemsService = createCrudService<Item, CreateItemInput, UpdateItemInput>({
  collectionId: COLLECTIONS.items,
  orderBy: 'name',
  service: 'items',
})

export function getItems(options: ListOptions = {}): Promise<Item[]> {
  return itemsService.getAll(options)
}

export function getItemById(id: string): Promise<Item> {
  return itemsService.getById(id)
}

export async function getItemsByLocation(locationId: string): Promise<Item[]> {
  try {
    const queries = [
      Query.equal('locationId', locationId),
      Query.orderAsc('name'),
      Query.limit(DEFAULT_LIST_LIMIT),
    ]

    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.items, queries)
    return transformDocuments(response.documents as { $id: string }[])
  } catch (error) {
    logAppwriteError(
      {
        service: 'items',
        operation: 'getItemsByLocation',
        collectionId: COLLECTIONS.items,
      },
      error,
    )
    throw error
  }
}

export async function getItemsByCategory(categoryId: string): Promise<Item[]> {
  try {
    const queries = [
      Query.equal('categoryId', categoryId),
      Query.orderAsc('name'),
      Query.limit(DEFAULT_LIST_LIMIT),
    ]

    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.items, queries)
    return transformDocuments(response.documents as { $id: string }[])
  } catch (error) {
    logAppwriteError(
      {
        service: 'items',
        operation: 'getItemsByCategory',
        collectionId: COLLECTIONS.items,
      },
      error,
    )
    throw error
  }
}

export function createItem(data: CreateItemInput): Promise<Item> {
  if (data.quantity <= 0) {
    return Promise.reject(new Error('Quantity must be greater than 0'))
  }
  if (!data.locationId?.trim()) {
    return Promise.reject(new Error('Location is required'))
  }
  return itemsService.create(data)
}

export function updateItem(id: string, data: UpdateItemInput): Promise<Item> {
  if ('quantity' in data && data.quantity !== undefined && data.quantity <= 0) {
    return Promise.reject(new Error('Quantity must be greater than 0'))
  }
  if ('locationId' in data && !data.locationId?.trim()) {
    return Promise.reject(new Error('Location is required'))
  }
  return itemsService.update(id, data)
}

export function deleteItem(id: string): Promise<void> {
  return itemsService.delete(id)
}
