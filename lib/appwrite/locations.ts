import { Query } from 'appwrite'
import { COLLECTIONS, DATABASE_ID } from '@/lib/constants'
import type { CreateLocationInput, Location, UpdateLocationInput } from '@/types/location'
import { databases } from './client'
import { createCrudService, type ListOptions } from './crud-service'
import { logAppwriteError } from './error-logging'
import { type InUseCounts, InUseError } from './in-use-error'

const locationsService = createCrudService<Location, CreateLocationInput, UpdateLocationInput>({
  collectionId: COLLECTIONS.locations,
  orderBy: 'sortOrder',
  service: 'locations',
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
        service: 'locations',
        operation: 'listDocuments',
        collectionId,
      },
      error,
    )
    throw error
  }
}

export function getLocations(options: ListOptions = {}): Promise<Location[]> {
  return locationsService.getAll(options)
}

export function getLocationById(id: string): Promise<Location> {
  return locationsService.getById(id)
}

export function createLocation(data: CreateLocationInput): Promise<Location> {
  return locationsService.create(data)
}

export function updateLocation(id: string, data: UpdateLocationInput): Promise<Location> {
  return locationsService.update(id, data)
}

export async function getLocationInUse(id: string): Promise<InUseCounts> {
  const [itemCount, templateCount] = await Promise.all([
    countByAttribute(COLLECTIONS.items, 'locationId', id),
    countByAttribute(COLLECTIONS.item_templates, 'defaultStorageLocationId', id),
  ])
  return { itemCount, templateCount }
}

export async function deleteLocation(id: string): Promise<void> {
  const usage = await getLocationInUse(id)
  if (usage.itemCount > 0 || usage.templateCount > 0) {
    throw new InUseError({
      resource: 'location',
      itemCount: usage.itemCount,
      templateCount: usage.templateCount,
    })
  }
  return locationsService.delete(id)
}
