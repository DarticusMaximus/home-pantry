import { createTemplate, deleteTemplate, updateTemplate } from '@/lib/appwrite/templates'
import {
  createBoundMutationHook,
  createMutationHook,
  createMutationWithIdHook,
} from '@/lib/hooks/create-mutation-hook'
import type { CreateTemplateInput, UpdateTemplateInput } from '@/types/template'

export const useCreateTemplate = createMutationHook<CreateTemplateInput>(
  createTemplate,
  'Failed to create template',
)

export const useUpdateTemplate = createMutationWithIdHook<UpdateTemplateInput>(
  updateTemplate,
  'Failed to update template',
)

export const useDeleteTemplate = createMutationHook<string>(
  deleteTemplate,
  'Failed to delete template',
)
