'use client'

import { usePathname } from 'next/navigation'
import { AuthGuard } from '@/components/auth/auth-guard'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Header } from '@/components/layout/header'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { AuthProvider } from '@/contexts/auth-context'
import { SearchModeProvider } from '@/contexts/search-mode-context'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AuthProvider>
      <AuthGuard>
        <SearchModeProvider>
          <div className="flex min-h-screen flex-col bg-gray-50">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-emerald-600 focus:shadow-lg"
            >
              Skip to content
            </a>
            <Header />
            <main id="main-content" className="flex-1 pb-shell">
              <ErrorBoundary resetKeys={[pathname]}>{children}</ErrorBoundary>
            </main>
            <BottomNav />
          </div>
        </SearchModeProvider>
      </AuthGuard>
    </AuthProvider>
  )
}
