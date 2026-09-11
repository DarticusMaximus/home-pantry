'use client'

import { LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white pt-safe">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-lg font-semibold text-emerald-600">Home Pantry</h1>

        <div className="flex items-center gap-3">
          {user?.name && <span className="hidden text-sm text-gray-500 sm:block">{user.name}</span>}
          <button
            type="button"
            onClick={logout}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Log out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
