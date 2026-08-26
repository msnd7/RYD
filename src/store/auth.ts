import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Person } from '../types'
import { useDb } from './db'

const SKEY = 'ryd.session'
export const normEmail = (e: string) => e.trim().toLowerCase()

type LoginResult =
  | { ok: true; user: Person }
  | { ok: false; reason: 'notfound' | 'wrong' | 'inactive' }

type Ctx = {
  user: Person | null
  login: (email: string, password: string) => LoginResult
  logout: () => void
  changePassword: (current: string, next: string) => { ok: boolean; error?: string }
  isDirector: boolean
  canFinance: boolean
  mustChangePassword: boolean
  canManageMosque: (mosqueId: string) => boolean
}

const AuthCtx = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { db, set } = useDb()
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
    mustChangePassword: !!user?.mustChangePassword,
    canManageMosque: (mosqueId) =>
      !!user && (isDirector || (user.role === 'supervisor' && user.mosqueId === mosqueId)),

    login: (email, password) => {
      const e = normEmail(email)
      const found = db.people.find((p) => normEmail(p.email) === e)
      if (!found) return { ok: false, reason: 'notfound' }
      if (!found.active) return { ok: false, reason: 'inactive' }
      if (found.password !== password) return { ok: false, reason: 'wrong' }
      setUserId(found.id)
      set((d) => {
        const p = d.people.find((x) => x.id === found.id)
        if (p) p.lastLoginAt = new Date().toISOString()
      })
      return { ok: true, user: found }
    },

    logout: () => setUserId(null),

    changePassword: (current, next) => {
      if (!user) return { ok: false, error: 'لا توجد جلسة.' }
      if (user.password !== current) return { ok: false, error: 'الرمز الحالي غير صحيح.' }
      if (next.length < 4) return { ok: false, error: 'الرمز الجديد يجب ألا يقل عن ٤ خانات.' }
      if (next === current) return { ok: false, error: 'اختر رمزًا مختلفًا عن الحالي.' }
      set((d) => {
        const p = d.people.find((x) => x.id === user.id)!
        p.password = next
        p.mustChangePassword = false
      })
      return { ok: true }
    },
  }

  return React.createElement(AuthCtx.Provider, { value }, children)
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth خارج AuthProvider')
  return c
}
