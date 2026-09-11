'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { BackLink } from '@/components/layout/back-link'
import { LocationForm } from '@/components/settings/location-form'
import { useUpdateLocation } from '@/hooks/use-location-mutations'
import { useLocations } from '@/hooks/use-locations'
import { SAVE_RETRY_COPY } from '@/lib/household-copy'

export default function EditLocationPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { locations, isLoading, error } = useLocations()
  const updateLocation = useUpdateLocation(id)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const location = locations.find((loc) => loc.id === id)

  const handleSubmit = async (data: Parameters<typeof updateLocation.mutate>[0]) => {
    setSubmitError(null)
    try {
      await updateLocation.mutate(data)
      router.push('/settings/locations')
    } catch {
      setSubmitError(SAVE_RETRY_COPY)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BackLink href="/settings/locations" />
          <h2 className="text-xl font-semibold text-gray-900">Edit Location</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-24 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BackLink href="/settings/locations" />
          <h2 className="text-xl font-semibold text-gray-900">Edit Location</h2>
        </div>
        <div className="rounded-xl bg-red-50 p-4 text-center">
          <p className="text-red-600">Failed to load location: {error.message}</p>
        </div>
      </div>
    )
  }

  if (!location) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BackLink href="/settings/locations" />
          <h2 className="text-xl font-semibold text-gray-900">Edit Location</h2>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <p className="text-gray-500">Location not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <BackLink href="/settings/locations" />
        <h2 className="text-xl font-semibold text-gray-900">Edit Location</h2>
      </div>

      {submitError && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{submitError}</div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-xl">
        <LocationForm
          initialData={location}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/settings/locations')}
          isLoading={updateLocation.isLoading}
        />
      </div>
    </div>
  )
}
