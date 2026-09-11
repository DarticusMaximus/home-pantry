'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { CannotReachPantry } from '@/components/ui/cannot-reach-pantry'
import { useAuth } from '@/contexts/auth-context'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, unreachable, retrySession } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user && !unreachable) {
      router.push('/login')
    }
  }, [user, loading, unreachable, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  if (unreachable) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <CannotReachPantry onRetry={retrySession} />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
