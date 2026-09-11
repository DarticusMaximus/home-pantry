'use client'

import { useRouter } from 'next/navigation'
import { LocationsList } from '@/components/settings/locations-list'
import { SettingsResourcePage } from '@/components/settings/settings-resource-page'
import { useDeleteLocation } from '@/hooks/use-location-mutations'
import { useLocations } from '@/hooks/use-locations'
import { getLocationInUse } from '@/lib/appwrite/locations'
import { formatLocationInUseCopy } from '@/lib/in-use-copy'

export default function LocationsPage() {
  const router = useRouter()
  const { locations, isLoading, error, refetch } = useLocations()
  const deleteLocation = useDeleteLocation(refetch)

  return (
    <SettingsResourcePage
      title="Locations"
      backHref="/settings"
      addHref="/settings/locations/add"
      loadErrorCopy="Something went wrong loading locations. Try again to reload."
      deleteTitle="Delete Location"
      deleteDescription="Are you sure you want to delete this location? This action cannot be undone."
      fallbackName="this location"
      items={locations}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      deleteMutation={deleteLocation}
      getInUse={getLocationInUse}
      formatInUseCopy={formatLocationInUseCopy}
      onEdit={(id) => router.push(`/settings/locations/${id}`)}
      onAdd={() => router.push('/settings/locations/add')}
      renderList={({ items, onEdit, onDelete, onAdd }) => (
        <LocationsList locations={items} onEdit={onEdit} onDelete={onDelete} onAdd={onAdd} />
      )}
    />
  )
}
