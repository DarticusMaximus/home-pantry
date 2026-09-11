'use client'

import { AuthProvider } from '@/contexts/auth-context'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </AuthProvider>
  )
}
