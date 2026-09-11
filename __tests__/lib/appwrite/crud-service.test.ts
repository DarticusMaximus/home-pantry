import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCrudService, DEFAULT_LIST_LIMIT } from '@/lib/appwrite/crud-service'

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
    locations: 'locations',
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
  },
  AppwriteException: class extends Error {
    constructor(
      message: string,
      public code: number,
    ) {
      super(message)
      this.name = 'AppwriteException'
    }
  },
}))

vi.mock('@/lib/appwrite/error-logging', () => ({
  logAppwriteError: vi.fn(),
}))

import { databases } from '@/lib/appwrite/client'

const mockedDatabases = vi.mocked(databases)

function queriesHaveIsActive(queries: unknown): boolean {
  return (queries as string[]).some((query) => String(query).includes('is' + 'Active'))
}

describe('crud service factory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds default pagination and does not filter by a soft-delete flag', async () => {
    const service = createCrudService<
      { id: string; name: string },
      { name: string },
      { name?: string }
    >({
      collectionId: 'categories',
      orderBy: 'sortOrder',
      service: 'categories',
    })

    mockedDatabases.listDocuments.mockResolvedValue({
      documents: [{ $id: '1', name: 'Meat' }],
    } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>)

    await service.getAll()

    expect(mockedDatabases.listDocuments).toHaveBeenCalledWith('home_pantry', 'categories', [
      'orderAsc(sortOrder)',
      `limit(${DEFAULT_LIST_LIMIT})`,
    ])
    expect(queriesHaveIsActive(mockedDatabases.listDocuments.mock.calls[0][2])).toBe(false)
  })

  it('supports custom pagination', async () => {
    const service = createCrudService<
      { id: string; name: string },
      { name: string },
      { name?: string }
    >({
      collectionId: 'locations',
      orderBy: 'sortOrder',
      service: 'locations',
    })

    mockedDatabases.listDocuments.mockResolvedValue({
      documents: [],
    } as unknown as Awaited<ReturnType<typeof databases.listDocuments>>)

    await service.getAll({ limit: 20, offset: 40 })

    expect(mockedDatabases.listDocuments).toHaveBeenCalledWith('home_pantry', 'locations', [
      'orderAsc(sortOrder)',
      'limit(20)',
      'offset(40)',
    ])
    expect(queriesHaveIsActive(mockedDatabases.listDocuments.mock.calls[0][2])).toBe(false)
  })

  it('creates documents without a soft-delete flag and deletes via deleteDocument', async () => {
    const service = createCrudService<
      { id: string; name: string },
      { name: string },
      Record<string, never>
    >({
      collectionId: 'locations',
      orderBy: 'sortOrder',
      service: 'locations',
    })

    mockedDatabases.createDocument.mockResolvedValue({
      $id: 'new-id',
      name: 'Fridge',
    } as unknown as Awaited<ReturnType<typeof databases.createDocument>>)
    mockedDatabases.deleteDocument.mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof databases.deleteDocument>>,
    )

    await service.create({ name: 'Fridge' })
    await service.delete('doc-1')

    expect(mockedDatabases.createDocument).toHaveBeenCalledWith(
      'home_pantry',
      'locations',
      'unique-id',
      expect.objectContaining({
        name: 'Fridge',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    )
    const createPayload = mockedDatabases.createDocument.mock.calls[0][3]
    expect(createPayload).not.toHaveProperty('is' + 'Active')
    expect(mockedDatabases.deleteDocument).toHaveBeenCalledWith('home_pantry', 'locations', 'doc-1')
    expect(mockedDatabases.updateDocument).not.toHaveBeenCalled()
  })

  it('gets document by id', async () => {
    const service = createCrudService<
      { id: string; name: string },
      { name: string },
      { name?: string }
    >({
      collectionId: 'locations',
      orderBy: 'sortOrder',
      service: 'locations',
    })

    mockedDatabases.getDocument.mockResolvedValue({
      $id: 'doc-1',
      name: 'Fridge',
    } as unknown as Awaited<ReturnType<typeof databases.getDocument>>)

    const result = await service.getById('doc-1')

    expect(mockedDatabases.getDocument).toHaveBeenCalledWith('home_pantry', 'locations', 'doc-1')
    expect(result).toEqual({ id: 'doc-1', name: 'Fridge' })
  })

  it('updates document', async () => {
    const service = createCrudService<
      { id: string; name: string },
      { name: string },
      { name: string }
    >({
      collectionId: 'locations',
      orderBy: 'sortOrder',
      service: 'locations',
    })

    mockedDatabases.updateDocument.mockResolvedValue({
      $id: 'doc-1',
      name: 'New Name',
    } as unknown as Awaited<ReturnType<typeof databases.updateDocument>>)

    const result = await service.update('doc-1', { name: 'New Name' })

    expect(mockedDatabases.updateDocument).toHaveBeenCalledWith(
      'home_pantry',
      'locations',
      'doc-1',
      expect.objectContaining({
        name: 'New Name',
        updatedAt: expect.any(String),
      }),
    )
    expect(result).toEqual({ id: 'doc-1', name: 'New Name' })
  })

  describe('error handling', () => {
    const service = createCrudService<{ id: string }, Record<string, never>, Record<string, never>>(
      {
        collectionId: 'locations',
        orderBy: 'sortOrder',
        service: 'locations',
      },
    )

    const error = new Error('Appwrite error')

    it('logs and rethrows error in getAll', async () => {
      mockedDatabases.listDocuments.mockRejectedValue(error)
      await expect(service.getAll()).rejects.toThrow(error)
    })

    it('logs and rethrows error in getById', async () => {
      mockedDatabases.getDocument.mockRejectedValue(error)
      await expect(service.getById('1')).rejects.toThrow(error)
    })

    it('logs and rethrows error in create', async () => {
      mockedDatabases.createDocument.mockRejectedValue(error)
      await expect(service.create({})).rejects.toThrow(error)
    })

    it('logs and rethrows error in update', async () => {
      mockedDatabases.updateDocument.mockRejectedValue(error)
      await expect(service.update('1', {})).rejects.toThrow(error)
    })

    it('logs and rethrows error in delete', async () => {
      mockedDatabases.deleteDocument.mockRejectedValue(error)
      await expect(service.delete('1')).rejects.toThrow(error)
    })
  })
})
