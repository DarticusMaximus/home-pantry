import {
  getTemplateById,
  getTemplates,
  getTemplatesByCategory,
  searchTemplates,
} from '@/lib/appwrite/templates'
import {
  createFetchByIdHook,
  createFetchConditionalHook,
  createFetchHook,
  createSearchHook,
} from '@/lib/hooks/create-fetch-hook'
import type { ItemTemplate } from '@/types/template'

const useTemplatesBase = createFetchHook<ItemTemplate>(getTemplates, 'Failed to fetch templates')

interface UseTemplatesReturn {
  templates: ItemTemplate[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useTemplates(): UseTemplatesReturn {
  const { data, isLoading, error, refetch } = useTemplatesBase()
  return { templates: data, isLoading, error, refetch }
}

const useTemplateBase = createFetchByIdHook<ItemTemplate>(
  getTemplateById,
  'Failed to fetch template',
)

interface UseTemplateReturn {
  template: ItemTemplate | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useTemplate(id: string): UseTemplateReturn {
  const { data, isLoading, error, refetch } = useTemplateBase(id)
  return { template: data, isLoading, error, refetch }
}

const useTemplateSearchBase = createSearchHook<ItemTemplate>(
  searchTemplates,
  'Failed to search templates',
  2,
  300,
)

interface UseTemplateSearchReturn {
  results: ItemTemplate[]
  isLoading: boolean
  error: Error | null
}

export function useTemplateSearch(query: string): UseTemplateSearchReturn {
  return useTemplateSearchBase(query)
}

const useTemplatesByCategoryBase = createFetchConditionalHook<ItemTemplate>(
  getTemplatesByCategory,
  'Failed to fetch templates by category',
)

interface UseTemplatesByCategoryReturn {
  templates: ItemTemplate[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useTemplatesByCategory(categoryId: string): UseTemplatesByCategoryReturn {
  const { data, isLoading, error, refetch } = useTemplatesByCategoryBase(categoryId)
  return { templates: data, isLoading, error, refetch }
}
