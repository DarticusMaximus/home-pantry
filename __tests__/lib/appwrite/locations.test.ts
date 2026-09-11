import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InUseError } from '@/lib/appwrite/in-use-error'
import {
  createLocation,
  deleteLocation,
  getLocationById,
  getLocationInUse,
  getLocations,
  updateLocation,
} from '@/lib/appwrite/locations'

vi.mock('@/lib/appwrite/client', () => ({
  databases: {
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
}))

vi.mock('@/lib/constants', () => ({
  DATABASE_ID: 'home_pantry',
  COLLECTIONS: {
    locations: 'locations',
    items: 'items',
    item_templates: 'item_templates',
  },
}))

vi.mock('appwrite', () => ({
  ID: {
    unique: () => 'unique-id',
  },
  Query: {
    orderAsc: vi.fn((attr: string) => `orderAsc(${attr})`),
    limit: vi.fn((value: number) => `limit(${value})`),
    offset: vi.fn((value: number) => `offset(${value})`),
    equal: vi.fn((attr: string, val: unknown) => `equal(${attr}, ${val})`),
  },
}))

import { databases } from '@/lib/appwrite/client'

const mockedDatabases = vi.mocked(databases)

function queriesHaveIsActive(queries: unknown): boolean {
  return (queries as string[]).some((query) => String(query).includes('is' + 'Active'))
}

function mockInUseTotals(itemTotal: number, templateTotal: number) {
  mockedDatabases.listDocuments.mockImplementation(async (_db, collectionId) => {
    const total =
      collectionId === 'items' ? itemTotal : collectionId === 'item_templates' ? templateTotal : 0
    return {
      documents: [],
      total,
    } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>
  })
}

describe('locations service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getLocations', () => {
    it('returns array of locations', async () => {
      const mockLocations = [
        {
          $id: '1',
          name: 'Fridge',
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        },
        {
          $id: '2',
          name: 'Freezer',
          sortOrder: 2,
          createdAt: '',
          updatedAt: '',
        },
      ]
      mockedDatabases.listDocuments.mockResolvedValue({
        documents: mockLocations,
      } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>)

      const result = await getLocations()

      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'locations',
        expect.arrayContaining([]),
      )
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Fridge')
    })

    it('lists remaining documents without a soft-delete query', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({
        documents: [],
      } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>)

      await getLocations()

      const calls = mockedDatabases.listDocuments.mock.calls
      expect(queriesHaveIsActive(calls[0][2])).toBe(false)
      expect(calls[0][2]).toContain('limit(2000)')
    })

    it('supports custom pagination options', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({
        documents: [],
      } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>)

      await getLocations({ limit: 25, offset: 50 })

      const calls = mockedDatabases.listDocuments.mock.calls
      expect(calls[0][2]).toContain('limit(25)')
      expect(calls[0][2]).toContain('offset(50)')
      expect(queriesHaveIsActive(calls[0][2])).toBe(false)
    })

    it('throws error on failure', async () => {
      mockedDatabases.listDocuments.mockRejectedValue(new Error('Network error'))

      await expect(getLocations()).rejects.toThrow()
    })
  })

  describe('getLocationById', () => {
    it('returns single location by id', async () => {
      const mockLocation = {
        $id: '1',
        name: 'Fridge',
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      }
      mockedDatabases.getDocument.mockResolvedValue(
        mockLocation as unknown as Awaited<ReturnType<typeof databases.getDocument>>,
      )

      const result = await getLocationById('1')

      expect(mockedDatabases.getDocument).toHaveBeenCalledWith('home_pantry', 'locations', '1')
      expect(result.name).toBe('Fridge')
    })

    it('throws error when location not found', async () => {
      mockedDatabases.getDocument.mockRejectedValue(new Error('Not found'))

      await expect(getLocationById('invalid')).rejects.toThrow()
    })
  })

  describe('createLocation', () => {
    it('creates a new location with correct data', async () => {
      const input = { name: 'New Fridge', sortOrder: 1 }
      const mockCreated = {
        $id: 'new-id',
        ...input,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      mockedDatabases.createDocument.mockResolvedValue(
        mockCreated as unknown as Awaited<ReturnType<typeof databases.createDocument>>,
      )

      const result = await createLocation(input)

      expect(mockedDatabases.createDocument).toHaveBeenCalledWith(
        'home_pantry',
        'locations',
        'unique-id',
        expect.objectContaining({
          name: 'New Fridge',
          sortOrder: 1,
        }),
      )
      expect(mockedDatabases.createDocument.mock.calls[0][3]).not.toHaveProperty('is' + 'Active')
      expect(result.name).toBe('New Fridge')
    })

    it('does not write a soft-delete flag on create', async () => {
      mockedDatabases.createDocument.mockResolvedValue({
        $id: 'new-id',
        name: 'Test',
        sortOrder: 0,
      } as unknown as Awaited<ReturnType<typeof databases.createDocument>>)

      await createLocation({ name: 'Test', sortOrder: 0 })

      expect(mockedDatabases.createDocument.mock.calls[0][3]).not.toHaveProperty('is' + 'Active')
    })
  })

  describe('updateLocation', () => {
    it('updates location with correct data', async () => {
      const updateData = { name: 'Updated Fridge' }
      const mockUpdated = {
        $id: '1',
        ...updateData,
        sortOrder: 1,
        updatedAt: '2024-01-02T00:00:00.000Z',
      }
      mockedDatabases.updateDocument.mockResolvedValue(
        mockUpdated as unknown as Awaited<ReturnType<typeof databases.updateDocument>>,
      )

      const result = await updateLocation('1', updateData)

      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'locations',
        '1',
        expect.objectContaining({
          name: 'Updated Fridge',
          updatedAt: expect.any(String),
        }),
      )
      expect(result.name).toBe('Updated Fridge')
    })
  })

  describe('getLocationInUse', () => {
    it('returns item and template counts without deleting', async () => {
      mockedDatabases.listDocuments.mockImplementation(async (_db, collectionId) => {
        if (collectionId === 'items') {
          return {
            documents: [{ $id: 'item-1' }],
            total: 4,
          } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>
        }
        return {
          documents: [{ $id: 'tpl-1' }],
          total: 2,
        } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>
      })

      const result = await getLocationInUse('loc-1')

      expect(result).toEqual({ itemCount: 4, templateCount: 2 })
      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        expect.arrayContaining(['equal(locationId, loc-1)']),
      )
      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        expect.arrayContaining(['equal(defaultStorageLocationId, loc-1)']),
      )
      expect(mockedDatabases.deleteDocument).not.toHaveBeenCalled()
    })
  })

  describe('deleteLocation', () => {
    it('deletes the document via deleteDocument when unused', async () => {
      mockInUseTotals(0, 0)
      mockedDatabases.deleteDocument.mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof databases.deleteDocument>>,
      )

      await deleteLocation('1')

      expect(mockedDatabases.deleteDocument).toHaveBeenCalledWith('home_pantry', 'locations', '1')
      expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
    })

    it('throws InUseError and does not delete when items still use the location', async () => {
      mockInUseTotals(3, 0)

      await expect(deleteLocation('loc-1')).rejects.toMatchObject({
        name: 'InUseError',
        resource: 'location',
        itemCount: 3,
        templateCount: 0,
      })
      await expect(deleteLocation('loc-1')).rejects.toBeInstanceOf(InUseError)
      expect(mockedDatabases.deleteDocument).not.toHaveBeenCalled()
    })

    it('throws InUseError and does not delete when templates still use the location', async () => {
      mockInUseTotals(0, 2)

      await expect(deleteLocation('loc-1')).rejects.toBeInstanceOf(InUseError)
      expect(mockedDatabases.deleteDocument).not.toHaveBeenCalled()
    })

    it('throws InUseError with both counts when items and templates still use the location', async () => {
      mockInUseTotals(1, 2)

      try {
        await deleteLocation('loc-1')
        expect.unreachable()
      } catch (error) {
        expect(error).toBeInstanceOf(InUseError)
        expect(error).toMatchObject({
          resource: 'location',
          itemCount: 1,
          templateCount: 2,
        })
      }
      expect(mockedDatabases.deleteDocument).not.toHaveBeenCalled()
    })

    it('throws error on failure', async () => {
      mockInUseTotals(0, 0)
      mockedDatabases.deleteDocument.mockRejectedValue(new Error('Delete failed'))

      await expect(deleteLocation('1')).rejects.toThrow()
    })
  })
})
