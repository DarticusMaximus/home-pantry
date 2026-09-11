import { createCategory, deleteCategory, updateCategory } from '@/lib/appwrite/categories'
import { createBoundMutationHook, createMutationHook } from '@/lib/hooks/create-mutation-hook'
import type { CreateCategoryInput, UpdateCategoryInput } from '@/types/category'

export const useCreateCategory = createMutationHook<CreateCategoryInput>(
  createCategory,
  'Failed to create category',
)

export const useUpdateCategory = createBoundMutationHook<UpdateCategoryInput>(
  updateCategory,
  'Failed to update category',
)

export const useDeleteCategory = createMutationHook<string>(
  deleteCategory,
  'Failed to delete category',
)
