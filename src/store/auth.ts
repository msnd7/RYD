import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Person } from '../types'
import { useDb } from './db'

const SKEY = 'ryd.session'

type Ctx = {
  user: Person | null
  login: (username: string, password: string) => Person | null
  logout: () => void
  isDirector: boolean
  canFinance: boolean
  canManageMosque: (mosqueId: string) => boolean
}

const AuthCtx = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { db } = useDb()
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem(SKEY))

  useEffect(() => {
    if (userId) localStorage.setItem(SKEY, userId)
    else localStorage.removeItem(SKEY)
  }, [userId])

  const user = db.people.find((p) => p.id === userId && p.active) ?? null
  const isDirector = user?.role === 'director'

  const value: Ctx = {
    user,
    isDirector,
    canFinance: !!user && (isDirector || user.financeAccess),
    canManageMosque: (mosqueId) =>
      !!user && (isDirector || (user.role === 'supervisor' && user.mosqueId === mosqueId)),
    login: (username, password) => {
      const u = db.people.find(
        (p) => p.username.trim().toLowerCase() === username.trim().toLowerCase()
          && p.password === password && p.active,
      )
      if (u) setUserId(u.id)
      return u ?? null
    },
    logout: () => setUserId(null),
  }

  return React.createElement(AuthCtx.Provider, { value }, children)
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth خارج AuthProvider')
  return c
}
