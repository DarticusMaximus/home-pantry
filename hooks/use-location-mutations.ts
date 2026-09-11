import { createLocation, deleteLocation, updateLocation } from '@/lib/appwrite/locations'
import { createBoundMutationHook, createMutationHook } from '@/lib/hooks/create-mutation-hook'
import type { CreateLocationInput, UpdateLocationInput } from '@/types/location'

export const useCreateLocation = createMutationHook<CreateLocationInput>(
  createLocation,
  'Failed to create location',
)

export const useUpdateLocation = createBoundMutationHook<UpdateLocationInput>(
  updateLocation,
  'Failed to update location',
)

export const useDeleteLocation = createMutationHook<string>(
  deleteLocation,
  'Failed to delete location',
)
