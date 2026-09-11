import { createItem, deleteItem, updateItem } from '@/lib/appwrite/items'
import { createMutationHook, createMutationWithIdHook } from '@/lib/hooks/create-mutation-hook'
import type { CreateItemInput, UpdateItemInput } from '@/types/item'

export const useCreateItem = createMutationHook<CreateItemInput>(
  createItem,
  'Failed to create item',
)

export const useUpdateItem = createMutationWithIdHook<UpdateItemInput>(
  updateItem,
  'Failed to update item',
)

export const useDeleteItem = createMutationHook<string>(deleteItem, 'Failed to delete item')
