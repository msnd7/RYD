import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Person } from '../types'
import { useDb } from './db'
import { ApiError, apiGet, apiPost } from '../lib/api'

const SKEY = 'ryd.session'
export const normEmail = (e: string) => (e ?? '').trim().toLowerCase()

type LoginResult =
  | { ok: true; user: Person }
  | { ok: false; reason: 'notfound' | 'wrong' | 'inactive' | 'network' }

type Ctx = {
  user: Person | null
  authReady: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  changePassword: (current: string, next: string) => Promise<{ ok: boolean; error?: string }>
  resetPassword: (personId: string) => Promise<{ ok: boolean; error?: string }>
  isDirector: boolean
  canFinance: boolean
  mustChangePassword: boolean
  canManageMosque: (mosqueId: string) => boolean
}

const AuthCtx = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { db, set, mode, ready, refresh } = useDb()
  const remote = mode === 'remote'

  const [userId, setUserId] = useState<string | null>(
    () => (localStorage.getItem(SKEY) || null),
  )
  const [authReady, setAuthReady] = useState(false)

  // الوضع المشترك: الجلسة على الخادم — والوضع المحلي: في المتصفح
  useEffect(() => {
    if (!ready) return
    if (!remote) { setAuthReady(true); return }
    let alive = true
    apiGet<{ user: Person }>('/auth/session')
      .then((r) => { if (alive) setUserId(r.user?.id ?? null) })
      .catch(() => { if (alive) setUserId(null) })
      .finally(() => { if (alive) setAuthReady(true) })
    return () => { alive = false }
  }, [remote, ready])

  useEffect(() => {
    if (remote) return
    if (userId) localStorage.setItem(SKEY, userId)
    else localStorage.removeItem(SKEY)
  }, [userId, remote])

  const user = db.people.find((p) => p.id === userId && p.active) ?? null
  const isDirector = user?.role === 'director'

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    if (remote) {
      try {
        const r = await apiPost<{ user: Person }>('/auth/login', { email, password })
        setUserId(r.user.id)
        await refresh()
        return { ok: true, user: r.user }
      } catch (e) {
        const code = e instanceof ApiError ? e.code : 'network'
        const reason: 'notfound' | 'wrong' | 'inactive' | 'network' =
          code === 'notfound' || code === 'wrong' || code === 'inactive' ? code : 'network'
        return { ok: false, reason }
      }
    }
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
  }, [remote, db.people, set, refresh])

  const logout = useCallback(async () => {
    setUserId(null)
    if (remote) { try { await apiPost('/auth/logout') } catch { /* تجاهل */ } }
  }, [remote])

  const changePassword = useCallback(async (current: string, next: string) => {
    if (!user) return { ok: false, error: 'لا توجد جلسة.' }
    if (next.length < 4) return { ok: false, error: 'الرمز الجديد يجب ألا يقل عن ٤ خانات.' }
    if (next === current) return { ok: false, error: 'اختر رمزًا مختلفًا عن الحالي.' }

    if (remote) {
      try {
        await apiPost('/auth/change-password', { current, next })
        await refresh()
        return { ok: true }
      } catch (e) {
        const code = e instanceof ApiError ? e.code : 'network'
        return {
          ok: false,
          error: code === 'wrong_current' ? 'الرمز الحالي غير صحيح.'
            : code === 'is_default' ? 'لا يمكن استخدام الرمز المبدئي. اختر رمزًا خاصًا بك.'
            : code === 'too_short' ? 'الرمز الجديد قصير جدًا.'
            : 'تعذّر الاتصال بالخادم. حاول مرة أخرى.',
        }
      }
    }

    if (user.password !== current) return { ok: false, error: 'الرمز الحالي غير صحيح.' }
    set((d) => {
      const p = d.people.find((x) => x.id === user.id)!
      p.password = next
      p.mustChangePassword = false
    })
    return { ok: true }
  }, [user, remote, set, refresh])

  const resetPassword = useCallback(async (personId: string) => {
    if (remote) {
      try {
        await apiPost('/auth/reset-password', { personId })
        await refresh()
        return { ok: true }
      } catch (e) {
        const code = e instanceof ApiError ? e.code : 'network'
        return { ok: false, error: code === 'forbidden' ? 'هذه الصلاحية لمدير المجمع فقط.' : 'تعذّر الاتصال بالخادم.' }
      }
    }
    set((d) => {
      const p = d.people.find((x) => x.id === personId)
      if (p) { p.password = d.settings.defaultPassword; p.mustChangePassword = true }
    })
    return { ok: true }
  }, [remote, set, refresh])

  const value: Ctx = {
    user,
    authReady: authReady && ready,
    isDirector,
    canFinance: !!user && (isDirector || user.financeAccess),
    mustChangePassword: !!user?.mustChangePassword,
    canManageMosque: (mosqueId) =>
      !!user && (isDirector || (user.role === 'supervisor' && user.mosqueId === mosqueId)),
    login,
    logout,
    changePassword,
    resetPassword,
  }

  return React.createElement(AuthCtx.Provider, { value }, children)
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth خارج AuthProvider')
  return c
}
