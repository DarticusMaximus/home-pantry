import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createItem,
  deleteItem,
  getItemById,
  getItems,
  getItemsByCategory,
  getItemsByLocation,
  updateItem,
} from '@/lib/appwrite/items'
import type { CreateItemInput } from '@/types/item'

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
    items: 'items',
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

describe('items service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockItems = [
    {
      $id: '1',
      name: 'Milk',
      locationId: 'loc1',
      categoryId: 'cat1',
      quantity: 2,
      unit: 'L',
      createdAt: '',
      updatedAt: '',
      createdById: 'user1',
    },
    {
      $id: '2',
      name: 'Eggs',
      locationId: 'loc1',
      categoryId: 'cat1',
      quantity: 12,
      unit: 'each',
      createdAt: '',
      updatedAt: '',
      createdById: 'user1',
    },
  ]

  describe('getItems', () => {
    it('returns array of items', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({
        documents: mockItems,
      } as any)

      const result = await getItems()

      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        expect.any(Array),
      )
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Milk')
    })

    it('lists remaining documents without a soft-delete query', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({ documents: [] } as any)

      await getItems()

      expect(queriesHaveIsActive(mockedDatabases.listDocuments.mock.calls[0][2])).toBe(false)
    })

    it('throws on error', async () => {
      const error = new Error('Database error')
      mockedDatabases.listDocuments.mockRejectedValue(error)

      await expect(getItems()).rejects.toThrow()
    })
  })

  describe('getItemsByLocation', () => {
    it('returns items filtered by locationId', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({ documents: mockItems } as any)

      const result = await getItemsByLocation('loc1')

      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        expect.arrayContaining(['equal(locationId, loc1)']),
      )
      expect(result).toHaveLength(2)
    })

    it('does not query a soft-delete flag', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({ documents: [] } as any)

      await getItemsByLocation('loc1')

      expect(queriesHaveIsActive(mockedDatabases.listDocuments.mock.calls[0][2])).toBe(false)
    })
  })

  describe('getItemsByCategory', () => {
    it('returns items filtered by categoryId', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({ documents: mockItems } as any)

      const result = await getItemsByCategory('cat1')

      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        expect.arrayContaining(['equal(categoryId, cat1)']),
      )
      expect(result).toHaveLength(2)
    })

    it('does not query a soft-delete flag', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({ documents: [] } as any)

      await getItemsByCategory('cat1')

      expect(queriesHaveIsActive(mockedDatabases.listDocuments.mock.calls[0][2])).toBe(false)
    })
  })

  describe('getItemById', () => {
    it('returns single item', async () => {
      mockedDatabases.getDocument.mockResolvedValue(mockItems[0] as any)

      const result = await getItemById('1')

      expect(mockedDatabases.getDocument).toHaveBeenCalledWith('home_pantry', 'items', '1')
      expect(result.name).toBe('Milk')
    })

    it('throws on not found', async () => {
      mockedDatabases.getDocument.mockRejectedValue(new Error('Not found'))
      await expect(getItemById('invalid')).rejects.toThrow()
    })
  })

  describe('createItem', () => {
    it('creates item with correct data', async () => {
      const input = {
        name: 'Bread',
        locationId: 'loc2',
        quantity: 1,
        unit: 'loaf',
        createdById: 'user1',
      }
      mockedDatabases.createDocument.mockResolvedValue({ $id: '3', ...input } as any)

      const result = await createItem(input)

      expect(mockedDatabases.createDocument).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        'unique-id',
        expect.objectContaining({
          name: 'Bread',
          locationId: 'loc2',
          quantity: 1,
          unit: 'loaf',
        }),
      )
      const payload = mockedDatabases.createDocument.mock.calls[0][3]
      expect(payload).not.toHaveProperty('is' + 'Active')
      expect(result.name).toBe('Bread')
    })

    it('sets createdAt and updatedAt', async () => {
      const input = {
        name: 'Bread',
        locationId: 'loc2',
        quantity: 1,
        unit: 'loaf',
        createdById: 'user1',
      }
      mockedDatabases.createDocument.mockResolvedValue({ $id: '3', ...input } as any)

      await createItem(input)

      const callArgs = mockedDatabases.createDocument.mock.calls[0][3]
      expect(callArgs).toHaveProperty('createdAt')
      expect(callArgs).toHaveProperty('updatedAt')
      expect(callArgs).not.toHaveProperty('is' + 'Active')
    })

    it('rejects quantity 0 without creating a document', async () => {
      await expect(
        createItem({
          name: 'Ghost',
          locationId: 'loc2',
          quantity: 0,
          unit: 'each',
          createdById: 'user1',
        }),
      ).rejects.toThrow('Quantity must be greater than 0')

      expect(mockedDatabases.createDocument).not.toHaveBeenCalled()
    })

    it('rejects negative quantity without creating a document', async () => {
      await expect(
        createItem({
          name: 'Ghost',
          locationId: 'loc2',
          quantity: -1,
          unit: 'each',
          createdById: 'user1',
        }),
      ).rejects.toThrow('Quantity must be greater than 0')

      expect(mockedDatabases.createDocument).not.toHaveBeenCalled()
    })

    it('rejects empty locationId without creating a document', async () => {
      await expect(
        createItem({
          name: 'Bread',
          locationId: '',
          quantity: 1,
          unit: 'loaf',
          createdById: 'user1',
        }),
      ).rejects.toThrow('Location is required')

      expect(mockedDatabases.createDocument).not.toHaveBeenCalled()
    })

    it('rejects whitespace locationId without creating a document', async () => {
      await expect(
        createItem({
          name: 'Bread',
          locationId: '   ',
          quantity: 1,
          unit: 'loaf',
          createdById: 'user1',
        }),
      ).rejects.toThrow('Location is required')

      expect(mockedDatabases.createDocument).not.toHaveBeenCalled()
    })

    it('rejects omitted locationId without creating a document', async () => {
      await expect(
        createItem({
          name: 'Bread',
          quantity: 1,
          unit: 'loaf',
          createdById: 'user1',
        } as CreateItemInput),
      ).rejects.toThrow('Location is required')

      expect(mockedDatabases.createDocument).not.toHaveBeenCalled()
    })
  })

  describe('updateItem', () => {
    it('updates item with correct data', async () => {
      const updateData = { name: 'Oat Milk' }
      mockedDatabases.updateDocument.mockResolvedValue({ $id: '1', ...updateData } as any)

      const result = await updateItem('1', updateData)

      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        '1',
        expect.objectContaining({ name: 'Oat Milk' }),
      )
      expect(result.name).toBe('Oat Milk')
    })

    it('updates updatedAt timestamp', async () => {
      mockedDatabases.updateDocument.mockResolvedValue({ $id: '1' } as any)

      await updateItem('1', { name: 'Updated' })

      const callArgs = mockedDatabases.updateDocument.mock.calls[0][3]
      expect(callArgs).toHaveProperty('updatedAt')
    })

    it('rejects empty locationId without updating a document', async () => {
      await expect(updateItem('1', { locationId: '' })).rejects.toThrow('Location is required')

      expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
    })

    it('rejects whitespace locationId without updating a document', async () => {
      await expect(updateItem('1', { locationId: '   ' })).rejects.toThrow('Location is required')

      expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
    })

    it('rejects quantity 0 without updating a document', async () => {
      await expect(updateItem('1', { quantity: 0 })).rejects.toThrow(
        'Quantity must be greater than 0',
      )

      expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
    })

    it('rejects negative quantity without updating a document', async () => {
      await expect(updateItem('1', { quantity: -1 })).rejects.toThrow(
        'Quantity must be greater than 0',
      )

      expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
    })

    it('still updates when locationId is omitted', async () => {
      mockedDatabases.updateDocument.mockResolvedValue({ $id: '1', quantity: 2 } as any)

      await updateItem('1', { quantity: 2 })

      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        '1',
        expect.objectContaining({ quantity: 2 }),
      )
    })

    it('still updates when quantity is omitted', async () => {
      mockedDatabases.updateDocument.mockResolvedValue({ $id: '1', name: 'Oat Milk' } as any)

      await updateItem('1', { name: 'Oat Milk' })

      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        '1',
        expect.objectContaining({ name: 'Oat Milk' }),
      )
    })

    it('updates when locationId is a non-empty value', async () => {
      mockedDatabases.updateDocument.mockResolvedValue({ $id: '1', locationId: 'loc-2' } as any)

      const result = await updateItem('1', { locationId: 'loc-2' })

      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        '1',
        expect.objectContaining({ locationId: 'loc-2' }),
      )
      expect(result.locationId).toBe('loc-2')
    })
  })

  describe('deleteItem', () => {
    it('deletes the document via deleteDocument', async () => {
      mockedDatabases.deleteDocument.mockResolvedValue({} as any)

      await deleteItem('1')

      expect(mockedDatabases.deleteDocument).toHaveBeenCalledWith('home_pantry', 'items', '1')
      expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
    })

    it('throws on error', async () => {
      mockedDatabases.deleteDocument.mockRejectedValue(new Error('Delete failed'))

      await expect(deleteItem('1')).rejects.toThrow()
    })
  })
})
