'use client'

import { ChevronRight, Download, FileText, LogOut, MapPin, Tag } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useCategories } from '@/hooks/use-categories'
import { useLocations } from '@/hooks/use-locations'

interface SettingsItemProps {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  count?: number
  disabled?: boolean
}

function SettingsCard({
  href,
  icon: Icon,
  label,
  description,
  count,
  disabled,
}: SettingsItemProps) {
  const content = (
    <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${disabled ? 'bg-gray-100' : 'bg-emerald-50'}`}
        >
          <Icon className={`h-5 w-5 ${disabled ? 'text-gray-400' : 'text-emerald-600'}`} />
        </div>
        <div>
          <p className={`font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>{label}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500">{description}</p>
            {count !== undefined && !disabled && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {count}
              </span>
            )}
          </div>
        </div>
      </div>
      {!disabled && <ChevronRight className="h-5 w-5 text-gray-400" />}
    </div>
  )

  if (disabled) {
    return content
  }

  return <Link href={href}>{content}</Link>
}

export default function SettingsPage() {
  const { logout, user } = useAuth()
  const { locations } = useLocations()
  const { categories } = useCategories()

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Settings</h2>

      <div className="space-y-4">
        <SettingsCard
          href="/settings/locations"
          icon={MapPin}
          label="Locations"
          description="Manage storage locations"
          count={locations.length}
        />
        <SettingsCard
          href="/settings/categories"
          icon={Tag}
          label="Categories"
          description="Manage item categories"
          count={categories.length}
        />
        <SettingsCard
          href="/settings/templates"
          icon={FileText}
          label="Item Templates"
          description="Manage item presets"
        />
        <SettingsCard
          href="/settings/install"
          icon={Download}
          label="Install Home Pantry"
          description="Add to your home screen for quicker access"
        />
      </div>

      <div className="mt-6 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm text-gray-500">
          Logged in as <span className="font-medium text-gray-700">{user?.email}</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-3 font-medium text-red-600 hover:bg-red-100"
        >
          <LogOut className="h-5 w-5" />
          Log Out
        </button>
      </div>
    </div>
  )
}
