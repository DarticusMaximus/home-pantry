'use client'

import { Home, Plus, Search, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSearchMode } from '@/contexts/search-mode-context'

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/ai', icon: Plus, label: 'Add' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { isSearching, openSearch, exitSearch } = useSearchMode()

  if (pathname === '/ai/review') return null

  const showingSearchScreen = pathname === '/' && isSearching

  const handleSearchClick = () => {
    if (showingSearchScreen) {
      exitSearch()
      return
    }
    openSearch({ focusField: true })
    if (pathname !== '/') {
      router.push('/')
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white pb-safe">
      <div className="flex h-14 items-center gap-3 px-4 border-b border-gray-100">
        <button
          type="button"
          onClick={handleSearchClick}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
            showingSearchScreen
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200'
          }`}
          aria-label={showingSearchScreen ? 'Close search' : 'Search items'}
        >
          {showingSearchScreen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          <span>{showingSearchScreen ? 'Close' : 'Search'}</span>
        </button>
      </div>
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isCurrent =
            item.href === '/'
              ? pathname === '/'
              : item.href === '/ai'
                ? pathname === '/ai' || pathname.startsWith('/ai/') || pathname === '/items/add'
                : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => exitSearch()}
              className={`flex h-16 w-16 flex-col items-center justify-center gap-1 ${
                isCurrent ? 'text-emerald-600' : 'text-gray-500'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
