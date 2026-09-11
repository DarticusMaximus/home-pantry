import { getItemById, getItems, getItemsByCategory, getItemsByLocation } from '@/lib/appwrite/items'
import {
  createFetchByIdHook,
  createFetchConditionalHook,
  createFetchHook,
} from '@/lib/hooks/create-fetch-hook'
import type { Item } from '@/types/item'

const useItemsBase = createFetchHook<Item>(getItems, 'Failed to fetch items')

interface UseItemsReturn {
  items: Item[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useItems(): UseItemsReturn {
  const { data, isLoading, error, refetch } = useItemsBase()
  return { items: data, isLoading, error, refetch }
}

const useItemBase = createFetchByIdHook<Item>(getItemById, 'Failed to fetch item')

interface UseItemReturn {
  item: Item | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useItem(id: string): UseItemReturn {
  const { data, isLoading, error, refetch } = useItemBase(id)
  return { item: data, isLoading, error, refetch }
}

const useItemsByLocationBase = createFetchConditionalHook<Item>(
  getItemsByLocation,
  'Failed to fetch items by location',
)

interface UseItemsByLocationReturn {
  items: Item[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useItemsByLocation(locationId: string): UseItemsByLocationReturn {
  const { data, isLoading, error, refetch } = useItemsByLocationBase(locationId)
  return { items: data, isLoading, error, refetch }
}

const useItemsByCategoryBase = createFetchConditionalHook<Item>(
  getItemsByCategory,
  'Failed to fetch items by category',
)

interface UseItemsByCategoryReturn {
  items: Item[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useItemsByCategory(categoryId: string): UseItemsByCategoryReturn {
  const { data, isLoading, error, refetch } = useItemsByCategoryBase(categoryId)
  return { items: data, isLoading, error, refetch }
}
