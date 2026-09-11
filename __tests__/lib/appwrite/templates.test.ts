import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  getTemplates,
  getTemplatesByCategory,
  searchTemplates,
  updateTemplate,
} from '@/lib/appwrite/templates'

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
    item_templates: 'item_templates',
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
    search: vi.fn((attr: string, val: string) => `search(${attr}, ${val})`),
  },
}))

import { databases } from '@/lib/appwrite/client'

const mockedDatabases = vi.mocked(databases)

function queriesHaveIsActive(queries: unknown): boolean {
  return (queries as string[]).some((query) => String(query).includes('is' + 'Active'))
}

describe('templates service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockTemplates = [
    {
      $id: '1',
      name: 'Milk',
      categoryId: 'cat1',
      defaultUnit: 'L',
      defaultQuantity: 1,
      createdAt: '',
      updatedAt: '',
    },
    {
      $id: '2',
      name: 'Eggs',
      categoryId: 'cat1',
      defaultUnit: 'pk',
      defaultQuantity: 1,
      createdAt: '',
      updatedAt: '',
    },
  ]

  describe('getTemplates', () => {
    it('returns array of templates', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({
        documents: mockTemplates,
      } as any)

      const result = await getTemplates()

      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        expect.any(Array),
      )
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Milk')
    })

    it('lists remaining documents without a soft-delete query', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({ documents: [] } as any)

      await getTemplates()

      expect(queriesHaveIsActive(mockedDatabases.listDocuments.mock.calls[0][2])).toBe(false)
    })
  })

  describe('getTemplateById', () => {
    it('returns single template', async () => {
      mockedDatabases.getDocument.mockResolvedValue(mockTemplates[0] as any)

      const result = await getTemplateById('1')

      expect(mockedDatabases.getDocument).toHaveBeenCalledWith('home_pantry', 'item_templates', '1')
      expect(result.name).toBe('Milk')
    })

    it('throws on not found', async () => {
      mockedDatabases.getDocument.mockRejectedValue(new Error('Not found'))
      await expect(getTemplateById('invalid')).rejects.toThrow()
    })
  })

  describe('searchTemplates', () => {
    it('returns matching templates and limits results', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({ documents: [mockTemplates[0]] } as any)

      const result = await searchTemplates('milk')

      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        expect.arrayContaining(['search(name, milk)', 'limit(2000)']),
      )
      expect(queriesHaveIsActive(mockedDatabases.listDocuments.mock.calls[0][2])).toBe(false)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Milk')
    })
  })

  describe('getTemplatesByCategory', () => {
    it('returns filtered templates', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({ documents: mockTemplates } as any)

      const result = await getTemplatesByCategory('cat1')

      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        expect.arrayContaining(['equal(categoryId, cat1)']),
      )
      expect(queriesHaveIsActive(mockedDatabases.listDocuments.mock.calls[0][2])).toBe(false)
      expect(result).toHaveLength(2)
    })
  })

  describe('createTemplate', () => {
    it('creates template and returns it', async () => {
      const input = {
        name: 'Bread',
        categoryId: 'cat2',
        defaultUnit: 'loaf',
        defaultQuantity: 1,
      }
      mockedDatabases.createDocument.mockResolvedValue({ $id: '3', ...input } as any)

      const result = await createTemplate(input as any)

      expect(mockedDatabases.createDocument).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        'unique-id',
        expect.objectContaining({ name: 'Bread' }),
      )
      expect(mockedDatabases.createDocument.mock.calls[0][3]).not.toHaveProperty('is' + 'Active')
      expect(result.name).toBe('Bread')
    })

    it('rejects defaultQuantity 0 without creating a document', async () => {
      await expect(
        createTemplate({
          name: 'Ghost',
          defaultUnit: 'each',
          defaultQuantity: 0,
        }),
      ).rejects.toThrow('Quantity must be greater than 0')

      expect(mockedDatabases.createDocument).not.toHaveBeenCalled()
    })

    it('rejects negative defaultQuantity without creating a document', async () => {
      await expect(
        createTemplate({
          name: 'Ghost',
          defaultUnit: 'each',
          defaultQuantity: -1,
        }),
      ).rejects.toThrow('Quantity must be greater than 0')

      expect(mockedDatabases.createDocument).not.toHaveBeenCalled()
    })
  })

  describe('updateTemplate', () => {
    it('updates template and returns it', async () => {
      const updateData = { name: 'Oat Milk' }
      mockedDatabases.updateDocument.mockResolvedValue({ $id: '1', ...updateData } as any)

      const result = await updateTemplate('1', updateData)

      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        '1',
        expect.objectContaining({ name: 'Oat Milk' }),
      )
      expect(result.name).toBe('Oat Milk')
    })

    it('rejects defaultQuantity 0 without updating a document', async () => {
      await expect(updateTemplate('1', { defaultQuantity: 0 })).rejects.toThrow(
        'Quantity must be greater than 0',
      )

      expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
    })

    it('rejects negative defaultQuantity without updating a document', async () => {
      await expect(updateTemplate('1', { defaultQuantity: -1 })).rejects.toThrow(
        'Quantity must be greater than 0',
      )

      expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
    })

    it('still updates when defaultQuantity is omitted', async () => {
      mockedDatabases.updateDocument.mockResolvedValue({ $id: '1', name: 'Oat Milk' } as any)

      await updateTemplate('1', { name: 'Oat Milk' })

      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        '1',
        expect.objectContaining({ name: 'Oat Milk' }),
      )
    })

    it('updates when defaultQuantity is a positive value', async () => {
      mockedDatabases.updateDocument.mockResolvedValue({ $id: '1', defaultQuantity: 2 } as any)

      const result = await updateTemplate('1', { defaultQuantity: 2 })

      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        '1',
        expect.objectContaining({ defaultQuantity: 2 }),
      )
      expect(result.defaultQuantity).toBe(2)
    })
  })

  describe('deleteTemplate', () => {
    it('deletes the document via deleteDocument when no items reference it', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({ documents: [], total: 0 } as any)
      mockedDatabases.deleteDocument.mockResolvedValue({} as any)

      await deleteTemplate('1')

      expect(mockedDatabases.deleteDocument).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        '1',
      )
      expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
    })

    it('clears templateId on matching items then deletes the template, leaving items', async () => {
      mockedDatabases.listDocuments.mockResolvedValue({
        documents: [
          { $id: 'item-1', name: 'Milk', templateId: '1' },
          { $id: 'item-2', name: 'Eggs', templateId: '1' },
        ],
        total: 2,
      } as any)
      mockedDatabases.updateDocument.mockResolvedValue({} as any)
      mockedDatabases.deleteDocument.mockResolvedValue({} as any)

      await deleteTemplate('1')

      expect(mockedDatabases.listDocuments).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        expect.arrayContaining(['equal(templateId, 1)']),
      )
      expect(mockedDatabases.updateDocument).toHaveBeenCalledTimes(2)
      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        'item-1',
        expect.objectContaining({ templateId: '' }),
      )
      expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
        'home_pantry',
        'items',
        'item-2',
        expect.objectContaining({ templateId: '' }),
      )
      expect(mockedDatabases.deleteDocument).toHaveBeenCalledWith(
        'home_pantry',
        'item_templates',
        '1',
      )
      expect(mockedDatabases.deleteDocument).not.toHaveBeenCalledWith(
        'home_pantry',
        'items',
        expect.anything(),
      )
      const updateOrder = mockedDatabases.updateDocument.mock.invocationCallOrder[0]
      const deleteOrder = mockedDatabases.deleteDocument.mock.invocationCallOrder[0]
      expect(updateOrder).toBeLessThan(deleteOrder)
    })
  })
})
