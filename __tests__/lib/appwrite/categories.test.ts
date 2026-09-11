import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  getCategoryInUse,
  updateCategory,
} from '@/lib/appwrite/categories'
import { InUseError } from '@/lib/appwrite/in-use-error'

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
    categories: 'categories',
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

describe('categories service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCategories', () => {
    it('returns array of categories', async () => {
      const mockCategories = [
        {
          $id: '1',
          name: 'Meat',
          sortOrder: 1,
          color: '#ef4444',
          createdAt: '',
          updatedAt: '',
        },
        {
          $id: '2',
          name: 'Dairy',
          sortOrder: 2,
          color: '#f97316',
          createdAt: '',
          updatedAt: '',
        },
      ]
      mockedDatabases.listDocuments.mockResolvedValue({
        documents: mockCategories,
      } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>)

      const result = await getCategories()

      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'categories',
        expect.arrayContaining([]),
      )
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Meat')
    })

    it('lists remaining documents without a soft-delete query', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({
        documents: [],
      } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>)

      await getCategories()

      const calls = mockedDatabases.listDocuments.mock.calls
      expect(queriesHaveIsActive(calls[0][2])).toBe(false)
      expect(calls[0][2]).toContain('limit(2000)')
    })

    it('supports custom pagination options', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({
        documents: [],
      } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>)

      await getCategories({ limit: 25, offset: 50 })

      const calls = mockedDatabases.listDocuments.mock.calls
      expect(calls[0][2]).toContain('limit(25)')
      expect(calls[0][2]).toContain('offset(50)')
      expect(queriesHaveIsActive(calls[0][2])).toBe(false)
    })

    it('throws error on failure', async () => {
      mockedDatabases.listDocuments.mockRejectedValue(new Error('Network error'))

      await expect(getCategories()).rejects.toThrow()
    })
  })

  describe('getCategoryById', () => {
    it('returns single category by id', async () => {
      const mockCategory = {
        $id: '1',
        name: 'Meat',
        sortOrder: 1,
        color: '#ef4444',
        createdAt: '',
        updatedAt: '',
      }
      mockedDatabases.getDocument.mockResolvedValue(
        mockCategory as unknown as Awaited<ReturnType<typeof databases.getDocument>>,
      )

      const result = await getCategoryById('1')

      expect(mockedDatabases.getDocument).toHaveBeenCalledWith('home_pantry', 'categories', '1')
      expect(result.name).toBe('Meat')
    })

    it('throws error when category not found', async () => {
      mockedDatabases.getDocument.mockRejectedValue(new Error('Not found'))

      await expect(getCategoryById('invalid')).rejects.toThrow()
    })
  })

  describe('createCategory', () => {
    it('creates a new category with correct data', async () => {
      const input = {
        name: 'Snacks',
        sortOrder: 1,
        color: '#ff0000',
      }
      const mockCreated = {
        $id: 'new-id',
        ...input,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      mockedDatabases.createDocument.mockResolvedValue(
        mockCreated as unknown as Awaited<ReturnType<typeof databases.createDocument>>,
      )

      const result = await createCategory(input)

      expect(mockedDatabases.createDocument).toHaveBeenCalledWith(
        'home_pantry',
        'categories',
        'unique-id',
        expect.objectContaining({
          name: 'Snacks',
          sortOrder: 1,
          color: '#ff0000',
        }),
      )
      expect(mockedDatabases.createDocument.mock.calls[0][3]).not.toHaveProperty('is' + 'Active')
      expect(result.name).toBe('Snacks')
    })

    it('does not write a soft-delete flag on create', async () => {
      mockedDatabases.createDocument.mockResolvedValue({
        $id: 'new-id',
        name: 'Test',
        sortOrder: 0,
      } as unknown as Awaited<ReturnType<typeof databases.createDocument>>)

      await createCategory({ name: 'Test', sortOrder: 0 })

      expect(mockedDatabases.createDocument.mock.calls[0][3]).not.toHaveProperty('is' + 'Active')
    })
  })

  describe('updateCategory', () => {
    it('updates category with correct data', async () => {
      const updateData = { name: 'Updated Meat', color: '#ff0000' }
      const mockUpdated = {
        $id: '1',
        ...updateData,
        sortOrder: 1,
        updatedAt: '2024-01-02T00:00:00.000Z',
      }
      mockedDatabases.updateDocument.mockResolvedValue(
        mockUpdated as unknown as Awaited<ReturnType<typeof databases.updateDocument>>,
      )

      const result = await updateCategory('1', updateData)

      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'categories',
        '1',
        expect.objectContaining({
          name: 'Updated Meat',
          color: '#ff0000',
          updatedAt: expect.any(String),
        }),
      )
      expect(result.name).toBe('Updated Meat')
    })
  })

  describe('getCategoryInUse', () => {
    it('returns item and template counts without deleting', async () => {
      mockedDatabases.listDocuments.mockImplementation(async (_db, collectionId) => {
        if (collectionId === 'items') {
          return {
            documents: [{ $id: 'item-1' }],
            total: 5,
          } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>
        }
        return {
          documents: [{ $id: 'tpl-1' }],
          total: 1,
        } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>
      })

      const result = await getCategoryInUse('cat-1')

      expect(result).toEqual({ itemCount: 5, templateCount: 1 })
      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        expect.arrayContaining(['equal(categoryId, cat-1)']),
      )
      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        expect.arrayContaining(['equal(categoryId, cat-1)']),
      )
      expect(mockedDatabases.deleteDocument).not.toHaveBeenCalled()
    })
  })

  describe('deleteCategory', () => {
    it('deletes the document via deleteDocument when unused', async () => {
      mockInUseTotals(0, 0)
      mockedDatabases.deleteDocument.mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof databases.deleteDocument>>,
      )

      await deleteCategory('1')

      expect(mockedDatabases.deleteDocument).toHaveBeenCalledWith('home_pantry', 'categories', '1')
      expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
    })

    it('throws InUseError and does not delete when items still use the category', async () => {
      mockInUseTotals(2, 0)

      await expect(deleteCategory('cat-1')).rejects.toMatchObject({
        name: 'InUseError',
        resource: 'category',
        itemCount: 2,
        templateCount: 0,
      })
      expect(mockedDatabases.deleteDocument).not.toHaveBeenCalled()
    })

    it('throws InUseError and does not delete when templates still use the category', async () => {
      mockInUseTotals(0, 3)

      await expect(deleteCategory('cat-1')).rejects.toBeInstanceOf(InUseError)
      expect(mockedDatabases.deleteDocument).not.toHaveBeenCalled()
    })

    it('throws InUseError with both counts when items and templates still use the category', async () => {
      mockInUseTotals(4, 1)

      try {
        await deleteCategory('cat-1')
        expect.unreachable()
      } catch (error) {
        expect(error).toBeInstanceOf(InUseError)
        expect(error).toMatchObject({
          resource: 'category',
          itemCount: 4,
          templateCount: 1,
        })
      }
      expect(mockedDatabases.deleteDocument).not.toHaveBeenCalled()
    })

    it('throws error on failure', async () => {
      mockInUseTotals(0, 0)
      mockedDatabases.deleteDocument.mockRejectedValue(new Error('Delete failed'))

      await expect(deleteCategory('1')).rejects.toThrow()
    })
  })
})
