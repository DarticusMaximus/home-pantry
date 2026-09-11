'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BackLink } from '@/components/layout/back-link'
import { LocationForm } from '@/components/settings/location-form'
import { useCreateLocation } from '@/hooks/use-location-mutations'
import { useLocations } from '@/hooks/use-locations'
import { SAVE_RETRY_COPY } from '@/lib/household-copy'

export default function AddLocationPage() {
  const router = useRouter()
  const { refetch } = useLocations()
  const createLocation = useCreateLocation(refetch)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: Parameters<typeof createLocation.mutate>[0]) => {
    setError(null)
    try {
      await createLocation.mutate(data)
      router.push('/settings/locations')
    } catch {
      setError(SAVE_RETRY_COPY)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <BackLink href="/settings/locations" />
        <h2 className="text-xl font-semibold text-gray-900">Add Location</h2>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="rounded-xl bg-white p-6 shadow-xl">
        <LocationForm
          onSubmit={handleSubmit}
          onCancel={() => router.push('/settings/locations')}
          isLoading={createLocation.isLoading}
        />
      </div>
    </div>
  )
}
