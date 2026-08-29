import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { DB } from '../types'
import { buildSeed } from '../data/seed'
import { migrated } from '../lib/migrate'
import { ApiError, apiGet, apiPut, detectMode, type StorageMode } from '../lib/api'

const KEY = 'ryd.db.v3'
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

const LEGACY_KEYS = ['ryd.db.v2', 'ryd.db.v1']

function loadLocal(): DB {
  // النسخة الحالية، ثم النسخ الأقدم — تُرقّى ولا تُهدر
  for (const k of [KEY, ...LEGACY_KEYS]) {
    try {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (parsed?.people && parsed?.mosques) return migrated(parsed)
    } catch { /* تالفة — جرّب التالية */ }
  }
  return buildSeed()
}

export type SyncState = 'idle' | 'saving' | 'error' | 'loading'

type Mutator = (d: DB) => void

type Ctx = {
  db: DB
  /** 'loading' حتى يُعرف الوضع، ثم 'remote' أو 'local' */
  mode: StorageMode | 'loading'
  ready: boolean
  sync: SyncState
  /** صحيح في الوضع المشترك عندما ترفض الجلسة (يجب تسجيل الدخول) */
  needsLogin: boolean
  set: (fn: Mutator) => void
  refresh: () => Promise<void>
  reset: () => void
  exportJson: () => void
  importJson: (file: File) => Promise<void>
}

const DbCtx = createContext<Ctx | null>(null)

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<StorageMode | 'loading'>('loading')
  const [db, setDbState] = useState<DB>(() => buildSeed())
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState<SyncState>('loading')
  const [needsLogin, setNeedsLogin] = useState(false)

  const dbRef = useRef<DB>(db)
  const versionRef = useRef(0)
  const pending = useRef<Mutator[]>([])
  const flushing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyDb = useCallback((next: DB) => {
    dbRef.current = next
    setDbState(next)
  }, [])

  /* ---------- التهيئة ---------- */
  useEffect(() => {
    let alive = true
    detectMode().then(async (m) => {
      if (!alive) return
      if (m === 'local') {
        setMode('local')
        applyDb(loadLocal())
        setSync('idle')
        setReady(true)
        return
      }
      setMode('remote')
      try {
        const r = await apiGet<{ doc: DB; version: number }>('/state')
        if (!alive) return
        versionRef.current = r.version
        applyDb(migrated(r.doc))
        setNeedsLogin(false)
        setSync('idle')
      } catch (e) {
        if (!alive) return
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setNeedsLogin(true)
        else setSync('error')
      } finally {
        if (alive) setReady(true)
      }
    })
    return () => { alive = false }
  }, [applyDb])

  /* ---------- الحفظ المحلي ---------- */
  useEffect(() => {
    if (mode !== 'local' || !ready) return
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* امتلأت المساحة */ }
  }, [db, mode, ready])

  // مزامنة بين تبويبات المتصفح (الوضع المحلي)
  useEffect(() => {
    if (mode !== 'local') return
    const h = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try { applyDb(JSON.parse(e.newValue)) } catch { /* تجاهل */ }
      }
    }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [mode, applyDb])

  /* ---------- الرفع إلى الخادم ---------- */
  const flush = useCallback(async () => {
    if (flushing.current || pending.current.length === 0) return
    flushing.current = true
    setSync('saving')
    try {
      while (pending.current.length) {
        const batch = pending.current
        pending.current = []
        let attempts = 0

        for (;;) {
          try {
            const r = await apiPut<{ version: number }>('/state', {
              version: versionRef.current, doc: dbRef.current,
            })
            versionRef.current = r.version
            break
          } catch (e) {
            const conflict = e instanceof ApiError && e.status === 409 && e.data?.doc
            if (conflict && attempts < 4) {
              attempts++
              // أعد بناء الوثيقة من نسخة الخادم ثم أعد تطبيق تعديلاتنا فوقها
              const fresh = clone(e.data.doc as DB)
              const replay = [...batch, ...pending.current]
              pending.current = []
              replay.forEach((f) => { try { f(fresh) } catch { /* تخطَّ تعديلًا فاسدًا */ } })
              versionRef.current = e.data.version
              applyDb(fresh)
              continue
            }
            if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
              setNeedsLogin(true)
              pending.current = []
              setSync('idle')
              return
            }
            // فشل مؤقت: احتفظ بالتعديلات لإعادة المحاولة لاحقًا
            pending.current = [...batch, ...pending.current]
            setSync('error')
            return
          }
        }
      }
      setSync('idle')
    } finally {
      flushing.current = false
    }
  }, [applyDb])

  // إعادة محاولة دورية عند فشل الحفظ
  useEffect(() => {
    if (mode !== 'remote' || sync !== 'error') return
    const t = setTimeout(() => { void flush() }, 6000)
    return () => clearTimeout(t)
  }, [mode, sync, flush])

  /* ---------- سحب تغييرات الآخرين ---------- */
  const refresh = useCallback(async () => {
    if (mode !== 'remote' || flushing.current || pending.current.length) return
    try {
      const r = await apiGet<{ doc: DB; version: number }>('/state')
      if (flushing.current || pending.current.length) return
      if (r.version !== versionRef.current) {
        versionRef.current = r.version
        applyDb(r.doc)
      }
      setNeedsLogin(false)
      if (sync === 'error') setSync('idle')
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setNeedsLogin(true)
    }
  }, [mode, applyDb, sync])

  useEffect(() => {
    if (mode !== 'remote' || !ready || needsLogin) return
    // تحديث دوري أثناء فتح التبويب فقط
    const iv = setInterval(() => { if (!document.hidden) void refresh() }, 10_000)
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [mode, ready, needsLogin, refresh])

  /* ---------- الواجهة ---------- */
  const set = useCallback((fn: Mutator) => {
    const next = clone(dbRef.current)
    fn(next)
    applyDb(next)
    if (mode === 'remote') {
      pending.current.push(fn)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => { void flush() }, 350)
    }
  }, [mode, applyDb, flush])

  // احفظ ما تبقّى قبل إغلاق الصفحة
  useEffect(() => {
    const h = () => { if (pending.current.length) void flush() }
    window.addEventListener('pagehide', h)
    return () => window.removeEventListener('pagehide', h)
  }, [flush])

  const value = useMemo<Ctx>(() => ({
    db, mode, ready, sync, needsLogin,
    set,
    refresh,
    reset: () => {
      const seed = buildSeed()
      if (mode === 'local') {
        localStorage.removeItem(KEY)
        applyDb(seed)
      } else {
        // استبدال كامل للوثيقة على الخادم
        applyDb(seed)
        pending.current = [(d: DB) => { Object.assign(d, clone(seed)) }]
        void flush()
      }
    },
    exportJson: () => {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `نسخة-رياض-القرآن-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    },
    importJson: async (file: File) => {
      const parsed = JSON.parse(await file.text()) as DB
      if (!parsed.mosques || !parsed.people) throw new Error('ملف غير صالح')
      if (mode === 'local') { applyDb(parsed) } else {
        applyDb(parsed)
        pending.current = [(d: DB) => { Object.assign(d, clone(parsed)) }]
        void flush()
      }
    },
  }), [db, mode, ready, sync, needsLogin, set, refresh, applyDb, flush])

  return React.createElement(DbCtx.Provider, { value }, children)
}

export function useDb() {
  const c = useContext(DbCtx)
  if (!c) throw new Error('useDb خارج DbProvider')
  return c
}

export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
