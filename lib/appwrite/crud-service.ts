import { ID, Query } from 'appwrite'
import { DATABASE_ID } from '@/lib/constants'
import { databases } from './client'
import { logAppwriteError } from './error-logging'

export const DEFAULT_LIST_LIMIT = 2000

export interface ListOptions {
  limit?: number
  offset?: number
}

interface AppwriteDocument {
  $id: string
  [key: string]: unknown
}

function transformDocument<T extends { id: string }>(doc: AppwriteDocument): T {
  const { $id, ...rest } = doc
  return { id: $id, ...rest } as T
}

export function transformDocuments<T extends { id: string }>(docs: AppwriteDocument[]): T[] {
  return docs.map((doc) => transformDocument<T>(doc))
}

interface CrudServiceConfig {
  collectionId: string
  orderBy: string
  service: string
}

export function createCrudService<
  TDocument extends { id: string },
  TCreateInput extends object,
  TUpdateInput extends object,
>(config: CrudServiceConfig) {
  const getAll = async (options: ListOptions = {}): Promise<TDocument[]> => {
    try {
      const queries = [
        Query.orderAsc(config.orderBy),
        Query.limit(options.limit ?? DEFAULT_LIST_LIMIT),
      ]

      if (typeof options.offset === 'number') {
        queries.push(Query.offset(options.offset))
      }

      const response = await databases.listDocuments(DATABASE_ID, config.collectionId, queries)
      return transformDocuments<TDocument>(response.documents as AppwriteDocument[])
    } catch (error) {
      logAppwriteError(
        {
          service: config.service,
          operation: 'listDocuments',
          collectionId: config.collectionId,
        },
        error,
      )
      throw error
    }
  }

  const getById = async (id: string): Promise<TDocument> => {
    try {
      const response = await databases.getDocument(DATABASE_ID, config.collectionId, id)
      return transformDocument<TDocument>(response as AppwriteDocument)
    } catch (error) {
      logAppwriteError(
        {
          service: config.service,
          operation: 'getDocument',
          collectionId: config.collectionId,
          documentId: id,
        },
        error,
      )
      throw error
    }
  }

  const create = async (data: TCreateInput): Promise<TDocument> => {
    try {
      const now = new Date().toISOString()
      const response = await databases.createDocument(
        DATABASE_ID,
        config.collectionId,
        ID.unique(),
        {
          ...data,
          createdAt: now,
          updatedAt: now,
        },
      )
      return transformDocument<TDocument>(response as AppwriteDocument)
    } catch (error) {
      logAppwriteError(
        {
          service: config.service,
          operation: 'createDocument',
          collectionId: config.collectionId,
        },
        error,
      )
      throw error
    }
  }

  const update = async (id: string, data: TUpdateInput): Promise<TDocument> => {
    try {
      const response = await databases.updateDocument(DATABASE_ID, config.collectionId, id, {
        ...data,
        updatedAt: new Date().toISOString(),
      })
      return transformDocument<TDocument>(response as AppwriteDocument)
    } catch (error) {
      logAppwriteError(
        {
          service: config.service,
          operation: 'updateDocument',
          collectionId: config.collectionId,
          documentId: id,
        },
        error,
      )
      throw error
    }
  }

  const deleteById = async (id: string): Promise<void> => {
    try {
      await databases.deleteDocument(DATABASE_ID, config.collectionId, id)
    } catch (error) {
      logAppwriteError(
        {
          service: config.service,
          operation: 'deleteDocument',
          collectionId: config.collectionId,
          documentId: id,
        },
        error,
      )
      throw error
    }
  }

  return {
    getAll,
    getById,
    create,
    update,
    delete: deleteById,
  }
}
