'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  getCurrentUser,
  login as loginWithEmailPassword,
  logout as logoutCurrentSession,
  register as registerAccount,
} from '@/lib/appwrite/auth'
import type { User } from '@/lib/appwrite/client'
import { PantryUnreachableError } from '@/lib/pantry-reachability'

interface AuthContextType {
  user: User | null
  loading: boolean
  unreachable: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  retrySession: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreachable, setUnreachable] = useState(false)
  const router = useRouter()
  const isRevalidatingRef = useRef(false)

  const checkSessionNow = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      setUnreachable(false)
    } catch (error) {
      if (error instanceof PantryUnreachableError) {
        setUnreachable(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const retrySession = useCallback(() => {
    setLoading(true)
    setUnreachable(false)
    void checkSessionNow()
  }, [checkSessionNow])

  const login = async (email: string, password: string) => {
    const currentUser = await loginWithEmailPassword(email, password)
    setUser(currentUser)
    router.push('/')
  }

  const register = async (email: string, password: string, name?: string) => {
    const currentUser = await registerAccount(email, password, name)
    setUser(currentUser)
    router.push('/')
  }

  const logout = async () => {
    try {
      await logoutCurrentSession()
    } catch {
    } finally {
      setUser(null)
      router.push('/login')
    }
  }

  const revalidateSession = useCallback(async () => {
    if (isRevalidatingRef.current) {
      return
    }

    isRevalidatingRef.current = true

    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      if (error instanceof PantryUnreachableError) {
        return
      }
    } finally {
      isRevalidatingRef.current = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const initializeSession = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (mounted) {
          setUser(currentUser)
          setUnreachable(false)
        }
      } catch (error) {
        if (mounted && error instanceof PantryUnreachableError) {
          setUnreachable(true)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void initializeSession()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const handleFocus = () => {
      void revalidateSession()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void revalidateSession()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [revalidateSession])

  return (
    <AuthContext.Provider
      value={{ user, loading, unreachable, login, register, logout, retrySession }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
