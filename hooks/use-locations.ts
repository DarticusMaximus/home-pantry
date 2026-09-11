import { getLocations } from '@/lib/appwrite/locations'
import { createFetchHook } from '@/lib/hooks/create-fetch-hook'
import type { Location } from '@/types/location'

const useLocationsBase = createFetchHook<Location>(getLocations, 'Failed to fetch locations')

interface UseLocationsReturn {
  locations: Location[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useLocations(): UseLocationsReturn {
  const { data, isLoading, error, refetch } = useLocationsBase()
  return { locations: data, isLoading, error, refetch }
}
